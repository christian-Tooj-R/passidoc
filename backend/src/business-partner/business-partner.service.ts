import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { OutilBp } from '../entities/outil-bp.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';
import { User } from '../entities/user.entity';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';
import { Canvas } from '../canvas/canvas.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { QuestionnaireAdnGlobal } from '../entities/questionnaire-adn-global.entity';
import { ControleInterne } from '../entities/controle-interne.entity';
import { ObjectifsClient } from '../entities/objectifs-client.entity';
import { SyntheseCloture } from '../entities/synthese-cloture.entity';
import { FluxMensuel } from '../entities/flux-mensuel.entity';
import { Fournisseur } from '../entities/fournisseur.entity';
import { BalanceMensuelle } from '../entities/balance-mensuelle.entity';
import { Mission } from '../entities/mission.entity';
import { Secteur } from '../entities/secteur.entity';
import { ClientsService } from '../clients/clients.service';
import { aujourdhuiIso } from '../saisie-temps/affaires.service';
import {
  OUTILS_BP, OutilBpCode, ROLES_VALIDATION_BP, contenuVide, estOutilBp, normaliserContenu, repriseAncienne, texteOutilsBp,
} from './outils-bp.util';
import { DonneesBp, construireSuggestions, profilAuto, tiersParMois } from './suggestions-bp.util';
import { consigneIa, lireReponseIa, zonesIa } from './ia-bp.util';

/** D'où vient le contenu affiché : enregistré, repris de N-1, repris des anciens onglets, ou vide. */
export type OrigineOutilBp = 'ENREGISTRE' | 'REPRISE_N1' | 'REPRISE_ANCIENNE' | 'VIDE';

type Personne = { id: number; nom: string } | null;

@Injectable()
export class BusinessPartnerService {
  private readonly logger = new Logger(BusinessPartnerService.name);

