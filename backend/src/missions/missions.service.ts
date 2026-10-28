import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Mission, TypeMission } from '../entities/mission.entity';
import { MissionHistorique } from '../entities/mission-historique.entity';
import { RecommandationCycle } from '../entities/recommandation-cycle.entity';
import { Client } from '../entities/client.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';
import { Secteur } from '../entities/secteur.entity';
import { User, UserRole } from '../entities/user.entity';
import { ClientsService } from '../clients/clients.service';
import { aujourdhuiIso } from '../saisie-temps/affaires.service';
import { CreateMissionDto, FiltresMissionsDto, RecommandationCycleDto, UpdateMissionDto } from './dto/mission.dto';
import {
  CYCLES_MISSIONS, STATUT_PAR_DEFAUT, estARelancer, estCycle, filtrerMissions, peutSupprimer, synthese,
} from './missions.util';

type Personne = { id: number; firstName: string; lastName: string } | null;

/** Mission telle qu'exposée par l'API : responsable réduit à son nom (jamais l'entité User). */
export type MissionVue = Omit<Mission, 'responsable' | 'client'> & { responsable: Personne; aRelancer: boolean };

const personne = (u?: User | null): Personne =>
  u ? { id: u.id, firstName: u.firstName, lastName: u.lastName } : null;

/** Vue cabinet : toutes les missions du portefeuille visible (CDC §5). */
const ROLES_VUE_COMPLETE = [UserRole.ADMIN, UserRole.EXPERT_COMPTABLE];

