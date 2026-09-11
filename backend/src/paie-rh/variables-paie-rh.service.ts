import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LignePaieLibreRh, OrigineLignePaieRh, VariablePaieRh } from '../entities/variable-paie-rh.entity';
import { CongeAbsence, StatutConge, TypeConge } from '../entities/conge-absence.entity';
import { AcompteSalarie, StatutAcompteSalarie } from '../entities/acompte-salarie.entity';
import { ValeurActiviteRh } from '../entities/valeur-activite-rh.entity';
import { UpsertVariablePaieRhDto } from './dto/variable-paie-rh.dto';
import { ConstantesPaieRhService } from './constantes-paie-rh.service';
import { ContratsTravailService } from './contrats-travail.service';
import { resoudreConstante } from './constante-resolution.util';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Gère les variables de paie mensuelles des collaborateurs INTERNES AFYM.
 *
 * MVP2 — intégration réelle avec le circuit congés/absences existant (`CongeAbsence`,
 * statut `APPROUVEE`) : `synchroniserAbsences()` recalcule les lignes `absences` d'origine
 * `CONGE_ABSENCE` à partir des congés validés qui chevauchent la période, en appliquant un
 * taux de maintien de salaire PARAMÉTRABLE par type de congé (`ConstantePaieRh`, code
 * `MAINTIEN_<TYPE_CONGE>` — fusionné depuis l'ancien `ParametrePaieRh`, voir
 * Doc/MODULE_PAIE_RH_NOTES.md) — jamais de règle Réunion/Madagascar ni de barème légal codé en
 * dur. Les lignes saisies manuellement (sans `origine` ou `origine: MANUELLE`) sont
 * préservées ; seules les lignes `CONGE_ABSENCE` sont régénérées à chaque appel
 * (idempotent). Voir Doc/MODULE_PAIE_RH_NOTES.md pour le détail de l'hypothèse de
 * valorisation (jours ouvrés/mois, formule journalière).
 *
 * De même, `synchroniserAcomptes()` injecte les acomptes VALIDE de la période comme lignes
 * `retenuesDiverses` d'origine `ACOMPTE`.
 */
@Injectable()
export class VariablesPaieRhService {
  constructor(
    @InjectRepository(VariablePaieRh) private repo: Repository<VariablePaieRh>,
    @InjectRepository(CongeAbsence) private congeRepo: Repository<CongeAbsence>,
    @InjectRepository(AcompteSalarie) private acompteRepo: Repository<AcompteSalarie>,
    @InjectRepository(ValeurActiviteRh) private activiteRepo: Repository<ValeurActiviteRh>,
    private constantesService: ConstantesPaieRhService,
    private contratsService: ContratsTravailService,
  ) {}

  async upsert(dto: UpsertVariablePaieRhDto, tenantId: number, userId: number): Promise<VariablePaieRh> {
    // Contrat en vigueur PENDANT LA PÉRIODE saisie (mois/année du DTO), pas forcément le
    // contrat actuellement actif — voir ContratsTravailService.findPourPeriode().
    const contrat = await this.contratsService.findPourPeriode(dto.salarieId, dto.mois, dto.annee, tenantId);
    if (!contrat) throw new NotFoundException(`Aucun contrat en vigueur pour le salarié ${dto.salarieId} sur la période ${dto.mois}/${dto.annee}`);

    let variable = await this.repo.findOne({
      where: { salarieId: dto.salarieId, mois: dto.mois, annee: dto.annee, tenantId },
    });

    if (variable) {
      Object.assign(variable, dto);
    } else {
      variable = this.repo.create({ ...dto, tenantId, createdById: userId });
    }
    return this.repo.save(variable);
  }

  findOneByPeriode(salarieId: number, mois: number, annee: number, tenantId: number): Promise<VariablePaieRh | null> {
    return this.repo.findOne({ where: { salarieId, mois, annee, tenantId } });
  }