  constructor(
    @InjectRepository(OutilBp) private repo: Repository<OutilBp>,
    @InjectRepository(Exercice) private exerciceRepo: Repository<Exercice>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AnalyseStrategique) private analyseRepo: Repository<AnalyseStrategique>,
    @InjectRepository(Canvas) private canvasRepo: Repository<Canvas>,
    @InjectRepository(FicheIdentite) private ficheRepo: Repository<FicheIdentite>,
    @InjectRepository(QuestionnaireAdnGlobal) private adnRepo: Repository<QuestionnaireAdnGlobal>,
    @InjectRepository(ControleInterne) private controleRepo: Repository<ControleInterne>,
    @InjectRepository(ObjectifsClient) private objectifsRepo: Repository<ObjectifsClient>,
    @InjectRepository(SyntheseCloture) private syntheseRepo: Repository<SyntheseCloture>,
    @InjectRepository(FluxMensuel) private fluxRepo: Repository<FluxMensuel>,
    @InjectRepository(Fournisseur) private fournisseurRepo: Repository<Fournisseur>,
    @InjectRepository(BalanceMensuelle) private balanceRepo: Repository<BalanceMensuelle>,
    @InjectRepository(Mission) private missionRepo: Repository<Mission>,
    @InjectRepository(Secteur) private secteurRepo: Repository<Secteur>,
    private clientsService: ClientsService,
    private config: ConfigService,
  ) {}

  // ── Lecture ──

  /** Les 9 outils de l'exercice, l'exercice précédent (comparaison N / N-1) et les droits du lecteur. */
  async tableau(clientId: number, exerciceId: number, user: User) {
    await this.clientsService.findOneForUser(clientId, user);
    const exercice = await this.exerciceDuDossier(clientId, exerciceId);
    const lignes = await this.repo.find({ where: { clientId, exerciceId } });
    const precedent = await this.exerciceRepo.findOne({
      where: { clientId, annee: LessThan(exercice.annee) }, order: { annee: 'DESC' },
    });
    const lignesN1 = precedent ? await this.repo.find({ where: { clientId, exerciceId: precedent.id } }) : [];

    const aReprendre = OUTILS_BP.some(o => ['SWOT', 'PORTER', 'BMC'].includes(o)
      && !lignes.some(l => l.outil === o) && !lignesN1.some(l => l.outil === o));
    const [analyse, canvas] = aReprendre ? await this.anciensOnglets(clientId, exerciceId) : [null, null];
    const personnes = await this.personnes([...lignes, ...lignesN1].map(l => l.valideParId));

    const outils = OUTILS_BP.map(outil => {
      const l = lignes.find(x => x.outil === outil);
      if (l) return this.vue(l, personnes, 'ENREGISTRE');
      const n1 = lignesN1.find(x => x.outil === outil);
      const reprise = n1 ? normaliserContenu(outil, n1.contenu) : repriseAncienne(outil, analyse, canvas);
      return {
        outil, contenu: reprise ?? contenuVide(outil), statut: 'BROUILLON', valideLe: null, validePar: null, modifieLe: null,
        origine: (n1 ? 'REPRISE_N1' : reprise ? 'REPRISE_ANCIENNE' : 'VIDE') as OrigineOutilBp,
      };
    });

    const peutModifier = exercice.statut !== ExerciceStatut.CLOTURE && await this.peutModifier(clientId, user);
    return {
      exercice: { id: exercice.id, annee: exercice.annee, cloture: exercice.statut === ExerciceStatut.CLOTURE },
      precedent: precedent ? {
        id: precedent.id, annee: precedent.annee,
        outils: Object.fromEntries(lignesN1.map(l => [l.outil, this.vue(l, personnes, 'ENREGISTRE')])),
      } : null,
      outils,
      droits: { modifier: peutModifier, valider: peutModifier && ROLES_VALIDATION_BP.includes(user.role) },
    };
  }

  /** Suggestions issues des données du dossier + profil client auto-généré (Persona / ICP). */
  async suggestions(clientId: number, exerciceId: number, user: User) {
    const donnees = await this.donnees(clientId, exerciceId, user);
    return { suggestions: construireSuggestions(donnees), profil: profilAuto(donnees) };
  }

  /**
   * Suggestions IA pour un outil (document, partie 5 : « l'IA PASSIDOC propose des alertes et
   * suggestions ») : le modèle reçoit les constats tirés du dossier et les outils déjà saisis.
   */
  async suggestionsIa(clientId: number, exerciceId: number, outil: string, user: User) {
    const code = this.outil(outil);
    if (!Object.keys(zonesIa(code)).length) throw new BadRequestException("Pas de suggestions IA pour cet outil");
    const cle = this.config.get<string>('GROQ_API_KEY');
    if (!cle) throw new ServiceUnavailableException("Suggestions IA indisponibles : clé GROQ_API_KEY absente");
    const donnees = await this.donnees(clientId, exerciceId, user);
    const lignes = await this.repo.find({ where: { clientId, exerciceId } });
    const profil = profilAuto(donnees);
    const regles = construireSuggestions(donnees);
    const actuel = lignes.find(l => l.outil === code);
    const dejaSaisis = [
      ...JSON.stringify(actuel?.contenu ?? {}).match(/"(?:texte|nom)":"((?:[^"\\]|\\.)*)"/g)?.map(m => m.replace(/^"(?:texte|nom)":"|"$/g, '')) ?? [],
    ];
    const contexte = [
      `Exercice ${donnees.annee}. Secteur : ${donnees.client.secteur ?? 'non renseigné'}.`,
      `Profil : ${JSON.stringify(profil)}`,
      'Constats tirés du dossier :',
      ...regles.slice(0, 60).map(s => `- [${s.source}] ${s.texte}`),
      ...texteOutilsBp(donnees.annee, lignes),
    ];
    const { systeme, utilisateur } = consigneIa(code, contexte);
    const groq = new Groq({ apiKey: cle });
    const appel = (json: boolean) => groq.chat.completions.create({
      model: this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: systeme }, { role: 'user', content: utilisateur }],
      max_tokens: 2000, temperature: 0.4, reasoning_effort: 'low',
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    } as any) as Promise<any>;
    try {
      const r = await appel(true).catch(() => appel(false));
      const texte = r?.choices?.[0]?.message?.content ?? '';
      return { suggestions: lireReponseIa(code, texte, [...dejaSaisis, ...regles.map(s => s.texte)]) };
    } catch (e) {
      this.logger.error('Suggestions IA BP', e as any);
      throw new ServiceUnavailableException('Suggestions IA temporairement indisponibles');
    }
  }

  private async donnees(clientId: number, exerciceId: number, user: User): Promise<DonneesBp> {
    const client = await this.clientsService.findOneForUser(clientId, user);
    const exercice = await this.exerciceDuDossier(clientId, exerciceId);
    const parExercice = { order: { updatedAt: 'DESC' as const, id: 'DESC' as const } };
    const [fiche, adn, controle, objectifs, syntheses, exercices, flux, nbFournisseurs, balances, missions, secteurs, entretien] = await Promise.all([
      this.ficheRepo.findOne({ where: { client: { id: clientId } } }),
      this.adnRepo.findOne({ where: { clientId } }),
      this.controleRepo.findOne({ where: { clientId, exerciceId }, ...parExercice }),
      this.objectifsRepo.findOne({ where: { clientId, exerciceId }, ...parExercice }),
      this.syntheseRepo.find({ where: { client: { id: clientId } } }),
      this.exerciceRepo.find({ where: { clientId } }),
      this.fluxRepo.find({ where: { client: { id: clientId }, annee: exercice.annee, statut: In(['MANQUANT', 'EN_RETARD']) } }),
      this.fournisseurRepo.count({ where: { client: { id: clientId } } }),
      this.balanceRepo.find({ where: { clientId, annee: exercice.annee } }),
      this.missionRepo.find({ where: { clientId, archivee: false } }),
      client.secteurActivite
        ? this.secteurRepo.find({ where: [{ code: client.secteurActivite, tenantId: client.tenantId }, { code: client.secteurActivite, tenantId: IsNull() }] })
        : Promise.resolve([] as Secteur[]),
      this.repo.findOne({ where: { clientId, exerciceId, outil: 'ENTRETIEN' } }),
    ]);
    const secteur = (secteurs.find(s => s.tenantId === client.tenantId) ?? secteurs[0])?.label ?? client.secteurActivite ?? null;
    const donnees = {
      annee: exercice.annee,
      aujourdhui: aujourdhuiIso(),
      client: { secteur, site: client.site, createdAt: client.createdAt },
      fiche, adn, controle, objectifs,
      syntheses: syntheses.map(s => ({
        exercice: s.exercice, ca: s.ca, caPrecedent: s.caPrecedent, ebe: s.ebe, resultatNet: s.resultatNet,
        zonesExoneration: s.zonesExoneration, zonesRisque: s.zonesRisque,
      })),
      exercices: exercices.map(e => ({ annee: e.annee, dateCloture: e.dateCloture, clotureLeAt: e.clotureLeAt })),
      piecesEnRetard: flux.map(f => ({ type: f.type, mois: f.mois })),
      nbFournisseurs,
      tiersParMois: tiersParMois(balances),
      missions: missions.map(m => ({ statut: m.statut, cycle: m.cycle })),
      entretien: entretien?.contenu ?? null,
    };
    return donnees;
  }

  // ── Écriture ──

  /** Enregistre un outil : toute modification le repasse en brouillon (à revalider). */
  async enregistrer(clientId: number, exerciceId: number, outil: string, contenu: unknown, user: User) {
    const code = this.outil(outil);
    await this.clientsService.assertCanEdit(clientId, user);
    await this.exerciceModifiable(clientId, exerciceId);
    let ligne = await this.repo.findOne({ where: { clientId, exerciceId, outil: code } });
    if (!ligne) ligne = this.repo.create({ clientId, exerciceId, outil: code });
    Object.assign(ligne, {
      contenu: normaliserContenu(code, contenu), statut: 'BROUILLON', valideParId: null, valideLe: null, commentaireValidation: null,
      modifieParId: user.id,
    });
    ligne = await this.repo.save(ligne);
    return this.vue(ligne, new Map(), 'ENREGISTRE');
  }

  /** « Seuls les collaborateurs BP+ peuvent valider et publier » (Admin, Expert, Chef d'antenne, Chef de mission). */
  async valider(clientId: number, exerciceId: number, outil: string, user: User, commentaire?: string) {
    const code = this.outil(outil);
    if (!ROLES_VALIDATION_BP.includes(user.role)) {
      throw new ForbiddenException("Seuls l'administrateur, l'expert-comptable et les chefs d'antenne ou de mission valident les outils BP");
    }
    await this.clientsService.assertCanEdit(clientId, user);
    await this.exerciceModifiable(clientId, exerciceId);
    const ligne = await this.repo.findOne({ where: { clientId, exerciceId, outil: code } });
    if (!ligne) throw new BadRequestException("Enregistrez l'outil avant de le valider");
    Object.assign(ligne, {
      statut: 'VALIDE', valideParId: user.id, valideLe: new Date(), commentaireValidation: commentaire?.trim().slice(0, 1000) || null,
    });
    const enregistree = await this.repo.save(ligne);
    return this.vue(enregistree, await this.personnes([user.id]), 'ENREGISTRE');
  }

  // ── Interne ──

  private outil(outil: string): OutilBpCode {
    const code = String(outil ?? '').toUpperCase();
    if (!estOutilBp(code)) throw new BadRequestException(`Outil inconnu : ${outil}`);
    return code;
  }

  private async exerciceDuDossier(clientId: number, exerciceId: number): Promise<Exercice> {
    const exercice = await this.exerciceRepo.findOne({ where: { id: exerciceId, clientId } });
    if (!exercice) throw new NotFoundException('Exercice introuvable pour ce dossier');
    return exercice;
  }

  private async exerciceModifiable(clientId: number, exerciceId: number) {
    const exercice = await this.exerciceDuDossier(clientId, exerciceId);
    if (exercice.statut === ExerciceStatut.CLOTURE) throw new ForbiddenException('Exercice clôturé — données en lecture seule');
  }

  private async peutModifier(clientId: number, user: User): Promise<boolean> {
    try {
      await this.clientsService.assertCanEdit(clientId, user);
      return true;
    } catch {
      return false;
    }
  }

  /** Contenu des anciens onglets « Stratégie » (de l'exercice, sinon le plus récent) et « Modèle Canvas ». */
  private async anciensOnglets(clientId: number, exerciceId: number): Promise<[AnalyseStrategique | null, Canvas | null]> {
    const ordre = { order: { updatedAt: 'DESC' as const, id: 'DESC' as const } };
    const analyse = await this.analyseRepo.findOne({ where: { clientId, exerciceId }, ...ordre })
      ?? await this.analyseRepo.findOne({ where: { clientId }, ...ordre });
    const canvas = await this.canvasRepo.findOne({ where: { clientId } });
    return [analyse, canvas];
  }

  private async personnes(ids: (number | null)[]): Promise<Map<number, Personne>> {
    const uniques = [...new Set(ids.filter((i): i is number => !!i))];
    if (!uniques.length) return new Map();
    const users = await this.userRepo.find({ where: { id: In(uniques) }, select: ['id', 'firstName', 'lastName'] });
    return new Map(users.map(u => [u.id, { id: u.id, nom: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() }]));
  }

  private vue(l: OutilBp, personnes: Map<number, Personne>, origine: OrigineOutilBp) {
    const outil = l.outil as OutilBpCode;
    return {
      outil,
      contenu: normaliserContenu(outil, l.contenu),
      statut: l.statut,
      valideLe: l.valideLe,
      validePar: l.valideParId ? personnes.get(l.valideParId) ?? { id: l.valideParId, nom: '' } : null,
      commentaire: l.commentaireValidation ?? null,
      modifieLe: l.updatedAt,
      origine,
    };
  }
}
