import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { SaisieTemps, TypeTemps } from '../entities/saisie-temps.entity';
import { BudgetMission } from '../entities/budget-mission.entity';
import { Pointage } from '../entities/pointage.entity';
import { IncoherencePointage } from '../entities/incoherence-pointage.entity';
import { CongeAbsence, StatutConge } from '../entities/conge-absence.entity';
import { User } from '../entities/user.entity';
import { CreateSaisieTempsDto } from './dto/create-saisie-temps.dto';
import { UpdateSaisieTempsDto } from './dto/update-saisie-temps.dto';
import { AffairesService, aujourdhuiIso } from './affaires.service';
import { RentabiliteService } from './rentabilite.service';
import { ajouterJours, estCodeAffaire, etatAffaire } from './affaire.util';
import { estLieuTravail, lieuParDefaut } from './lieu-travail';
import {
  SaisieAuto, TacheATerminer, MESSAGES_SANS_SAISIE,
  champsSaisieTache, heureDebutAvant, heuresDeMinutes, minutesRestantes,
} from './saisie-tache.util';

const LIBELLES_TNF: Record<string, string> = {
  APPEL_CLIENT: 'Appel client',
  REUNION_INTERNE: 'Réunion interne',
  FORMATION: 'Formation',
  ADMINISTRATIF: 'Administratif',
  AUTRE: 'Autre',
};

const LIBELLES_ABSENCE: Record<string, string> = {
  CONGES_PAYES: 'Congés payés',
  MALADIE: 'Maladie',
  MATERNITE: 'Maternité',
  PATERNITE: 'Paternité',
  SANS_SOLDE: 'Sans solde',
  EVENEMENT_FAMILIAL: 'Événement familial',
  RECUPERATION: 'Récupération',
  AUTRE: 'Autre absence',
};

/** Ligne du rapport « Détail des temps passés » (format Tempolia). */
export interface LigneRapportDetail {
  id: number;
  source: 'SAISIE' | 'ABSENCE';
  date: string;
  collaborateurId: number;
  collaborateur: string;
  presence: 'FACTURABLE' | 'NON_FACTURABLE' | 'ABSENCE';
  clientId: number | null;
  client: string | null;
  /** Colonne « Client / TNF » : le client, sinon la catégorie de temps non facturable / d'absence. */
  clientTnf: string;
  affaire: string | null;
  affaireEtat: 'O' | 'C' | null;
  missionCode: string | null;
  categorie: string | null;
  libelle: string | null;
  dureeHeures: number;
  tauxHoraire: number | null;
  /** Taux figé à la saisie (false = repli sur le tarif actuel du collaborateur). */
  tauxFige: boolean;
  pv: number;
  heureDebut: string | null;
  heureFin: string | null;
  isLocked: boolean;
  /** Pôle de travail (cahier v2 #5) ; null pour une absence. */
  lieuTravail: string | null;
}

@Injectable()
export class SaisieTempsService {
  constructor(
    @InjectRepository(SaisieTemps) private repo: Repository<SaisieTemps>,
    @InjectRepository(Pointage) private pointageRepo: Repository<Pointage>,
    @InjectRepository(BudgetMission) private budgetRepo: Repository<BudgetMission>,
    @InjectRepository(IncoherencePointage) private incoherenceRepo: Repository<IncoherencePointage>,
    @InjectRepository(CongeAbsence) private congeRepo: Repository<CongeAbsence>,
    private affaires: AffairesService,
    private rentabilite: RentabiliteService,
  ) {}

  /** Taux de vente horaire actuel du collaborateur, figé sur la saisie (« PV Col »). */
  private tauxActuel(user: User): number | null {
    return user.prixVenteHoraire != null ? Number(user.prixVenteHoraire) : null;
  }

  async create(dto: CreateSaisieTempsDto, user: User): Promise<SaisieTemps> {
    await this.verifierCoherencePointage(dto, user);
    const affaire = dto.clientId
      ? (estCodeAffaire(dto.affaire) ? dto.affaire : await this.affaires.resoudre(dto.clientId, dto.date, dto.missionCode))
      : null;
    const saisie = this.repo.create({
      ...dto,
      affaire,
      lieuTravail: estLieuTravail(dto.lieuTravail) ? dto.lieuTravail : lieuParDefaut(user),
      tauxHoraire: this.tauxActuel(user),
      collaborateurId: user.id,
      tenantId: user.tenantId,
    });
    const saved = await this.repo.save(saisie);
    await this.rentabilite.verifierAlertes(user.tenantId, saved.clientId, saved.affaire);
    return saved;
  }