  findBySalarie(salarieId: number, tenantId: number): Promise<VariablePaieRh[]> {
    return this.repo.find({
      where: { salarieId, tenantId },
      order: { annee: 'DESC', mois: 'DESC' },
    });
  }

  async remove(id: number, tenantId: number): Promise<void> {
    const variable = await this.repo.findOne({ where: { id, tenantId } });
    if (!variable) throw new NotFoundException(`Variable de paie RH ${id} introuvable`);
    await this.repo.delete(id);
  }

  /**
   * Recalcule les lignes `absences` d'origine CONGE_ABSENCE pour un salarié/mois/année,
   * à partir des `CongeAbsence` APPROUVEE qui chevauchent la période. Crée la variable si
   * elle n'existe pas encore. Retourne la variable à jour (créée ou mise à jour).
   */
  async synchroniserAbsences(salarieId: number, mois: number, annee: number, tenantId: number): Promise<VariablePaieRh> {
    const contrat = await this.contratsService.findPourPeriode(salarieId, mois, annee, tenantId);
    if (!contrat) throw new NotFoundException(`Aucun contrat en vigueur pour le salarié ${salarieId} sur la période ${mois}/${annee}`);

    const debut = `${annee}-${String(mois).padStart(2, '0')}-01`;
    const finDuMois = new Date(annee, mois, 0);
    const fin = `${annee}-${String(mois).padStart(2, '0')}-${String(finDuMois.getDate()).padStart(2, '0')}`;

    const conges = await this.congeRepo
      .createQueryBuilder('c')
      .where('c.userId = :salarieId', { salarieId })
      .andWhere('c.statut = :statut', { statut: StatutConge.APPROUVEE })
      .andWhere('c.dateDebut <= :fin', { fin })
      .andWhere('c.dateFin >= :debut', { debut })
      .getMany();

    const constantes = await this.constantesService.findByRegime(contrat.regimePaieCode, tenantId);
    const joursOuvresMois = this.getConstanteValeur(constantes, 'JOURS_OUVRES_MOIS_DEFAUT', 22);
    const salaireJournalier = joursOuvresMois > 0 ? Number(contrat.salaireBase) / joursOuvresMois : 0;

    const lignesAbsences: LignePaieLibreRh[] = conges.map((c) => {
      const tauxMaintien = this.getConstanteValeur(constantes, `MAINTIEN_${c.typeConge}`, 100);
      const montant = round2(salaireJournalier * Number(c.nombreJours) * (1 - tauxMaintien / 100));
      return {
        libelle: `${this.libelleTypeConge(c.typeConge)} (${c.dateDebut} → ${c.dateFin}, ${c.nombreJours} j, maintien ${tauxMaintien}%)`,
        montant,
        origine: OrigineLignePaieRh.CONGE_ABSENCE,
        sourceId: c.id,
      };
    });

    let variable = await this.repo.findOne({ where: { salarieId, mois, annee, tenantId } });
    const absencesManuelles = (variable?.absences ?? []).filter(
      (l) => !l.origine || l.origine === OrigineLignePaieRh.MANUELLE,
    );

    if (variable) {
      variable.absences = [...absencesManuelles, ...lignesAbsences];
      await this.repo.save(variable);
    } else {
      variable = this.repo.create({
        salarieId, mois, annee, tenantId,
        absences: lignesAbsences,
      });
      await this.repo.save(variable);
    }
    return variable;
  }

