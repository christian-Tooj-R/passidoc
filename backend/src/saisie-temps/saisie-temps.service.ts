import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SaisieTemps, TypeTemps } from '../entities/saisie-temps.entity';
import { BudgetMission } from '../entities/budget-mission.entity';
import { Pointage } from '../entities/pointage.entity';
import { IncoherencePointage } from '../entities/incoherence-pointage.entity';
import { User } from '../entities/user.entity';
import { CreateSaisieTempsDto } from './dto/create-saisie-temps.dto';
import { UpdateSaisieTempsDto } from './dto/update-saisie-temps.dto';

@Injectable()
export class SaisieTempsService {
  constructor(
    @InjectRepository(SaisieTemps) private repo: Repository<SaisieTemps>,
    @InjectRepository(Pointage) private pointageRepo: Repository<Pointage>,
    @InjectRepository(BudgetMission) private budgetRepo: Repository<BudgetMission>,
    @InjectRepository(IncoherencePointage) private incoherenceRepo: Repository<IncoherencePointage>,
  ) {}

  async create(dto: CreateSaisieTempsDto, user: User): Promise<SaisieTemps> {
    await this.verifierCoherencePointage(dto, user);
    const saisie = this.repo.create({
      ...dto,
      collaborateurId: user.id,
      tenantId: user.tenantId,
    });
    return this.repo.save(saisie);
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

    Object.assign(saisie, dto);
    return this.repo.save(saisie);
  }

  async findByUser(userId: number, dateDebut?: string, dateFin?: string): Promise<SaisieTemps[]> {
    const where: any = { collaborateurId: userId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    return this.repo.find({ where, relations: ['client'], order: { date: 'DESC' } });
  }

  async findByTenant(tenantId: number, dateDebut?: string, dateFin?: string): Promise<SaisieTemps[]> {
    const where: any = { tenantId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    return this.repo.find({ where, relations: ['client', 'collaborateur'], order: { date: 'DESC' } });
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

  async remove(id: number, userId: number): Promise<void> {
    const saisie = await this.repo.findOne({ where: { id } });
    if (saisie?.isLocked) {
      throw new ForbiddenException('Cette saisie est verrouillée et ne peut pas être supprimée.');
    }
    await this.repo.delete({ id, collaborateurId: userId });
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

  /** Rapport par collaborateur/client/semaine */
  async getRapports(
    type: 'collaborateur' | 'client' | 'semaine',
    debut: string,
    fin: string,
    tenantId: number,
  ): Promise<any[]> {
    const saisies = await this.repo.find({
      where: { tenantId, date: Between(debut, fin) },
      relations: ['client', 'collaborateur'],
      order: { date: 'ASC' },
    });

    if (type === 'collaborateur') {
      const map = new Map<number, any>();
      for (const s of saisies) {
        const cid = s.collaborateurId;
        if (!map.has(cid)) {
          map.set(cid, {
            collaborateurId: cid,
            nom: s.collaborateur ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}` : `Collab #${cid}`,
            totalHeures: 0,
            heuresFacturables: 0,
            heuresNonFacturables: 0,
            parSemaine: {},
          });
        }
        const entry = map.get(cid);
        entry.totalHeures += s.dureeHeures;
        if (s.type === TypeTemps.FACTURABLE) entry.heuresFacturables += s.dureeHeures;
        else entry.heuresNonFacturables += s.dureeHeures;
        const sem = this.getISOWeek(s.date);
        entry.parSemaine[sem] = (entry.parSemaine[sem] ?? 0) + s.dureeHeures;
      }
      return Array.from(map.values());
    }

    if (type === 'client') {
      const map = new Map<number, any>();
      for (const s of saisies) {
        const cid = s.clientId ?? 0;
        if (!map.has(cid)) {
          map.set(cid, {
            clientId: cid,
            nom: s.client?.nom ?? '(Sans dossier)',
            totalHeures: 0,
            parMission: {},
          });
        }
        const entry = map.get(cid);
        entry.totalHeures += s.dureeHeures;
        const code = s.missionCode ?? 'NF';
        entry.parMission[code] = (entry.parMission[code] ?? 0) + s.dureeHeures;
      }
      return Array.from(map.values());
    }

    // type === 'semaine' — retourne toutes les saisies enrichies
    return saisies.map(s => ({
      id: s.id,
      date: s.date,
      dureeHeures: s.dureeHeures,
      type: s.type,
      missionCode: s.missionCode,
      commentaire: s.commentaire,
      clientNom: s.client?.nom ?? null,
      collaborateurNom: s.collaborateur
        ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}`
        : null,
      isLocked: s.isLocked,
    }));
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
      heureDebut: s.heureDebut,
      heureFin: s.heureFin,
      isLocked: s.isLocked,
    }));
  }

  /** Rapport agrégé par semaine ISO × collaborateur */
  async getRapportSemaine(tenantId: number, dateDebut?: string, dateFin?: string, collaborateurId?: number): Promise<any[]> {
    const where: any = { tenantId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    if (collaborateurId) where.collaborateurId = collaborateurId;
    const saisies = await this.repo.find({ where, relations: ['collaborateur'], order: { date: 'ASC' } });
    const map = new Map<string, any>();
    for (const s of saisies) {
      const isoWeek = this.getISOWeek(s.date);
      const collab  = s.collaborateur ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}` : `#${s.collaborateurId}`;
      const key = `${isoWeek}__${s.collaborateurId}`;
      if (!map.has(key)) {
        const [yr, wn] = isoWeek.split('-W');
        const lundi  = this.getMondayOfWeek(+yr, +wn);
        const vendredi = this.addDays(lundi, 4);
        map.set(key, { isoWeek, semaine: +wn, annee: +yr, periode: `${lundi} → ${vendredi}`, collaborateur: collab, facturable: 0, nonFacturable: 0, total: 0 });
      }
      const e = map.get(key)!;
      if (s.type === TypeTemps.FACTURABLE) e.facturable += s.dureeHeures;
      else e.nonFacturable += s.dureeHeures;
      e.total += s.dureeHeures;
    }
    return Array.from(map.values());
  }

  /** Rapport agrégé par mois × collaborateur */
  async getRapportMois(tenantId: number, dateDebut?: string, dateFin?: string, collaborateurId?: number): Promise<any[]> {
    const where: any = { tenantId };
    if (dateDebut && dateFin) where.date = Between(dateDebut, dateFin);
    if (collaborateurId) where.collaborateurId = collaborateurId;
    const saisies = await this.repo.find({ where, relations: ['collaborateur'], order: { date: 'ASC' } });
    const map = new Map<string, any>();
    const MOIS_FR = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    for (const s of saisies) {
      const [yr, mo] = s.date.split('-');
      const collab   = s.collaborateur ? `${s.collaborateur.firstName} ${s.collaborateur.lastName}` : `#${s.collaborateurId}`;
      const key = `${yr}-${mo}__${s.collaborateurId}`;
      if (!map.has(key)) {
        map.set(key, { mois: `${MOIS_FR[+mo]} ${yr}`, annee: +yr, moisNum: +mo, collaborateur: collab, facturable: 0, nonFacturable: 0, total: 0 });
      }
      const e = map.get(key)!;
      if (s.type === TypeTemps.FACTURABLE) e.facturable += s.dureeHeures;
      else e.nonFacturable += s.dureeHeures;
      e.total += s.dureeHeures;
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