  /**
   * Modifier une saisie existante. Refuse si verrouillée (période validée) ou si la
   * saisie n'appartient pas à l'utilisateur. Réapplique le contrôle de cohérence
   * pointage/saisie en excluant la durée déjà enregistrée par CETTE ligne (pour ne
   * pas la compter deux fois) — uniquement si la date modifiée reste la même que
   * la date d'origine, sinon la durée d'origine appartient à l'ancien jour.
   */
  async update(id: number, dto: UpdateSaisieTempsDto, user: User): Promise<SaisieTemps> {
    const saisie = await this.repo.findOne({ where: { id, collaborateurId: user.id } });
    if (!saisie) {
      throw new NotFoundException('Saisie introuvable.');
    }
    if (saisie.isLocked) {
      throw new ForbiddenException('Cette saisie est verrouillée et ne peut pas être modifiée.');
    }

    const dateApres  = dto.date ?? saisie.date;
    const dureeApres = dto.dureeHeures ?? saisie.dureeHeures;
    await this.verifierCoherencePointage({ date: dateApres, dureeHeures: dureeApres }, user, saisie);

    const avant = { clientId: saisie.clientId, affaire: saisie.affaire };
    const clientApres  = 'clientId' in dto ? dto.clientId ?? null : saisie.clientId;
    const missionApres = 'missionCode' in dto ? dto.missionCode ?? null : saisie.missionCode;
    // Affaire : explicite si fournie ; recalculée si demandée (null) ou si la date, le client
    // ou la mission changent ; conservée sinon (pas de déplacement rétroactif).
    let affaire = saisie.affaire;
    if (!clientApres) affaire = null;
    else if (estCodeAffaire(dto.affaire)) affaire = dto.affaire;
    else if (dto.affaire === null || dateApres !== saisie.date || clientApres !== saisie.clientId || missionApres !== saisie.missionCode || !affaire) {
      affaire = await this.affaires.resoudre(clientApres, dateApres, missionApres);
    }

    const lieuTravail = estLieuTravail(dto.lieuTravail) ? dto.lieuTravail
      : dto.lieuTravail === null || !saisie.lieuTravail ? lieuParDefaut(user) : saisie.lieuTravail;
    Object.assign(saisie, dto, { affaire, lieuTravail });
    const saved = await this.repo.save(saisie);
    await this.rentabilite.verifierAlertes(user.tenantId, saved.clientId, saved.affaire);
    if (avant.clientId !== saved.clientId || avant.affaire !== saved.affaire) {
      await this.rentabilite.verifierAlertes(user.tenantId, avant.clientId, avant.affaire);
    }
    return saved;
  }