  /**
   * Injecte les acomptes de la période comme lignes `retenuesDiverses` d'origine ACOMPTE.
   * Prend en compte les statuts VALIDE (pas encore déduit — aperçu avant génération) ET
   * DEDUIT (déjà déduit d'un bulletin de cette période) : une fois un acompte déduit pour
   * un mois donné, il doit rester reflété dans tout recalcul ultérieur de ce même mois
   * (ex: une régularisation) — seul un acompte ANNULE n'impacte plus la paie.
   */
  async synchroniserAcomptes(salarieId: number, mois: number, annee: number, tenantId: number): Promise<VariablePaieRh> {
    const acomptes = await this.acompteRepo.find({
      where: {
        salarieId, periodeMois: mois, periodeAnnee: annee, tenantId,
        statut: In([StatutAcompteSalarie.VALIDE, StatutAcompteSalarie.DEDUIT]),
      },
    });

    const lignesAcomptes: LignePaieLibreRh[] = acomptes.map((a) => ({
      libelle: `Acompte du ${a.dateDemande}${a.motif ? ` — ${a.motif}` : ''}`,
      montant: Number(a.montant),
      origine: OrigineLignePaieRh.ACOMPTE,
      sourceId: a.id,
    }));

    let variable = await this.repo.findOne({ where: { salarieId, mois, annee, tenantId } });
    const retenuesManuelles = (variable?.retenuesDiverses ?? []).filter(
      (l) => !l.origine || l.origine === OrigineLignePaieRh.MANUELLE,
    );

    if (variable) {
      variable.retenuesDiverses = [...retenuesManuelles, ...lignesAcomptes];
      await this.repo.save(variable);
    } else {
      variable = this.repo.create({
        salarieId, mois, annee, tenantId,
        retenuesDiverses: lignesAcomptes,
      });
      await this.repo.save(variable);
    }
    return variable;
  }

  /**
   * Synchronise `VariablePaieRh.heuresSupplementaires` depuis le total mensuel déjà calculé
   * dans la "Feuille d'activité" journalière (`ValeurActiviteRh`, code `HEURES_SUP` — voir
   * `ActiviteJourRhService.calculer()`), sur le même principe que `synchroniserAbsences()`/
   * `synchroniserAcomptes()` : rejoué à chaque calcul de bulletin, jamais une copie figée.
   *
   * Ne s'applique QUE si au moins une ligne d'activité existe pour ce salarié/mois/année —
   * sinon la saisie manuelle existante (le cas normal si personne n'utilise l'écran
   * "Activité" pour ce salarié) est conservée intacte. Une fois la feuille d'activité
   * calculée pour cette période, ce total prend le dessus à CHAQUE recalcul du bulletin —
   * une correction manuelle ultérieure de `heuresSupplementaires` sera donc écrasée au
   * prochain recalcul, sauf à modifier plutôt les lignes de la feuille d'activité elle-même
   * (crayon ✏️ + case "Recalculer les modifications manuelles" décochée).
   */
  async synchroniserHeuresSup(salarieId: number, mois: number, annee: number, tenantId: number): Promise<VariablePaieRh | null> {
    const debut = `${annee}-${String(mois).padStart(2, '0')}-01`;
    const finDuMois = new Date(annee, mois, 0);
    const fin = `${annee}-${String(mois).padStart(2, '0')}-${String(finDuMois.getDate()).padStart(2, '0')}`;

    const lignes = await this.activiteRepo
      .createQueryBuilder('a')
      .where('a.salarieId = :salarieId', { salarieId })
      .andWhere('a.tenantId = :tenantId', { tenantId })
      .andWhere("a.variableCode = 'HEURES_SUP'")
      .andWhere('a.date >= :debut', { debut })
      .andWhere('a.date <= :fin', { fin })
      .getMany();

    if (!lignes.length) return null;

    const totalHeuresSup = round2(lignes.reduce((s, l) => s + Number(l.valeur), 0));

    let variable = await this.repo.findOne({ where: { salarieId, mois, annee, tenantId } });
    if (variable) {
      variable.heuresSupplementaires = totalHeuresSup;
    } else {
      variable = this.repo.create({ salarieId, mois, annee, tenantId, heuresSupplementaires: totalHeuresSup });
    }
    return this.repo.save(variable);
  }