@Injectable()
export class MissionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MissionsService.name);

  constructor(
    @InjectRepository(Mission) private repo: Repository<Mission>,
    @InjectRepository(MissionHistorique) private histoRepo: Repository<MissionHistorique>,
    @InjectRepository(RecommandationCycle) private recoRepo: Repository<RecommandationCycle>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Exercice) private exerciceRepo: Repository<Exercice>,
    @InjectRepository(Secteur) private secteurRepo: Repository<Secteur>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private clientsService: ClientsService,
  ) {}

  /** Missions de l'ancien module : statut déduit de leur type (Réalisée → Acceptée…). */
  async onApplicationBootstrap() {
    try {
      const r = await this.repo.createQueryBuilder().update(Mission)
        .set({
          statut: () => `CASE "type" WHEN 'REALISEE' THEN 'ACCEPTEE' WHEN 'REFUSEE' THEN 'REFUSEE' ELSE 'PROPOSEE' END`,
          updatedAt: () => `"createdAt"`,   // « Dernière modif. » ne prend pas la date du déploiement
        })
        .where('statut IS NULL')
        .execute();
      if (r.affected) this.logger.log(`Statut de suivi attribué à ${r.affected} mission(s) existante(s)`);
    } catch (e: any) {
      this.logger.error(`Rattrapage des statuts de mission impossible (démarrage poursuivi) : ${e?.message ?? e}`);
    }
  }

  // ── Droits (CDC §7) ──────────────────────────────────────────────────────

  private async lireDossier(clientId: number, user: User): Promise<Client> {
    return this.clientsService.findOneForUser(clientId, user);
  }

  /**
   * Écriture sur les missions d'un dossier : intervenants du dossier (ou ADMIN / EXPERT),
   * jamais le gérant de pôle (lecture seule). Un COLLABORATEUR écrit dans l'onglet « Par
   * cycle » mais le pipeline (missions hors cycle) lui est en lecture seule.
   */
  private async verifierEcriture(clientId: number, user: User, horsCycle: boolean) {
    if (user.role === UserRole.GERANT_OUEST) {
      throw new ForbiddenException('Le module Missions est en lecture seule pour votre profil.');
    }
    await this.clientsService.assertCanEdit(clientId, user);
    if (horsCycle && user.role === UserRole.COLLABORATEUR) {
      throw new ForbiddenException('Les missions hors cycle se gèrent dans le pipeline, en lecture seule pour un collaborateur.');
    }
  }

  private async verifierExerciceOuvert(exerciceId: number | null | undefined, clientId: number) {
    if (!exerciceId) return null;
    const ex = await this.exerciceRepo.findOne({ where: { id: exerciceId, clientId } });
    if (!ex) throw new BadRequestException("Exercice introuvable pour ce dossier.");
    if (ex.statut === ExerciceStatut.CLOTURE) {
      throw new ForbiddenException('Exercice clôturé : la révision de ses cycles est en lecture seule.');
    }
    return ex;
  }

  private async verifierResponsable(responsableId: number | null | undefined, user: User) {
    if (!responsableId) return;
    const r = await this.userRepo.findOne({ where: { id: responsableId, tenantId: user.tenantId } });
    if (!r) throw new BadRequestException('Collaborateur responsable inconnu.');
  }

  private async charger(clientId: number, id: number): Promise<Mission> {
    const m = await this.repo.findOne({ where: { id, clientId }, relations: ['responsable'] });
    if (!m) throw new NotFoundException('Mission introuvable');
    return m;
  }

  private vue(m: Mission, aujourdhui = aujourdhuiIso()): MissionVue {
    const { responsable, client, ...champs } = m;
    return { ...champs, responsable: personne(responsable), aRelancer: estARelancer(m, aujourdhui) };
  }

  private async tracer(missionId: number, ancien: string | null, nouveau: string, user: User) {
    await this.histoRepo.save(this.histoRepo.create({
      missionId, ancienStatut: ancien, nouveauStatut: nouveau, auteurId: user.id,
      auteurNom: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
    }));
  }

  // ── Dossier : pipeline ───────────────────────────────────────────────────

  async lister(clientId: number, user: User): Promise<MissionVue[]> {
    await this.lireDossier(clientId, user);
    const missions = await this.repo.find({ where: { clientId }, relations: ['responsable'], order: { createdAt: 'DESC' } });
    const auj = aujourdhuiIso();
    return missions.map(m => this.vue(m, auj));
  }

  async syntheseDossier(clientId: number, user: User) {
    await this.lireDossier(clientId, user);
    return synthese(await this.repo.find({ where: { clientId } }), aujourdhuiIso());
  }

  async creer(clientId: number, dto: CreateMissionDto, user: User): Promise<MissionVue> {
    await this.verifierEcriture(clientId, user, !dto.cycle);
    const exercice = dto.cycle ? await this.verifierExerciceOuvert(dto.exerciceId, clientId) : null;
    await this.verifierResponsable(dto.responsableId, user);
    const statut = dto.statut ?? STATUT_PAR_DEFAUT;
    const saved = await this.repo.save(this.repo.create({
      ...dto,
      clientId,
      type: dto.type ?? TypeMission.DETECTEE,
      statut,
      cycle: dto.cycle ?? null,
      exerciceId: dto.exerciceId ?? null,
      annee: dto.annee ?? exercice?.annee ?? new Date().getFullYear(),
      statutModifieLe: new Date(),
      creeParId: user.id,
    }));
    await this.tracer(saved.id, null, statut, user);
    return this.vue(await this.charger(clientId, saved.id));
  }

  async modifier(clientId: number, id: number, dto: UpdateMissionDto, user: User): Promise<MissionVue> {
    const mission = await this.charger(clientId, id);
    await this.verifierEcriture(clientId, user, !mission.cycle || dto.cycle === null);
    if (dto.responsableId !== undefined) await this.verifierResponsable(dto.responsableId, user);
    const changeStatut = dto.statut !== undefined && dto.statut !== mission.statut;
    await this.repo.update(id, { ...dto, ...(changeStatut ? { statutModifieLe: new Date() } : {}) });
    if (changeStatut) await this.tracer(id, mission.statut, dto.statut!, user);
    return this.vue(await this.charger(clientId, id));
  }

  /** R7 : seules les missions jamais soumises au client se suppriment ; les autres s'archivent. */
  async supprimer(clientId: number, id: number, user: User) {
    const mission = await this.charger(clientId, id);
    await this.verifierEcriture(clientId, user, !mission.cycle);
    if (!peutSupprimer(mission.statut)) {
      throw new BadRequestException('Une mission en discussion, acceptée ou refusée ne peut pas être supprimée : archivez-la.');
    }
    await this.repo.delete(id);
  }

  async historique(clientId: number, id: number, user: User) {
    await this.lireDossier(clientId, user);
    await this.charger(clientId, id);
    return this.histoRepo.find({ where: { missionId: id }, order: { createdAt: 'DESC', id: 'DESC' } });
  }

  // ── Dossier : onglet « Par cycle » ───────────────────────────────────────

  /**
   * Cycles de l'exercice : recommandations saisies et missions refusées lors d'exercices
   * antérieurs, qui réapparaissent « pour mémoire » (R5) tant qu'elles n'ont pas été reproposées.
   */
  async cycles(clientId: number, exerciceId: number | null, user: User) {
    await this.lireDossier(clientId, user);
    const recos = await this.recoRepo.find({ where: { clientId, exerciceId: exerciceId ?? IsNull() } });
    const recommandations: Record<string, { texte: string; updatedAt: Date }> = {};
    for (const r of recos) recommandations[r.cycle] = { texte: r.texte, updatedAt: r.updatedAt };

    let dejaRefusees: (MissionVue & { anneeRefus: number })[] = [];
    const exercice = exerciceId ? await this.exerciceRepo.findOne({ where: { id: exerciceId, clientId } }) : null;
    if (exercice) {
      const toutes = await this.repo.find({ where: { clientId }, relations: ['responsable'] });
      const reprises = new Set(toutes.map(m => m.repriseDeId).filter(Boolean));
      dejaRefusees = toutes
        .filter(m => m.statut === 'REFUSEE' && estCycle(m.cycle) && !reprises.has(m.id)
          && m.exerciceId !== exercice.id && (m.annee ?? 0) < exercice.annee)
        .map(m => ({ ...this.vue(m), anneeRefus: m.annee }));
    }
    return { cycles: CYCLES_MISSIONS, recommandations, dejaRefusees };
  }

  async enregistrerRecommandation(clientId: number, cycle: string, dto: RecommandationCycleDto, user: User) {
    if (!estCycle(cycle)) throw new BadRequestException('Cycle de révision inconnu.');
    await this.verifierEcriture(clientId, user, false);
    await this.verifierExerciceOuvert(dto.exerciceId, clientId);
    const exerciceId = dto.exerciceId ?? null;
    let reco = await this.recoRepo.findOne({ where: { clientId, cycle, exerciceId: exerciceId ?? IsNull() } });
    if (!reco) reco = this.recoRepo.create({ clientId, cycle, exerciceId });
    reco.texte = dto.texte ?? '';
    reco.auteurId = user.id;
    const saved = await this.recoRepo.save(reco);
    return { cycle, texte: saved.texte, updatedAt: saved.updatedAt };
  }

  // ── Vue cabinet (CDC §5) ─────────────────────────────────────────────────

  /**
   * Missions de tout le portefeuille visible : ADMIN / EXPERT_COMPTABLE = tout le cabinet ;
   * CHEF_ANTENNE = les dossiers de son antenne ; CHEF_MISSION / COLLABORATEUR = les missions
   * dont ils sont responsables. Lecture seule sauf ADMIN.
   */
  async tableauCabinet(user: User, filtres: FiltresMissionsDto) {
    if (user.role === UserRole.GERANT_OUEST) throw new ForbiddenException('Accès réservé au cabinet.');
    const qb = this.repo.createQueryBuilder('m')
      .innerJoinAndSelect('m.client', 'c')
      .leftJoinAndSelect('m.responsable', 'r')
      .where('c.tenantId = :tenantId', { tenantId: user.tenantId })
      .orderBy('m.updatedAt', 'DESC');
    if (!ROLES_VUE_COMPLETE.includes(user.role)) {
      if (user.role === UserRole.CHEF_ANTENNE && user.antenne) qb.andWhere('c.site = :site', { site: user.antenne });
      else qb.andWhere('m.responsableId = :uid', { uid: user.id });
    }
    const missions = await qb.getMany();

    const secteurs = await this.secteurRepo.find({ where: [{ tenantId: user.tenantId }, { tenantId: IsNull() }] });
    const libelleSecteur = (code?: string | null) =>
      (code && (secteurs.find(s => s.code === code && s.tenantId === user.tenantId) ?? secteurs.find(s => s.code === code))?.label) || null;

    const auj = aujourdhuiIso();
    const lignes = missions.map(m => ({
      ...this.vue(m, auj),
      secteur: m.client.secteurActivite ?? null,
      client: { id: m.client.id, nom: m.client.nom, secteur: libelleSecteur(m.client.secteurActivite) },
    }));
    const vues = filtrerMissions(lignes, filtres, auj);
    const responsables = new Map<number, string>();
    for (const l of lignes) if (l.responsable) responsables.set(l.responsable.id, `${l.responsable.firstName} ${l.responsable.lastName}`);
    const secteursPresents = new Map<string, string>();
    for (const l of lignes) if (l.secteur) secteursPresents.set(l.secteur, l.client.secteur ?? l.secteur);

    return {
      aujourdhui: auj,
      peutModifier: user.role === UserRole.ADMIN,
      kpi: synthese(vues, auj),
      missions: vues,
      responsables: [...responsables].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      secteurs: [...secteursPresents].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    };
  }
}