  async findByUser(userId: number, dateDebut?: string, dateFin?: string): Promise<SaisieTemps[]> {
    const where: any = { collaborateurId: userId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    return this.repo.find({ where, relations: ['client'], order: { date: 'DESC' } });
  }

  /**
   * Saisies d'UN collaborateur (soi-même par défaut, ou `collaborateurId` pour consulter le
   * calendrier d'un collègue — cf. Agenda module Travail). Détail complet (client, mission,
   * commentaire) y compris pour les collègues — même tenant uniquement.
   */
  async findByTenant(
    tenantId: number, requesterId: number, dateDebut?: string, dateFin?: string, collaborateurId?: number,
  ): Promise<Partial<SaisieTemps>[]> {
    const targetId = collaborateurId ?? requesterId;
    const where: any = { tenantId, collaborateurId: targetId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    const saisies = await this.repo.find({ where, relations: ['client', 'collaborateur'], order: { date: 'DESC' } });
    // Le calendrier d'un collègue n'a besoin que de son identité : jamais l'entité User complète
    // (hash du mot de passe, secret 2FA, IBAN, salaire…) ni la fiche complète du client.
    return saisies.map(s => ({
      ...s,
      client: s.client ? ({ id: s.client.id, nom: s.client.nom, site: s.client.site } as any) : null,
      collaborateur: s.collaborateur
        ? ({ id: s.collaborateur.id, firstName: s.collaborateur.firstName, lastName: s.collaborateur.lastName, site: s.collaborateur.site } as any)
        : undefined,
    })) as Partial<SaisieTemps>[];
  }

  async totalJour(userId: number, date: string): Promise<number> {
    const saisies = await this.repo.find({ where: { collaborateurId: userId, date } });
    return saisies.reduce((acc, s) => acc + s.dureeHeures, 0);
  }

  async ratioSemaine(userId: number, lundi: string): Promise<{ facturable: number; nonFacturable: number; total: number }> {
    const vendredi = this.addDays(lundi, 4);
    const saisies = await this.repo.find({
      where: { collaborateurId: userId, date: Between(lundi, vendredi) },
    });
    const facturable = saisies
      .filter(s => s.type === TypeTemps.FACTURABLE)
      .reduce((a, s) => a + s.dureeHeures, 0);
    const nonFacturable = saisies
      .filter(s => s.type === TypeTemps.NON_FACTURABLE)
      .reduce((a, s) => a + s.dureeHeures, 0);
    return { facturable, nonFacturable, total: facturable + nonFacturable };
  }

  /**
   * Saisie automatique à la fin d'une tâche (cf. saisie-tache.util.ts) : enregistre pour le
   * collaborateur le temps chronométré sur la tâche qui n'est pas encore saisi. Ne lève jamais
   * d'erreur — terminer la tâche ne doit pas échouer : un refus (contrôle de cohérence avec le
   * pointage) est renvoyé à l'appelant pour être affiché.
   */
  async saisirDepuisTache(
    tache: TacheATerminer,
    totalSecondes: number,
    collaborateur: User,
    fin: { date: string; heure: string },
  ): Promise<SaisieAuto> {
    const dejaSaisi = await this.repo.find({ where: { taskId: tache.id } });
    const minutes = minutesRestantes(totalSecondes, dejaSaisi.reduce((a, s) => a + (s.dureeHeures || 0), 0));
    if (minutes < 1) {
      const motif = dejaSaisi.length ? 'DEJA_SAISI' : 'AUCUN_TEMPS';
      return { creee: false, motif, message: MESSAGES_SANS_SAISIE[motif] };
    }
    const heureDebut = heureDebutAvant(fin.heure, minutes);
    try {
      const saisie = await this.create({
        ...champsSaisieTache(tache),
        date: fin.date,
        dureeHeures: heuresDeMinutes(minutes),
        ...(heureDebut ? { heureDebut, heureFin: fin.heure } : {}),
        taskId: tache.id,
      }, collaborateur);
      return {
        creee: true, saisieId: saisie.id, dureeHeures: saisie.dureeHeures, date: saisie.date,
        collaborateurId: collaborateur.id,
        collaborateur: `${collaborateur.firstName ?? ''} ${collaborateur.lastName ?? ''}`.trim(),
      };
    } catch (e: any) {
      const message = e instanceof BadRequestException
        ? e.message
        : 'La saisie automatique du temps a échoué : saisissez-le depuis le module Travail.';
      return { creee: false, motif: 'REFUSEE', message };
    }
  }

  async remove(id: number, userId: number): Promise<void> {
    const saisie = await this.repo.findOne({ where: { id } });
    if (saisie?.isLocked) {
      throw new ForbiddenException('Cette saisie est verrouillée et ne peut pas être supprimée.');
    }
    const res = await this.repo.delete({ id, collaborateurId: userId });
    if (saisie && res.affected) await this.rentabilite.verifierAlertes(saisie.tenantId, saisie.clientId, saisie.affaire);
  }

  /** Verrouiller toutes les saisies d'une période pour un collaborateur */
  async validerPeriode(
    semaine: number,
    annee: number,
    collaborateurId: number,
    validateur: User,
  ): Promise<{ locked: number }> {
    const role = (validateur as any).role;
    if (role !== 'ADMIN' && role !== 'EXPERT_COMPTABLE') {
      throw new ForbiddenException('Seuls ADMIN et EXPERT_COMPTABLE peuvent valider les périodes.');
    }
    // Calculer le lundi de la semaine
    const lundi = this.getMondayOfWeek(annee, semaine);
    const vendredi = this.addDays(lundi, 4);

    const saisies = await this.repo.find({
      where: {
        collaborateurId,
        date: Between(lundi, vendredi),
        isLocked: false,
      },
    });

    const now = new Date();
    const lockedByName = `${(validateur as any).firstName ?? ''} ${(validateur as any).lastName ?? ''}`.trim();

    for (const s of saisies) {
      s.isLocked = true;
      s.lockedAt = now;
      s.lockedBy = lockedByName;
    }

    await this.repo.save(saisies);
    return { locked: saisies.length };
  }

  /** Planning de charge : heures par collaborateur et par jour */
  async getPlanning(debut: string, fin: string, tenantId: number): Promise<any[]> {
    const saisies = await this.repo.find({
      where: { tenantId, date: Between(debut, fin) },
      relations: ['collaborateur'],
      order: { date: 'ASC' },
    });

    const map = new Map<string, any>();
    for (const s of saisies) {
      const key = `${s.collaborateurId}__${s.date}`;
      if (!map.has(key)) {
        map.set(key, {
          collaborateurId: s.collaborateurId,
          collaborateurNom: s.collaborateur
            ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}`
            : `Collab #${s.collaborateurId}`,
          date: s.date,
          totalHeures: 0,
        });
      }
      map.get(key).totalHeures += s.dureeHeures;
    }

    return Array.from(map.values());
  }

  // ── Budget missions ────────────────────────────────────────────────────────

  async findBudgets(clientId: number, annee: number, tenantId: number): Promise<BudgetMission[]> {
    return this.budgetRepo.find({ where: { clientId, annee, tenantId } });
  }

  async createBudget(data: Partial<BudgetMission>): Promise<BudgetMission> {
    const existing = await this.budgetRepo.findOne({
      where: { clientId: data.clientId, annee: data.annee, missionCode: data.missionCode, tenantId: data.tenantId },
    });
    if (existing) {
      Object.assign(existing, data);
      return this.budgetRepo.save(existing);
    }
    const budget = this.budgetRepo.create(data);
    return this.budgetRepo.save(budget);
  }

  // ── Rapports vues Travail ─────────────────────────────────────────────────

  /** Rapport par jour : liste des saisies avec joins */
  async getRapportJour(tenantId: number, dateDebut?: string, dateFin?: string, collaborateurId?: number, clientId?: number): Promise<any[]> {
    const where: any = { tenantId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    if (collaborateurId) where.collaborateurId = collaborateurId;
    if (clientId) where.clientId = clientId;
    const saisies = await this.repo.find({ where, relations: ['client', 'collaborateur'], order: { date: 'DESC' } });
    return saisies.map(s => ({
      id: s.id,
      date: s.date,
      collaborateurId: s.collaborateurId,
      collaborateur: s.collaborateur ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}` : null,
      clientId: s.clientId ?? null,
      client: s.client?.nom ?? null,
      commentaire: s.commentaire ?? null,
      dureeHeures: s.dureeHeures,
      type: s.type,
      categorie: s.categorie ?? null,
      missionCode: s.missionCode,
      affaire: s.affaire ?? null,
      lieuTravail: s.lieuTravail ?? lieuParDefaut(s.collaborateur),
      heureDebut: s.heureDebut,
      heureFin: s.heureFin,
      isLocked: s.isLocked,
    }));
  }

  /**
   * Rapport « Détail des temps passés » au format Tempolia : une ligne par saisie (temps
   * facturable / non facturable) et par absence approuvée, valorisée au « PV Col » (durée ×
   * prix de vente horaire figé sur la saisie, à défaut le tarif actuel du collaborateur).
   * Regroupements, sous-totaux et filtres fins (affaire, tâche, présence) se font côté écran.
   */
  async getRapportDetail(
    tenantId: number,
    f: { dateDebut?: string; dateFin?: string; collaborateurIds?: number[]; clientIds?: number[]; inclureAbsences?: boolean },
  ): Promise<{ lignes: LigneRapportDetail[] }> {
    const where: any = { tenantId };
    if (f.dateDebut && f.dateFin) where.date = Between(f.dateDebut, f.dateFin);
    if (f.collaborateurIds?.length) where.collaborateurId = In(f.collaborateurIds);
    if (f.clientIds?.length) where.clientId = In(f.clientIds);
    const saisies = await this.repo.find({ where, relations: ['client', 'collaborateur'], order: { date: 'DESC' } });

    const ctx = await this.affaires.contextes(saisies.map(s => s.clientId));
    const aujourdhui = aujourdhuiIso();
    const etats = new Map<string, 'O' | 'C'>();
    const etatDe = (clientId: number, affaire: string) => {
      const k = `${clientId}|${affaire}`;
      if (!etats.has(k)) etats.set(k, etatAffaire(affaire, ctx.get(clientId) ?? {}, aujourdhui));
      return etats.get(k)!;
    };
    const nom = (u?: User | null, id?: number) => (u ? `${u.firstName} ${u.lastName}`.trim() : `#${id}`);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const lignes: LigneRapportDetail[] = saisies.map(s => {
      const taux = s.tauxHoraire ?? (s.collaborateur?.prixVenteHoraire != null ? Number(s.collaborateur.prixVenteHoraire) : null);
      const facturable = s.type === TypeTemps.FACTURABLE;
      return {
        id: s.id,
        source: 'SAISIE',
        date: s.date,
        collaborateurId: s.collaborateurId,
        collaborateur: nom(s.collaborateur, s.collaborateurId),
        presence: facturable ? 'FACTURABLE' : 'NON_FACTURABLE',
        clientId: s.clientId ?? null,
        client: s.client?.nom ?? null,
        clientTnf: s.client?.nom ?? (facturable ? 'Sans client' : LIBELLES_TNF[s.categorie ?? 'AUTRE'] ?? 'Autre'),
        affaire: s.affaire ?? null,
        affaireEtat: s.clientId && s.affaire ? etatDe(s.clientId, s.affaire) : null,
        missionCode: s.missionCode ?? null,
        categorie: s.categorie ?? null,
        libelle: s.commentaire ?? null,
        dureeHeures: s.dureeHeures,
        tauxHoraire: taux,
        tauxFige: s.tauxHoraire != null,
        pv: taux ? r2(s.dureeHeures * taux) : 0,
        heureDebut: s.heureDebut ?? null,
        heureFin: s.heureFin ?? null,
        isLocked: s.isLocked,
        lieuTravail: s.lieuTravail ?? lieuParDefaut(s.collaborateur),
      };
    });

    if (f.inclureAbsences && !f.clientIds?.length) {
      lignes.push(...await this.lignesAbsences(tenantId, f));
      lignes.sort((a, b) => b.date.localeCompare(a.date));
    }
    return { lignes };
  }

  /** Absences approuvées converties en heures : jours ouvrés (lun–ven) de l'absence compris
   *  dans la période × (heures hebdo du contrat ÷ 5, 7 h par défaut), au prorata du nombre de
   *  jours posés (demi-journées). Une ligne par absence, datée de son premier jour dans la période. */
  private async lignesAbsences(
    tenantId: number,
    f: { dateDebut?: string; dateFin?: string; collaborateurIds?: number[] },
  ): Promise<LigneRapportDetail[]> {
    const where: any = { tenantId, statut: StatutConge.APPROUVEE };
    if (f.collaborateurIds?.length) where.userId = In(f.collaborateurIds);
    if (f.dateDebut && f.dateFin) {
      where.dateDebut = LessThanOrEqual(f.dateFin);
      where.dateFin = MoreThanOrEqual(f.dateDebut);
    }
    const absences = await this.congeRepo.find({ where, relations: ['user'] });
    const fmt = (d: string) => d.split('-').reverse().join('/');
    const lignes: LigneRapportDetail[] = [];
    for (const a of absences) {
      const jours = this.joursOuvres(a.dateDebut, a.dateFin);
      if (!jours.length) continue;
      const dansPeriode = jours.filter(j => (!f.dateDebut || j >= f.dateDebut) && (!f.dateFin || j <= f.dateFin));
      if (!dansPeriode.length) continue;
      const heuresJour = (Number(a.user?.heuresHebdo) || 35) / 5;
      const prorata = Math.min(1, (Number(a.nombreJours) || jours.length) / jours.length);
      const heures = Math.round(dansPeriode.length * heuresJour * prorata * 100) / 100;
      const type = LIBELLES_ABSENCE[a.typeConge] ?? 'Absence';
      lignes.push({
        id: a.id,
        source: 'ABSENCE',
        date: dansPeriode[0],
        collaborateurId: a.userId,
        collaborateur: a.user ? `${a.user.firstName} ${a.user.lastName}`.trim() : `#${a.userId}`,
        presence: 'ABSENCE',
        clientId: null,
        client: null,
        clientTnf: type,
        affaire: null,
        affaireEtat: null,
        missionCode: null,
        categorie: a.typeConge,
        libelle: `${type} du ${fmt(a.dateDebut)} au ${fmt(a.dateFin)}${a.motif ? ` — ${a.motif}` : ''}`,
        dureeHeures: heures,
        tauxHoraire: null,
        tauxFige: false,
        pv: 0,
        heureDebut: null,
        heureFin: null,
        isLocked: true,
        lieuTravail: null,
      });
    }
    return lignes;
  }

  private joursOuvres(debut: string, fin: string): string[] {
    const jours: string[] = [];
    for (let j = debut; j <= fin && jours.length < 400; j = ajouterJours(j, 1)) {
      const jour = new Date(`${j}T12:00:00Z`).getUTCDay();
      if (jour !== 0 && jour !== 6) jours.push(j);
    }
    return jours;
  }

  /** Rapport agrégé par semaine ISO × collaborateur — chaque groupe embarque aussi le
   *  détail des saisies (tâches) qui le composent, pour affichage et export détaillés. */
  async getRapportSemaine(tenantId: number, dateDebut?: string, dateFin?: string, collaborateurId?: number): Promise<any[]> {
    const where: any = { tenantId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    if (collaborateurId) where.collaborateurId = collaborateurId;
    const saisies = await this.repo.find({ where, relations: ['collaborateur', 'client'], order: { date: 'ASC' } });
    const map = new Map<string, any>();
    for (const s of saisies) {
      const isoWeek = this.getISOWeek(s.date);
      const collab  = s.collaborateur ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}` : `#${s.collaborateurId}`;
      const key = `${isoWeek}__${s.collaborateurId}`;
      if (!map.has(key)) {
        const [yr, wn] = isoWeek.split('-W');
        const lundi  = this.getMondayOfWeek(+yr, +wn);
        const vendredi = this.addDays(lundi, 4);
        map.set(key, { isoWeek, semaine: +wn, annee: +yr, periode: `${lundi} → ${vendredi}`, collaborateur: collab, facturable: 0, nonFacturable: 0, total: 0, saisies: [] as any[] });
      }
      const e = map.get(key)!;
      if (s.type === TypeTemps.FACTURABLE) e.facturable += s.dureeHeures;
      else e.nonFacturable += s.dureeHeures;
      e.total += s.dureeHeures;
      e.saisies.push({
        id: s.id, date: s.date, client: s.client?.nom ?? null, missionCode: s.missionCode ?? null,
        commentaire: s.commentaire ?? null, dureeHeures: s.dureeHeures, type: s.type,
        heureDebut: s.heureDebut, heureFin: s.heureFin,
      });
    }
    return Array.from(map.values());
  }

  /** Rapport agrégé par mois × collaborateur — chaque groupe embarque aussi le détail des
   *  saisies (tâches) qui le composent, pour affichage et export détaillés. */
  async getRapportMois(tenantId: number, dateDebut?: string, dateFin?: string, collaborateurId?: number): Promise<any[]> {
    const where: any = { tenantId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    if (collaborateurId) where.collaborateurId = collaborateurId;
    const saisies = await this.repo.find({ where, relations: ['collaborateur', 'client'], order: { date: 'ASC' } });
    const map = new Map<string, any>();
    const MOIS_FR = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    for (const s of saisies) {
      const [yr, mo] = s.date.split('-');
      const collab   = s.collaborateur ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}` : `#${s.collaborateurId}`;
      const key = `${yr}-${mo}__${s.collaborateurId}`;
      if (!map.has(key)) {
        map.set(key, { mois: `${MOIS_FR[+mo]} ${yr}`, annee: +yr, moisNum: +mo, collaborateur: collab, facturable: 0, nonFacturable: 0, total: 0, saisies: [] as any[] });
      }
      const e = map.get(key)!;
      if (s.type === TypeTemps.FACTURABLE) e.facturable += s.dureeHeures;
      else e.nonFacturable += s.dureeHeures;
      e.total += s.dureeHeures;
      e.saisies.push({
        id: s.id, date: s.date, client: s.client?.nom ?? null, missionCode: s.missionCode ?? null,
        commentaire: s.commentaire ?? null, dureeHeures: s.dureeHeures, type: s.type,
        heureDebut: s.heureDebut, heureFin: s.heureFin,
      });
    }
    return Array.from(map.values());
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async verifierCoherencePointage(
    data: { date: string; dureeHeures: number },
    user: User,
    excludeSaisie?: SaisieTemps,
  ): Promise<void> {
    const pointage = await this.pointageRepo.findOne({
      where: { userId: user.id, date: data.date as any },
      relations: ['pauses'],
    });
    if (!pointage?.heureArrivee) return;

    const heuresPointees = this.calculerHeuresPointage(pointage);
    let dejaEnregistre = await this.totalJour(user.id, data.date);
    // En update : ne pas compter deux fois la durée déjà enregistrée par la ligne
    // qu'on modifie — seulement si elle appartenait déjà à ce même jour.
    if (excludeSaisie && excludeSaisie.date === data.date) {
      dejaEnregistre -= excludeSaisie.dureeHeures;
    }
    if (dejaEnregistre + data.dureeHeures > heuresPointees + 0.25) {
      // Traçabilité : enregistrer l'incohérence détectée
      const log = this.incoherenceRepo.create({
        collaborateurId: user.id,
        tenantId: (user as any).tenantId,
        date: data.date,
        heuresPointees,
        heuresDejaSaisies: dejaEnregistre,
        tentativeDuree: data.dureeHeures,
      });
      await this.incoherenceRepo.save(log);

      throw new BadRequestException(
        `Vous ne pouvez pas saisir plus de ${heuresPointees.toFixed(2)}h (durée pointée ce jour). Vérifiez votre pointage.`,
      );
    }
  }

  /** Liste les incohérences de pointage détectées (réservé admin) */
  async getIncoherences(tenantId: number): Promise<any[]> {
    const logs = await this.incoherenceRepo.find({
      where: { tenantId },
      relations: ['collaborateur'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return logs.map(l => ({
      id: l.id,
      date: l.date,
      collaborateur: l.collaborateur
        ? `${l.collaborateur.firstName} ${l.collaborateur.lastName}`
        : `Collaborateur #${l.collaborateurId}`,
      heuresPointees: l.heuresPointees,
      heuresDejaSaisies: l.heuresDejaSaisies,
      tentativeDuree: l.tentativeDuree,
      detectedAt: l.createdAt,
    }));
  }

  private calculerHeuresPointage(pointage: Pointage): number {
    if (!pointage.heureArrivee || !pointage.heureDepart) return 24;

    const arrivee = new Date(pointage.heureArrivee).getTime();
    const depart  = new Date(pointage.heureDepart).getTime();
    let totalMs   = depart - arrivee;

    for (const pause of pointage.pauses ?? []) {
      if (pause.heureDebut && pause.heureFin) {
        totalMs -= new Date(pause.heureFin).getTime() - new Date(pause.heureDebut).getTime();
      }
    }

    return Math.max(0, totalMs / 3_600_000);
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  private getMondayOfWeek(year: number, week: number): string {
    // ISO week: Jan 4 is always in week 1
    const jan4 = new Date(year, 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const monday = new Date(startOfWeek1);
    monday.setDate(startOfWeek1.getDate() + (week - 1) * 7);
    return monday.toISOString().split('T')[0];
  }

  private getISOWeek(dateStr: string): string {
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayOfWeek);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}