  /**
   * Vue globale "Activité" (~"Feuille d'activité" RADIAN) : pour chaque salarié dont le
   * contrat était en vigueur pendant la période, un résumé des variables déjà saisies/
   * synchronisées ce mois-ci. Le détail (feuille d'activité individuelle) reste le même
   * dialogue "Bulletin du salarié" déjà utilisé depuis le cycle mensuel — pas de nouvel
   * écran dupliqué, seulement une entrée directe sans attendre la génération d'un bulletin.
   */
  async findActiviteParPeriode(mois: number, annee: number, tenantId: number): Promise<Array<{
    salarieId: number;
    salarie?: { id: number; firstName: string; lastName: string; site: string };
    contratId: number;
    variableId: number | null;
    statut: VariablePaieRh['statut'] | null;
    heuresSupplementaires: number;
    totalPrimes: number;
    totalAbsences: number;
    totalAvantagesNature: number;
    totalRetenues: number;
    nbAbsencesAuto: number;
  }>> {
    const contrats = await this.contratsService.findTousPourPeriode(mois, annee, tenantId);
    const variables = await this.repo.find({ where: { mois, annee, tenantId } });
    const varParSalarie = new Map(variables.map((v) => [v.salarieId, v]));
    const somme = (lignes: LignePaieLibreRh[] | null | undefined) =>
      round2((lignes ?? []).reduce((s, l) => s + Number(l.montant), 0));

    return contrats.map((c) => {
      const v = varParSalarie.get(c.salarieId) ?? null;
      return {
        salarieId: c.salarieId,
        salarie: (c as any).salarie
          ? {
              id: (c as any).salarie.id, firstName: (c as any).salarie.firstName,
              lastName: (c as any).salarie.lastName, site: (c as any).salarie.site,
              devise: (c as any).salarie.devise,
            }
          : undefined,
        contratId: c.id,
        variableId: v?.id ?? null,
        statut: v?.statut ?? null,
        heuresSupplementaires: v ? Number(v.heuresSupplementaires) : 0,
        totalPrimes: somme(v?.primes),
        totalAbsences: somme(v?.absences),
        totalAvantagesNature: somme(v?.avantagesNature),
        totalRetenues: somme(v?.retenuesDiverses),
        nbAbsencesAuto: (v?.absences ?? []).filter((l) => l.origine === OrigineLignePaieRh.CONGE_ABSENCE).length,
      };
    });
  }

  /**
   * "Calcul d'activité" en masse (~RADIAN) : resynchronise absences + acomptes pour TOUS les
   * salariés en contrat sur la période, sans avoir à ouvrir un par un le dialogue bulletin.
   */
  async recalculerActivitePeriode(mois: number, annee: number, tenantId: number): Promise<{
    traites: number;
    erreurs: Array<{ salarieId: number; message: string }>;
  }> {
    const contrats = await this.contratsService.findTousPourPeriode(mois, annee, tenantId);
    let traites = 0;
    const erreurs: Array<{ salarieId: number; message: string }> = [];
    for (const c of contrats) {
      try {
        await this.synchroniserAbsences(c.salarieId, mois, annee, tenantId);
        await this.synchroniserAcomptes(c.salarieId, mois, annee, tenantId);
        traites++;
      } catch (e: any) {
        erreurs.push({ salarieId: c.salarieId, message: e?.message ?? 'Erreur inconnue' });
      }
    }
    return { traites, erreurs };
  }

  /** Voir `MoteurCalculPaieRhService.getConstanteValeur()` — même principe de repli. */
  private getConstanteValeur(constantes: Parameters<typeof resoudreConstante>[1], code: string, defaut: number): number {
    try {
      return resoudreConstante(code, constantes);
    } catch {
      return defaut;
    }
  }

  private libelleTypeConge(t: TypeConge): string {
    const labels: Record<string, string> = {
      CONGES_PAYES: 'Congés payés',
      MALADIE: 'Maladie',
      MATERNITE: 'Maternité',
      PATERNITE: 'Paternité',
      SANS_SOLDE: 'Sans solde',
      EVENEMENT_FAMILIAL: 'Événement familial',
      RECUPERATION: 'Récupération',
      AUTRE: 'Autre',
    };
    return labels[t] ?? t;
  }
}
