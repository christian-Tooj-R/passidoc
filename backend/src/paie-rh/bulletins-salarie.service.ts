import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake');
import { BulletinSalarie } from '../entities/bulletin-salarie.entity';
import { ContratTravail, StatutContratTravail } from '../entities/contrat-travail.entity';
import { VariablePaieRh, StatutVariablePaieRh } from '../entities/variable-paie-rh.entity';
import { User } from '../entities/user.entity';
import { CyclePaieRh, StatutCyclePaieRh } from '../entities/cycle-paie-rh.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { StatutConge, TypeConge } from '../entities/conge-absence.entity';
import { MoteurCalculPaieRhService, ResultatCalculPaieRh } from './moteur-calcul-paie-rh.service';
import { ContratsTravailService } from './contrats-travail.service';
import { RubriquesPaieRhService } from './rubriques-paie-rh.service';
import { ConstantesPaieRhService } from './constantes-paie-rh.service';
import { resoudreConstante } from './constante-resolution.util';
import { VariablesPaieRhService } from './variables-paie-rh.service';
import { AcomptesSalarieService } from './acomptes-salarie.service';
import { CongesAbsencesService } from '../conges-absences/conges-absences.service';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Cumul annuel (~Sage "Bulletin calculé", colonne "Cumul") : somme des totaux de tous les
 * bulletins déjà GÉNÉRÉS pour un salarié, de janvier à `moisJusqua` inclus, dans l'année
 * civile `annee`. Voir `BulletinsSalarieService.cumulAnnuel()` pour la règle de
 * dédoublonnage appliquée (un duplicata/une régularisation ne compte jamais deux fois le
 * même mois).
 */
export interface CumulAnnuelPaieRh {
  salarieId: number;
  annee: number;
  moisJusqua: number;
  nbBulletinsInclus: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  coutEmployeur: number;
}

@Injectable()
export class BulletinsSalarieService {
  constructor(
    @InjectRepository(BulletinSalarie) private repo: Repository<BulletinSalarie>,
    @InjectRepository(ContratTravail) private contratRepo: Repository<ContratTravail>,
    @InjectRepository(VariablePaieRh) private variableRepo: Repository<VariablePaieRh>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CyclePaieRh) private cycleRepo: Repository<CyclePaieRh>,
    @InjectRepository(TenantConfig) private tenantConfigRepo: Repository<TenantConfig>,
    private moteur: MoteurCalculPaieRhService,
    private contratsService: ContratsTravailService,
    private rubriquesService: RubriquesPaieRhService,
    private constantesService: ConstantesPaieRhService,
    private variablesService: VariablesPaieRhService,
    private acomptesService: AcomptesSalarieService,
    private congesService: CongesAbsencesService,
  ) {}

  private async chargerContexte(salarieId: number, mois: number, annee: number, tenantId: number) {
    // Contrat EN VIGUEUR PENDANT LA PÉRIODE demandée, pas forcément le contrat actuellement
    // actif — sinon un recalcul d'un mois passé après un changement de salaire appliquerait
    // à tort le nouveau salaire. Voir ContratsTravailService.findPourPeriode().
    const contrat = await this.contratsService.findPourPeriode(salarieId, mois, annee, tenantId);
    if (!contrat) throw new NotFoundException(`Aucun contrat en vigueur pour le salarié ${salarieId} sur la période ${mois}/${annee}`);

    // MVP2 : synchronise automatiquement absences validées + acomptes validés de la période
    // avant tout calcul (CDC §8.1 "transfert automatique des absences validées vers la paie").
    await this.variablesService.synchroniserAbsences(salarieId, mois, annee, tenantId);
    await this.variablesService.synchroniserAcomptes(salarieId, mois, annee, tenantId);
    // Idem pour les heures sup déjà calculées dans la "Feuille d'activité" journalière
    // (no-op si l'activité n'a jamais été calculée pour ce salarié/cette période — voir
    // VariablesPaieRhService.synchroniserHeuresSup()).
    await this.variablesService.synchroniserHeuresSup(salarieId, mois, annee, tenantId);

    const variable = await this.variableRepo.findOne({ where: { salarieId, mois, annee, tenantId } });
    // Date de référence pour l'historisation des rubriques/constantes (voir
    // RubriquePaieRh.dateEffet / ConstantePaieRh.dateEffet) : fin de la période demandée,
    // pas la date du jour — un recalcul ultérieur d'un mois passé doit résoudre les
    // rubriques/constantes valables À CETTE PÉRIODE, pas les valeurs les plus récentes en base.
    const dateRef = new Date(annee, mois, 0).toISOString().split('T')[0];
    const rubriques = await this.rubriquesService.findByRegime(contrat.regimePaieCode, tenantId, dateRef);
    const constantes = await this.constantesService.findByRegime(contrat.regimePaieCode, tenantId, dateRef);

    return { contrat, variable, rubriques, constantes };
  }

  private async assertPeriodeOuverte(mois: number, annee: number, tenantId: number): Promise<void> {
    const cycle = await this.cycleRepo.findOne({ where: { mois, annee, tenantId } });
    if (cycle?.statut === StatutCyclePaieRh.CLOTURE) {
      throw new BadRequestException(
        `La période ${mois}/${annee} est clôturée — une paie clôturée est immuable (CDC §1). Utilisez une régularisation sur une période ultérieure.`,
      );
    }
  }

  /** Aperçu du calcul, sans persister. Utilisé par le front avant génération définitive. */
  async calculer(
    salarieId: number,
    mois: number,
    annee: number,
    tenantId: number,
  ): Promise<ResultatCalculPaieRh & { salarieId: number; mois: number; annee: number }> {
    const { contrat, variable, rubriques, constantes } = await this.chargerContexte(salarieId, mois, annee, tenantId);
    const resultat = this.moteur.calculer(contrat, variable, rubriques, constantes);
    return { ...resultat, salarieId, mois, annee };
  }

  /**
   * Aperçu PDF du bulletin (bouton "Aperçu / Imprimer" de l'onglet "Bulletin calculé") :
   * calcul EN DIRECT depuis le contexte courant, rendu au même format que le PDF définitif,
   * mais SANS RIEN PERSISTER (pas de ligne `paie_rh_bulletins` créée, pas de `pdfHash`) —
   * contrairement à `generer()`/`genererPdf()`. Utilisable même si la période n'est pas
   * encore ouverte ou le bulletin jamais généré.
   */
  async apercuPdf(salarieId: number, mois: number, annee: number, tenantId: number): Promise<Buffer> {
    const { contrat, variable, rubriques, constantes } = await this.chargerContexte(salarieId, mois, annee, tenantId);
    const resultat = this.moteur.calculer(contrat, variable, rubriques, constantes);
    const estPlaceholder = rubriques.some((r) => r.estPlaceholder) || constantes.some((c) => c.estPlaceholder);

    const transitoire = {
      id: 0,
      tenantId,
      salarieId,
      contratTravailId: contrat.id,
      variablePaieRhId: variable?.id ?? null,
      cyclePaieRhId: null,
      mois,
      annee,
      regimePaieCode: contrat.regimePaieCode,
      salaireBase: resultat.salaireBase,
      totalBrut: resultat.totalBrut,
      totalCotisationsSalariales: resultat.totalCotisationsSalariales,
      totalCotisationsPatronales: resultat.totalCotisationsPatronales,
      netImposable: resultat.netImposable,
      netAPayer: resultat.netAPayer,
      coutEmployeur: resultat.coutEmployeur,
      detailRubriques: resultat.detailRubriques,
      datePaiement: null,
      modePaiement: null,
      referencePaiement: null,
      version: 1,
      estRegularisation: false,
      bulletinOrigineId: null,
      pdfHash: null,
      estPlaceholder,
      dateGeneration: new Date(),
    } as unknown as BulletinSalarie;

    return this.construirePdf(transitoire, { persister: false });
  }

  /**
   * Calcule et persiste un bulletin figé (snapshot) pour la période donnée.
   *
   * Si un bulletin (non régularisation) existe déjà pour ce salarié/mois/année et que la
   * période n'est pas clôturée, il est REMPLACÉ en place (mêmes id/version) plutôt que
   * dupliqué : un changement de rubriques/constantes/variables doit pouvoir être répercuté
   * tant que la paie n'est pas figée. Un bulletin déjà PAYÉ n'est jamais écrasé — il faut
   * passer par une régularisation (BUL-008), sinon le montant versé et le bulletin
   * divergeraient silencieusement.
   */
  async generer(salarieId: number, mois: number, annee: number, tenantId: number): Promise<BulletinSalarie> {
    await this.assertPeriodeOuverte(mois, annee, tenantId);
    const { contrat, variable, rubriques, constantes } = await this.chargerContexte(salarieId, mois, annee, tenantId);
    const resultat = this.moteur.calculer(contrat, variable, rubriques, constantes);
    const estPlaceholder =
      rubriques.some((r) => r.estPlaceholder) ||
      constantes.some((c) => c.estPlaceholder);

    const existant = await this.repo.findOne({
      where: { salarieId, mois, annee, tenantId, estRegularisation: false },
      order: { version: 'DESC' },
    });
    if (existant?.datePaiement) {
      throw new BadRequestException(
        `Le bulletin ${mois}/${annee} de ce salarié est déjà marqué payé (${existant.datePaiement}) — il ne peut plus être régénéré, utilisez une régularisation.`,
      );
    }

    const snapshot = {
      contratTravailId: contrat.id,
      variablePaieRhId: variable?.id ?? null,
      regimePaieCode: contrat.regimePaieCode,
      salaireBase: resultat.salaireBase,
      totalBrut: resultat.totalBrut,
      totalCotisationsSalariales: resultat.totalCotisationsSalariales,
      totalCotisationsPatronales: resultat.totalCotisationsPatronales,
      netImposable: resultat.netImposable,
      netAPayer: resultat.netAPayer,
      coutEmployeur: resultat.coutEmployeur,
      detailRubriques: resultat.detailRubriques,
      estPlaceholder,
    };

    const bulletin = existant
      ? Object.assign(existant, snapshot, { pdfHash: null, dateGeneration: new Date() })
      : this.repo.create({ tenantId, salarieId, mois, annee, ...snapshot });
    const saved = await this.repo.save(bulletin);

    if (variable) {
      variable.statut = StatutVariablePaieRh.BULLETIN_GENERE;
      await this.variableRepo.save(variable);
    }
    await this.acomptesService.marquerDeduits(salarieId, mois, annee, tenantId);

    return saved;
  }

  findBySalarie(salarieId: number, tenantId: number): Promise<BulletinSalarie[]> {
    return this.repo.find({
      where: { salarieId, tenantId },
      order: { annee: 'DESC', mois: 'DESC' },
    });
  }

  findByPeriode(mois: number, annee: number, tenantId: number): Promise<BulletinSalarie[]> {
    return this.repo.find({ where: { mois, annee, tenantId } });
  }

  /**
   * Cumul annuel (onglet "Bulletin calculé" du dialogue "Bulletin du salarié", affiché à
   * côté du résultat "Période") : somme les totaux des bulletins déjà GÉNÉRÉS pour ce
   * salarié, de janvier à `moisJusqua` inclus, dans l'année civile `annee`.
   *
   * Dédoublonnage assumé (simplification documentée, voir Doc/MODULE_PAIE_RH_NOTES.md) :
   * un même mois peut avoir plusieurs lignes `BulletinSalarie` (duplicata BUL-007,
   * régularisation BUL-008). On ne retient qu'UNE ligne par mois pour ne jamais compter un
   * même mois deux fois :
   * - si une régularisation existe pour ce mois, elle représente le mois (elle est censée
   *   corriger l'original) ;
   * - sinon, la version la plus élevée est retenue (un duplicata BUL-007 porte les MÊMES
   *   montants que l'original — lequel des deux est retenu est donc sans impact numérique).
   * Ce choix ne calcule PAS de delta ligne à ligne entre original et régularisation (cohérent
   * avec `genererRegularisation()`, qui recalcule intégralement plutôt qu'un delta).
   */
  async cumulAnnuel(salarieId: number, mois: number, annee: number, tenantId: number): Promise<CumulAnnuelPaieRh> {
    const bulletins = await this.repo.find({ where: { salarieId, annee, tenantId } });

    const retenuParMois = new Map<number, BulletinSalarie>();
    for (const b of bulletins) {
      if (b.mois > mois) continue;
      const existant = retenuParMois.get(b.mois);
      if (!existant) { retenuParMois.set(b.mois, b); continue; }
      if (b.estRegularisation && !existant.estRegularisation) { retenuParMois.set(b.mois, b); continue; }
      if (!b.estRegularisation && existant.estRegularisation) continue;
      if (b.version > existant.version) retenuParMois.set(b.mois, b);
    }

    const retenus = [...retenuParMois.values()];
    const somme = (f: (b: BulletinSalarie) => number): number => round2(retenus.reduce((s, b) => s + f(b), 0));

    return {
      salarieId,
      annee,
      moisJusqua: mois,
      nbBulletinsInclus: retenus.length,
      totalBrut: somme((b) => Number(b.totalBrut)),
      totalCotisationsSalariales: somme((b) => Number(b.totalCotisationsSalariales)),
      totalCotisationsPatronales: somme((b) => Number(b.totalCotisationsPatronales)),
      netImposable: somme((b) => Number(b.netImposable)),
      netAPayer: somme((b) => Number(b.netAPayer)),
      coutEmployeur: somme((b) => Number(b.coutEmployeur)),
    };
  }

  async findOne(id: number, tenantId: number): Promise<BulletinSalarie> {
    const bulletin = await this.repo.findOne({ where: { id, tenantId } });
    if (!bulletin) throw new NotFoundException(`Bulletin ${id} introuvable`);
    return bulletin;
  }

  /** Portail salarié (V1) : un salarié ne peut consulter que SES PROPRES bulletins. */
  async findMesBulletins(salarieId: number): Promise<BulletinSalarie[]> {
    return this.repo.find({ where: { salarieId }, order: { annee: 'DESC', mois: 'DESC' } });
  }

  async findOneForSalarie(id: number, salarieId: number): Promise<BulletinSalarie> {
    const bulletin = await this.repo.findOne({ where: { id, salarieId } });
    if (!bulletin) throw new NotFoundException(`Bulletin ${id} introuvable`);
    return bulletin;
  }

  /** MVP2 — enregistrement informatif du paiement (PAS d'intégration bancaire réelle). */
  async enregistrerPaiement(
    id: number,
    tenantId: number,
    dto: { datePaiement: string; modePaiement: string; referencePaiement?: string },
  ): Promise<BulletinSalarie> {
    const bulletin = await this.findOne(id, tenantId);
    bulletin.datePaiement = dto.datePaiement;
    bulletin.modePaiement = dto.modePaiement;
    bulletin.referencePaiement = dto.referencePaiement ?? null;
    return this.repo.save(bulletin);
  }

  /**
   * V1 (best-effort) — duplicata clairement identifié (BUL-007) : nouvelle ligne, même
   * contenu, `version` incrémentée, ne modifie pas l'original.
   */
  async dupliquer(id: number, tenantId: number): Promise<BulletinSalarie> {
    const original = await this.findOne(id, tenantId);
    const duplicata: Partial<BulletinSalarie> = {
      tenantId: original.tenantId,
      salarieId: original.salarieId,
      contratTravailId: original.contratTravailId,
      variablePaieRhId: original.variablePaieRhId,
      cyclePaieRhId: original.cyclePaieRhId,
      mois: original.mois,
      annee: original.annee,
      regimePaieCode: original.regimePaieCode,
      salaireBase: original.salaireBase,
      totalBrut: original.totalBrut,
      totalCotisationsSalariales: original.totalCotisationsSalariales,
      totalCotisationsPatronales: original.totalCotisationsPatronales,
      netImposable: original.netImposable,
      netAPayer: original.netAPayer,
      coutEmployeur: original.coutEmployeur,
      detailRubriques: original.detailRubriques,
      datePaiement: original.datePaiement,
      modePaiement: original.modePaiement,
      referencePaiement: original.referencePaiement,
      estPlaceholder: original.estPlaceholder,
      version: original.version + 1,
    };
    return this.repo.save(this.repo.create(duplicata));
  }

  /**
   * V1 (best-effort) — bulletin correctif/régularisation (BUL-008) : NE modifie PAS le
   * bulletin d'origine (immutabilité), crée un nouveau bulletin marqué
   * `estRegularisation = true` avec un lien vers l'original. Le delta n'est pas calculé
   * automatiquement ligne à ligne (hors périmètre v1) : ce nouveau bulletin est recalculé
   * intégralement pour le mois demandé, à comparer manuellement à l'original.
   */
  async genererRegularisation(
    bulletinOrigineId: number,
    tenantId: number,
  ): Promise<BulletinSalarie> {
    const origine = await this.findOne(bulletinOrigineId, tenantId);
    const resultat = await this.calculer(origine.salarieId, origine.mois, origine.annee, tenantId);

    const regularisation = this.repo.create({
      tenantId,
      salarieId: origine.salarieId,
      contratTravailId: origine.contratTravailId,
      variablePaieRhId: origine.variablePaieRhId,
      mois: origine.mois,
      annee: origine.annee,
      regimePaieCode: origine.regimePaieCode,
      salaireBase: resultat.salaireBase,
      totalBrut: resultat.totalBrut,
      totalCotisationsSalariales: resultat.totalCotisationsSalariales,
      totalCotisationsPatronales: resultat.totalCotisationsPatronales,
      netImposable: resultat.netImposable,
      netAPayer: resultat.netAPayer,
      coutEmployeur: resultat.coutEmployeur,
      detailRubriques: resultat.detailRubriques,
      estRegularisation: true,
      bulletinOrigineId: origine.id,
      version: 1,
    });
    return this.repo.save(regularisation);
  }

  private readonly MOIS_LABEL = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  async genererPdf(id: number, tenantId: number): Promise<Buffer> {
    const bulletin = await this.findOne(id, tenantId);
    return this.construirePdf(bulletin);
  }

  /** Portail salarié : téléchargement de son propre bulletin uniquement. */
  async genererPdfPourSalarie(id: number, salarieId: number): Promise<Buffer> {
    const bulletin = await this.findOneForSalarie(id, salarieId);
    return this.construirePdf(bulletin);
  }

  /**
   * Libellé de la devise affiché sur le PDF — dérivé de `User.devise` (EUR/MGA/USD),
   * PAS forcé à "Ar" comme sur l'exemplaire Sage photographié (spécifique à une société
   * malgache) : voir Doc/MODULE_PAIE_RH_NOTES.md, section "Refonte du bulletin (~Sage)".
   */
  private readonly DEVISE_LABELS: Record<string, string> = { EUR: '€', USD: '$', MGA: 'Ar' };

  private formatMontant(v: unknown): string {
    // Séparateur de milliers ESPACE + virgule décimale (ex: "1 795 300,00"), format demandé
    // pour le PDF — indépendant de la locale Angular (ce code tourne côté serveur, hors
    // contexte Angular/LOCALE_ID). Toujours 2 décimales, y compris pour une devise comme
    // l'Ariary qui n'en affiche traditionnellement pas sur l'exemplaire Sage d'origine :
    // simplification assumée pour rester cohérent avec le stockage decimal(10,2) du bulletin.
    const n = Number(v) || 0;
    const negatif = n < 0;
    const fixed = Math.abs(n).toFixed(2);
    const [entier, decimales] = fixed.split('.');
    const avecEspaces = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${negatif ? '-' : ''}${avecEspaces},${decimales}`;
  }

  private formatDate(iso: string | Date | null | undefined): string {
    if (!iso) return '';
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  private aRenseigner(v: string | null | undefined): string {
    return v && v.trim() ? v : 'à renseigner';
  }

  private async construirePdf(bulletin: BulletinSalarie, options: { persister?: boolean } = {}): Promise<Buffer> {
    const { persister = true } = options;
    const salarie = await this.userRepo.findOne({ where: { id: bulletin.salarieId } });
    if (!salarie) throw new NotFoundException('Salarié introuvable pour ce bulletin');

    // ── Employeur (TenantConfig) — voir Doc/MODULE_PAIE_RH_NOTES.md : ces champs sont
    // nullable, RIEN n'est inventé pour AFYM. "à renseigner" plutôt qu'un blanc silencieux.
    const tenantConfig = bulletin.tenantId
      ? await this.tenantConfigRepo.findOne({ where: { id: bulletin.tenantId } })
      : null;

    // ── Contrat — utilisé uniquement pour l'ancienneté (contrat.dateDebut). Celui lié au
    // bulletin s'il est connu (bulletins générés après l'ajout de contratTravailId),
    // sinon le contrat actif du salarié en solution de repli (anciens bulletins).
    let contrat: ContratTravail | null = null;
    if (bulletin.contratTravailId) {
      contrat = await this.contratRepo.findOne({ where: { id: bulletin.contratTravailId } });
    }
    if (!contrat) {
      contrat = await this.contratRepo.findOne({
        where: { salarieId: bulletin.salarieId, statut: StatutContratTravail.ACTIF, tenantId: bulletin.tenantId },
      });
    }

    // ── "Ancienneté" — depuis contrat.dateDebut, ou user.dateEntree si renseigné et plus
    // ancien (consigne explicite : ne pas ajouter de champ statique dédié).
    let dateAnciennete: string | null = contrat?.dateDebut ?? null;
    if (salarie.dateEntree && (!dateAnciennete || salarie.dateEntree < dateAnciennete)) {
      dateAnciennete = salarie.dateEntree;
    }

    // ── "Horaire" — même constante HEURES_LEGALES_MOIS que le moteur de calcul (pas une
    // nouvelle notion, fusionnée depuis l'ancien ParametrePaieRh — voir
    // Doc/MODULE_PAIE_RH_NOTES.md) — voir moteur-calcul-paie-rh.service.ts.
    let horaireMensuel: number | null = null;
    try {
      const constantesHoraire = await this.constantesService.findByRegime(bulletin.regimePaieCode || 'TOUS', bulletin.tenantId);
      horaireMensuel = resoudreConstante('HEURES_LEGALES_MOIS', constantesHoraire);
    } catch {
      horaireMensuel = null;
    }

    // ── Congés — Acquis/Reste/Pris (best-effort, n'empêche jamais la génération du PDF).
    // Choix documenté (Doc/MODULE_PAIE_RH_NOTES.md) : agrégation sur le type CONGES_PAYES
    // (type standard de l'enum TypeConge), Reste = Acquis - Pris (consigne explicite —
    // ignore volontairement joursEnAttente, à la différence du "solde" calculé par
    // CongesAbsencesService.getSoldes()). Les 3 lignes "Congés : du ... au ..." listent les
    // congés APPROUVÉS dont la date de début tombe dans le mois du bulletin.
    let congesAcquis = 0;
    let congesPris = 0;
    let congesPeriode: { debut: string; fin: string }[] = [];
    try {
      const soldes = await this.congesService.getSoldes(bulletin.salarieId, bulletin.annee);
      const soldeCP = soldes.find((s) => s.typeConge === TypeConge.CONGES_PAYES);
      congesAcquis = Number(soldeCP?.joursAcquis ?? 0);
      congesPris = Number(soldeCP?.joursPris ?? 0);

      const conges = await this.congesService.findAll({
        userId: bulletin.salarieId,
        statut: StatutConge.APPROUVEE,
        annee: bulletin.annee,
        tenantId: bulletin.tenantId,
      });
      congesPeriode = conges
        .filter((c) => new Date(c.dateDebut).getMonth() + 1 === bulletin.mois)
        .slice(0, 3)
        .map((c) => ({ debut: c.dateDebut, fin: c.dateFin }));
    } catch {
      // best-effort : une erreur du module congés/absences ne doit jamais bloquer le PDF.
    }

    // ── Avantages en nature (pour la ligne "Av.Nat." du tableau de cumuls) — best-effort :
    // recalculé depuis la variable mensuelle liée au bulletin si elle existe encore
    // (elle peut avoir été modifiée depuis la génération — limitation documentée, voir
    // Doc/MODULE_PAIE_RH_NOTES.md, ce montant n'est pas un champ persisté sur le snapshot
    // BulletinSalarie lui-même).
    let totalAvantagesNature = 0;
    if (bulletin.variablePaieRhId) {
      const variable = await this.variableRepo.findOne({ where: { id: bulletin.variablePaieRhId } });
      if (variable?.avantagesNature) {
        totalAvantagesNature = round2(
          variable.avantagesNature.reduce((acc, l) => acc + (Number(l.montant) || 0), 0),
        );
      }
    }

    pdfmake.addFonts({
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    const fmt = (v: unknown) => this.formatMontant(v);

    // Flag "Impression bulletin" (I) de la refonte ~Sage : une rubrique dont aucune part
    // n'a `impressionBulletin = true` reste dans le calcul (totaux) mais n'apparaît pas
    // sur le PDF — un bulletin généré avant cette refonte n'a pas ce champ (undefined),
    // traité comme imprimable par défaut pour ne rien cacher rétroactivement.
    const lignesImprimables = bulletin.detailRubriques.filter((l) => l.imprimable !== false);
    const lignesCotisations = lignesImprimables.filter((l) => l.imputation === 'COTISATION');
    const lignesAutres = lignesImprimables.filter((l) => l.imputation !== 'COTISATION');

    // ── Devise ──
    const devise = salarie.devise || 'EUR';
    const deviseLabel = this.DEVISE_LABELS[devise] ?? devise;

    // ── Période ──
    const premierJour = new Date(bulletin.annee, bulletin.mois - 1, 1);
    const dernierJour = new Date(bulletin.annee, bulletin.mois, 0);
    const nbJoursPeriode = dernierJour.getDate();

    // ── Tableau principal — structure ~Sage à 3 groupes de colonnes : RUBRIQUE
    // (N°/Désignation/Nb/Montant) | PART SALARIALE (Taux/Retenue) | PART PATRONALE
    // (Taux/Retenue). Une 1ère ligne synthétique "Salaire de base" n'est PAS une
    // RubriquePaieRh (elle vient de `contrat.salaireBase`/`bulletin.salaireBase`, géré à
    // part par le moteur de calcul) — reconstituée ici pour l'affichage, avec un "Nb" =
    // nombre de jours calendaires de la période (faute d'un concept "jours travaillés"
    // distinct dans notre moteur — voir Doc/MODULE_PAIE_RH_NOTES.md).
    const tableBody: any[] = [
      [
        { text: 'RUBRIQUE', bold: true, alignment: 'center', colSpan: 4 }, {}, {}, {},
        { text: 'PART SALARIALE', bold: true, alignment: 'center', colSpan: 2 }, {},
        { text: 'PART PATRONALE', bold: true, alignment: 'center', colSpan: 2 }, {},
      ],
      [
        { text: 'N°', bold: true },
        { text: 'Désignation', bold: true },
        { text: 'Nb', bold: true, alignment: 'right' },
        { text: 'Montant', bold: true, alignment: 'right' },
        { text: 'Taux', bold: true, alignment: 'right' },
        { text: 'Retenue', bold: true, alignment: 'right' },
        { text: 'Taux', bold: true, alignment: 'right' },
        { text: 'Retenue', bold: true, alignment: 'right' },
      ],
      [
        '', 'Salaire de base',
        { text: String(nbJoursPeriode), alignment: 'right' },
        { text: fmt(bulletin.salaireBase), alignment: 'right' },
        { text: '-', alignment: 'right' }, { text: '-', alignment: 'right' },
        { text: '-', alignment: 'right' }, { text: '-', alignment: 'right' },
      ],
    ];
    for (const l of [...lignesCotisations, ...lignesAutres]) {
      tableBody.push([
        l.code,
        l.libelle,
        { text: l.nombreSalarial != null ? String(l.nombreSalarial) : '-', alignment: 'right' },
        { text: fmt(l.base), alignment: 'right' },
        { text: l.tauxSalarial != null ? `${l.tauxSalarial}%` : '-', alignment: 'right' },
        { text: fmt(l.montantSalarial), alignment: 'right' },
        { text: l.tauxPatronal != null ? `${l.tauxPatronal}%` : '-', alignment: 'right' },
        { text: fmt(l.montantPatronal), alignment: 'right' },
      ]);
    }

    // ── Tableau de pied (cumuls ~Sage) — Cumuls | Sal.Br | Net.Imp | Ch.Sal | Ch.Pat. |
    // Hrs trav. | Av.Nat. | NET. "Hrs trav." réutilise le même HEURES_LEGALES_MOIS que
    // "Horaire" en en-tête (pas de suivi distinct des heures réellement travaillées dans
    // notre moteur — voir Doc/MODULE_PAIE_RH_NOTES.md). La ligne "Fmg" (double devise
    // historique malgache) de l'exemplaire d'origine n'est PAS reproduite (hors sujet).
    const tableCumuls = {
      table: {
        widths: ['auto', '*', '*', '*', '*', '*', '*', '*'],
        body: [
          [
            { text: 'Cumuls', bold: true }, { text: 'Sal. Br', bold: true, alignment: 'right' },
            { text: 'Net. Imp', bold: true, alignment: 'right' }, { text: 'Ch. Sal', bold: true, alignment: 'right' },
            { text: 'Ch. Pat.', bold: true, alignment: 'right' }, { text: 'Hrs trav.', bold: true, alignment: 'right' },
            { text: 'Av. Nat.', bold: true, alignment: 'right' }, { text: 'NET', bold: true, alignment: 'right' },
          ],
          [
            deviseLabel,
            { text: fmt(bulletin.totalBrut), alignment: 'right' },
            { text: fmt(bulletin.netImposable), alignment: 'right' },
            { text: fmt(bulletin.totalCotisationsSalariales), alignment: 'right' },
            { text: fmt(bulletin.totalCotisationsPatronales), alignment: 'right' },
            { text: horaireMensuel != null ? String(horaireMensuel) : '-', alignment: 'right' },
            { text: fmt(totalAvantagesNature), alignment: 'right' },
            { text: fmt(bulletin.netAPayer), bold: true, alignment: 'right' },
          ],
        ],
      },
      margin: [0, 8, 0, 15],
    };

    const titre = bulletin.estRegularisation ? 'BULLETIN DE SALAIRE — RÉGULARISATION' : 'BULLETIN DE SALAIRE';
    const versionLabel = bulletin.version > 1 ? ` — v${bulletin.version} (duplicata/correctif)` : '';

    // ── Bloc identité + informations administratives du salarié (grille ~Sage) ──
    const civilite = salarie.sexe === 'F' ? 'Mme' : salarie.sexe === 'M' ? 'M.' : '';
    const adresseSalarie = [salarie.adresse, [salarie.codePostal, salarie.ville].filter(Boolean).join(' '), salarie.pays]
      .filter(Boolean)
      .join(' — ');

    const champInfo = (label: string, valeur: string | number | null | undefined) => ({
      stack: [
        { text: label, fontSize: 7, color: '#666' },
        { text: valeur != null && valeur !== '' ? String(valeur) : '-', fontSize: 9 },
      ],
      margin: [0, 0, 0, 6],
    });

    // ── Bloc "FICHE DE PAIE" — un seul tableau à bordures (grille ~Sage), au lieu de
    // simples colonnes sans bordure : en-tête employeur/période, grille d'informations
    // salarié (4 colonnes), puis congés + identité, le tout dans les mêmes bordures.
    const ficheDePaieTable = {
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [
          [
            {
              colSpan: 2,
              stack: [
                { text: 'FICHE DE PAIE', bold: true, fontSize: 13, margin: [0, 0, 0, 4] },
                { text: this.aRenseigner(tenantConfig?.nomSociete || null), bold: true },
                { text: this.aRenseigner(tenantConfig?.adresse ?? null), fontSize: 8 },
                { text: `N° Tél : ${this.aRenseigner(tenantConfig?.telephone ?? null)}`, fontSize: 8 },
                { text: `N° immatriculation employeur : ${this.aRenseigner(tenantConfig?.numeroImmatriculationEmployeur ?? null)}`, fontSize: 8 },
                { text: `N° RCS : ${this.aRenseigner(tenantConfig?.numeroRegistreCommerce ?? null)}`, fontSize: 8 },
                { text: `N° NIF : ${this.aRenseigner(tenantConfig?.numeroIdentifiantFiscal ?? null)}`, fontSize: 8 },
              ],
              margin: [4, 4, 4, 4],
            },
            {},
            {
              colSpan: 2,
              alignment: 'right',
              stack: [
                { text: titre, bold: true, fontSize: 12 },
                { text: `${this.MOIS_LABEL[bulletin.mois - 1]} ${bulletin.annee}${versionLabel}`, fontSize: 9, margin: [0, 2, 0, 6] },
                { text: `Période du : ${this.formatDate(premierJour)} au ${this.formatDate(dernierJour)}`, fontSize: 9, bold: true },
              ],
              margin: [4, 4, 4, 4],
            },
            {},
          ],
          [
            champInfo('Matricule', salarie.matricule), champInfo('Niveau / Statut', salarie.statut),
            champInfo('Ancienneté', this.formatDate(dateAnciennete)), champInfo('N° immatriculation sociale', salarie.numeroSS),
          ],
          [
            champInfo('Horaire', horaireMensuel != null ? horaireMensuel : null), champInfo('Emploi occupé', salarie.poste),
            champInfo(`Salaire (${deviseLabel})`, this.formatMontant(bulletin.salaireBase)), champInfo('Service', null),
          ],
          [
            champInfo('Département', salarie.departement), champInfo('Enfant(s)', salarie.nbEnfantsCharge ?? 0),
            { colSpan: 2, ...champInfo('Commentaire', null) }, {},
          ],
          [
            {
              colSpan: 2,
              stack: [
                { text: 'CONGÉS', bold: true, fontSize: 9, margin: [0, 4, 0, 3] },
                { text: `Acquis : ${congesAcquis}   |   Reste : ${round2(congesAcquis - congesPris)}   |   Pris : ${congesPris}`, fontSize: 8 },
                ...[0, 1, 2].map((i) => ({
                  text: congesPeriode[i]
                    ? `Congés : du ${this.formatDate(congesPeriode[i].debut)} au ${this.formatDate(congesPeriode[i].fin)}`
                    : 'Congés : du ................ au ................',
                  fontSize: 8, margin: [0, 1, 0, 0],
                })),
              ],
              margin: [4, 4, 4, 4],
            },
            {},
            {
              colSpan: 2,
              stack: [
                { text: `${civilite} ${salarie.firstName} ${salarie.lastName}`.trim(), bold: true, fontSize: 9, margin: [0, 4, 0, 2] },
                { text: adresseSalarie || '-', fontSize: 8 },
              ],
              margin: [4, 4, 4, 4],
            },
            {},
          ],
        ],
      },
      margin: [0, 0, 0, 10],
    };

    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 9 },
      content: [
        ficheDePaieTable,
        { text: `Devise : ${deviseLabel}`, bold: true, fontSize: 9, margin: [0, 0, 0, 6] },
        {
          table: { widths: [58, '*', 25, 55, 30, 50, 30, 50], body: tableBody },
          fontSize: 8,
          // Grille verticale complète (séparateurs de colonnes + bordure extérieure) mais
          // SANS ligne horizontale entre chaque rubrique — seulement au-dessus (bordure
          // haute), entre les 2 lignes d'en-tête, sous l'en-tête, et en bas du tableau.
          // Reproduit fidèlement l'exemplaire Sage fourni (aucune ligne de séparation entre
          // les rubriques elles-mêmes).
          layout: {
            hLineWidth: (i: number, node: any) => (i <= 2 || i === node.table.body.length ? 1 : 0),
            vLineWidth: () => 1,
          },
          margin: [0, 0, 0, 4],
        },
        tableCumuls,
        bulletin.datePaiement
          ? { text: `Paiement : ${bulletin.datePaiement} — ${bulletin.modePaiement || '-'}${bulletin.referencePaiement ? ` (réf. ${bulletin.referencePaiement})` : ''}`, fontSize: 8, margin: [0, 0, 0, 10] }
          : { text: '' },
        {
          text: 'Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.',
          bold: true,
          fontSize: 8,
          margin: [0, 6, 0, 20],
        },
        {
          columns: [
            { width: '50%', stack: [{ text: 'Employeur,', fontSize: 9 }, { text: '\n\n\n' }] },
            { width: '50%', stack: [{ text: 'Employé,', fontSize: 9 }, { text: '\n\n\n' }] },
          ],
        },
        { text: `Généré le ${new Date().toLocaleDateString('fr-FR')}`, alignment: 'right', italics: true, fontSize: 8 },
      ],
    };

    const buffer: Buffer = await pdfmake.createPdf(docDefinition).getBuffer();

    if (persister && !bulletin.pdfHash) {
      bulletin.pdfHash = createHash('sha256').update(buffer).digest('hex');
      await this.repo.save(bulletin);
    }

    return buffer;
  }
}
