import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CongeAbsence, TypeConge, StatutConge } from '../entities/conge-absence.entity';
import { SoldeConge } from '../entities/solde-conge.entity';
import { User, UserRole } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class CongesAbsencesService {
  private readonly logger = new Logger(CongesAbsencesService.name);

  private readonly TYPE_LABELS: Record<string, string> = {
    CONGES_PAYES:       'Congés payés',
    MALADIE:            'Maladie',
    MATERNITE:          'Maternité',
    PATERNITE:          'Paternité',
    SANS_SOLDE:         'Sans solde',
    EVENEMENT_FAMILIAL: 'Événement familial',
    RECUPERATION:       'Récupération',
    AUTRE:              'Autre',
  };

  constructor(
    @InjectRepository(CongeAbsence) private congeRepo: Repository<CongeAbsence>,
    @InjectRepository(SoldeConge)   private soldeRepo: Repository<SoldeConge>,
    @InjectRepository(User)         private userRepo: Repository<User>,
    private readonly mailSvc: MailService,
    private readonly jwtSvc:  JwtService,
    private readonly config:  ConfigService,
  ) {}

  /* ── Demandes ──────────────────────────────────────────────── */

  async findAll(filters?: { userId?: number; statut?: StatutConge; annee?: number; tenantId?: number }) {
    const qb = this.congeRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .orderBy('c.dateDebut', 'DESC');

    if (filters?.tenantId) qb.andWhere('c.tenantId = :tenantId', { tenantId: filters.tenantId });
    if (filters?.userId) qb.andWhere('c.userId = :userId', { userId: filters.userId });
    if (filters?.statut) qb.andWhere('c.statut = :statut', { statut: filters.statut });
    if (filters?.annee) {
      qb.andWhere('EXTRACT(YEAR FROM c."dateDebut") = :annee', { annee: filters.annee });
    }

    const conges = await qb.getMany();
    return conges.map(c => this.safeConge(c));
  }

  async findOne(id: number) {
    const c = await this.congeRepo.findOne({ where: { id }, relations: ['user'] });
    if (!c) throw new NotFoundException('Demande introuvable');
    return this.safeConge(c);
  }

  async create(dto: {
    userId: number;
    typeConge: TypeConge;
    dateDebut: string;
    dateFin: string;
    nombreJours: number;
    motif?: string;
    tenantId?: number;
  }) {
    if (!dto.dateDebut || isNaN(new Date(dto.dateDebut).getTime())) {
      throw new BadRequestException('Date de début invalide');
    }
    if (!dto.dateFin || isNaN(new Date(dto.dateFin).getTime())) {
      throw new BadRequestException('Date de fin invalide');
    }

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const solde = await this.getSoldeForType(dto.userId, dto.typeConge, new Date(dto.dateDebut).getFullYear(), dto.tenantId);
    const disponible = Number(solde.joursAcquis) - Number(solde.joursPris) - Number(solde.joursEnAttente);
    if (['CONGES_PAYES', 'RECUPERATION'].includes(dto.typeConge) && dto.nombreJours > disponible) {
      throw new BadRequestException(`Solde insuffisant. Disponible : ${disponible} jours`);
    }

    const conge = this.congeRepo.create({ userId: dto.userId, typeConge: dto.typeConge, dateDebut: dto.dateDebut, dateFin: dto.dateFin, nombreJours: dto.nombreJours, motif: dto.motif, statut: StatutConge.EN_ATTENTE, ...(dto.tenantId ? { tenantId: dto.tenantId } : {}) });
    const saved = await this.congeRepo.save(conge);

    await this.soldeRepo.update(
      { userId: dto.userId, typeConge: dto.typeConge, annee: new Date(dto.dateDebut).getFullYear() },
      { joursEnAttente: () => `"joursEnAttente" + ${dto.nombreJours}` },
    );

    // Notification email au manager
    this._notifyManager(saved, user).catch(e => this.logger.error('Erreur envoi email manager:', e.message));

    return this.findOne(saved.id);
  }

  async approuver(id: number, approbateurId: number, commentaire?: string) {
    const conge = await this.congeRepo.findOne({ where: { id } });
    if (!conge) throw new NotFoundException('Demande introuvable');
    if (conge.statut !== StatutConge.EN_ATTENTE) throw new BadRequestException('Demande déjà traitée');

    await this.congeRepo.update(id, {
      statut: StatutConge.APPROUVEE,
      approbateurId,
      dateApprobation: new Date().toISOString().split('T')[0],
      commentaireRH: commentaire ?? null,
    });

    const annee = new Date(conge.dateDebut).getFullYear();
    await this.soldeRepo.update(
      { userId: conge.userId, typeConge: conge.typeConge, annee },
      {
        joursPris:       () => `"joursPris" + ${conge.nombreJours}`,
        joursEnAttente:  () => `"joursEnAttente" - ${conge.nombreJours}`,
      },
    );

    // Notifier l'employé
    this._notifyEmployee(await this.findOne(id), 'APPROUVEE').catch(() => {});

    return this.findOne(id);
  }

  async refuser(id: number, approbateurId: number, commentaire?: string) {
    const conge = await this.congeRepo.findOne({ where: { id } });
    if (!conge) throw new NotFoundException('Demande introuvable');
    if (conge.statut !== StatutConge.EN_ATTENTE) throw new BadRequestException('Demande déjà traitée');

    await this.congeRepo.update(id, {
      statut: StatutConge.REFUSEE,
      approbateurId,
      dateApprobation: new Date().toISOString().split('T')[0],
      commentaireRH: commentaire ?? null,
    });

    const annee = new Date(conge.dateDebut).getFullYear();
    await this.soldeRepo.update(
      { userId: conge.userId, typeConge: conge.typeConge, annee },
      { joursEnAttente: () => `"joursEnAttente" - ${conge.nombreJours}` },
    );

    // Notifier l'employé
    this._notifyEmployee(await this.findOne(id), 'REFUSEE').catch(() => {});

    return this.findOne(id);
  }

  async annuler(id: number, userId: number) {
    const conge = await this.congeRepo.findOne({ where: { id } });
    if (!conge) throw new NotFoundException('Demande introuvable');
    if (conge.userId !== userId) throw new BadRequestException('Action non autorisée');
    if (conge.statut === StatutConge.APPROUVEE) throw new BadRequestException('Impossible d\'annuler une demande déjà approuvée');

    const wasEnAttente = conge.statut === StatutConge.EN_ATTENTE;
    await this.congeRepo.update(id, { statut: StatutConge.ANNULEE });

    if (wasEnAttente) {
      const annee = new Date(conge.dateDebut).getFullYear();
      await this.soldeRepo.update(
        { userId: conge.userId, typeConge: conge.typeConge, annee },
        { joursEnAttente: () => `"joursEnAttente" - ${conge.nombreJours}` },
      );
    }

    return this.findOne(id);
  }

  /* ── Soldes ───────────────────────────────────────────────── */

  async getSoldes(userId: number, annee?: number) {
    const year = annee ?? new Date().getFullYear();
    const soldes = await this.soldeRepo.find({ where: { userId, annee: year } });

    const tous = Object.values(TypeConge).map(type => {
      const s = soldes.find(x => x.typeConge === type);
      return {
        typeConge: type,
        annee: year,
        joursAcquis:    Number(s?.joursAcquis    ?? 0),
        joursPris:      Number(s?.joursPris       ?? 0),
        joursEnAttente: Number(s?.joursEnAttente  ?? 0),
        solde:          Number(s?.joursAcquis ?? 0) - Number(s?.joursPris ?? 0) - Number(s?.joursEnAttente ?? 0),
      };
    });

    return tous;
  }

  async updateSolde(userId: number, typeConge: TypeConge, annee: number, joursAcquis: number, tenantId?: number) {
    const existing = await this.soldeRepo.findOne({ where: { userId, typeConge, annee } });
    if (existing) {
      await this.soldeRepo.update(existing.id, { joursAcquis });
    } else {
      await this.soldeRepo.save(this.soldeRepo.create({ userId, typeConge, annee, joursAcquis, ...(tenantId ? { tenantId } : {}) }));
    }
    return this.getSoldes(userId, annee);
  }

  /* ── Stats ───────────────────────────────────────────────── */

  async getStats(annee?: number, tenantId?: number) {
    const year = annee ?? new Date().getFullYear();
    const where: any = { statut: StatutConge.APPROUVEE };
    if (tenantId) where.tenantId = tenantId;
    const conges = await this.congeRepo.find({ where, relations: ['user'] });

    const total       = conges.filter(c => new Date(c.dateDebut).getFullYear() === year).length;
    const parType     = Object.values(TypeConge).map(t => ({
      type: t,
      count: conges.filter(c => c.typeConge === t && new Date(c.dateDebut).getFullYear() === year).length,
      jours: conges.filter(c => c.typeConge === t && new Date(c.dateDebut).getFullYear() === year)
                   .reduce((s, c) => s + Number(c.nombreJours), 0),
    }));

    const enAttenteWhere: any = { statut: StatutConge.EN_ATTENTE };
    if (tenantId) enAttenteWhere.tenantId = tenantId;
    const enAttente = await this.congeRepo.count({ where: enAttenteWhere });

    return { annee: year, totalApprouves: total, enAttente, parType };
  }

  /* ── Calendrier des absences ─────────────────────────────── */

  async getCalendrier(mois: number, annee: number, site?: string, tenantId?: number): Promise<any[]> {
    // Charger toutes les absences approuvées et en attente qui chevauchent le mois
    const debut = `${annee}-${String(mois).padStart(2, '0')}-01`;
    const finDuMois = new Date(annee, mois, 0); // dernier jour du mois
    const fin   = `${annee}-${String(mois).padStart(2, '0')}-${String(finDuMois.getDate()).padStart(2, '0')}`;

    const qb = this.congeRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.statut IN (:...statuts)', { statuts: [StatutConge.APPROUVEE, StatutConge.EN_ATTENTE] })
      .andWhere('c.dateDebut <= :fin',   { fin })
      .andWhere('c.dateFin   >= :debut', { debut })
      .orderBy('u.lastName', 'ASC')
      .addOrderBy('c.dateDebut', 'ASC');

    if (site) qb.andWhere('u.site = :site', { site });
    if (tenantId) qb.andWhere('c.tenantId = :tenantId', { tenantId });

    const conges = await qb.getMany();

    return conges.map(c => ({
      id:          c.id,
      userId:      c.userId,
      firstName:   (c as any).user?.firstName ?? '',
      lastName:    (c as any).user?.lastName  ?? '',
      site:        (c as any).user?.site       ?? '',
      typeConge:   c.typeConge,
      dateDebut:   c.dateDebut,
      dateFin:     c.dateFin,
      nombreJours: Number(c.nombreJours),
      statut:      c.statut,
    }));
  }

  /* ── Action email (validation sans login) ─────────────────── */

  generateEmailActionToken(congeId: number): string {
    return this.jwtSvc.sign({ sub: congeId, pur: 'email-action' });
  }

  async approuverParEmailToken(
    congeId: number,
    action: 'approuver' | 'refuser',
    token: string,
  ): Promise<{ statut: string; message: string }> {
    // Vérifier le token
    let payload: any;
    try {
      payload = this.jwtSvc.verify(token);
    } catch {
      throw new ForbiddenException('Lien expiré ou invalide');
    }

    if (payload.sub !== congeId || payload.pur !== 'email-action') {
      throw new ForbiddenException('Token invalide pour cette demande');
    }

    const conge = await this.congeRepo.findOne({ where: { id: congeId } });
    if (!conge) throw new NotFoundException('Demande introuvable');
    if (conge.statut !== StatutConge.EN_ATTENTE) {
      return { statut: conge.statut, message: 'Demande déjà traitée' };
    }

    if (action === 'approuver') {
      await this.approuver(congeId, 0, 'Approuvé via email');
      return { statut: StatutConge.APPROUVEE, message: 'Demande approuvée' };
    } else {
      await this.refuser(congeId, 0, 'Refusé via email');
      return { statut: StatutConge.REFUSEE, message: 'Demande refusée' };
    }
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  private async getSoldeForType(userId: number, typeConge: TypeConge, annee: number, tenantId?: number) {
    let solde = await this.soldeRepo.findOne({ where: { userId, typeConge, annee } });
    if (!solde) {
      solde = this.soldeRepo.create({ userId, typeConge, annee, joursAcquis: 0, joursPris: 0, joursEnAttente: 0, ...(tenantId ? { tenantId } : {}) });
      await this.soldeRepo.save(solde);
    }
    return solde;
  }

  private safeConge(c: CongeAbsence & { user?: User }) {
    const { user, ...rest } = c as any;
    return {
      ...rest,
      user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, site: user.site } : undefined,
    };
  }

  private async _notifyManager(conge: CongeAbsence, employee: User): Promise<void> {
    if (!employee.referentId) return;

    const manager = await this.userRepo.findOne({ where: { id: employee.referentId } });
    if (!manager?.email) return;

    const appUrl   = this.config.get<string>('APP_URL') ?? 'http://localhost:4200';
    const apiUrl   = this.config.get<string>('API_URL') ?? 'http://localhost:3000/api';
    const token    = this.generateEmailActionToken(conge.id);

    await this.mailSvc.sendCongeNotificationManager({
      managerEmail:  manager.email,
      managerName:   `${manager.firstName} ${manager.lastName}`,
      employeeName:  `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      typeConge:     this.TYPE_LABELS[conge.typeConge] ?? conge.typeConge,
      dateDebut:     conge.dateDebut,
      dateFin:       conge.dateFin,
      nombreJours:   Number(conge.nombreJours),
      motif:         conge.motif,
      approuverUrl:  `${apiUrl}/conges/${conge.id}/email-action?token=${token}&action=approuver&redirect=${encodeURIComponent(appUrl + '/rh/conges')}`,
      refuserUrl:    `${apiUrl}/conges/${conge.id}/email-action?token=${token}&action=refuser&redirect=${encodeURIComponent(appUrl + '/rh/conges')}`,
    });
  }

  private async _notifyEmployee(conge: any, statut: 'APPROUVEE' | 'REFUSEE'): Promise<void> {
    if (!conge.userId) return;
    const employee = await this.userRepo.findOne({ where: { id: conge.userId } });
    if (!employee?.email) return;

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:4200';
    await this.mailSvc.sendCongeStatutEmployee({
      employeeEmail: employee.email,
      employeeName:  `${employee.firstName} ${employee.lastName}`,
      statut,
      typeConge:     this.TYPE_LABELS[conge.typeConge] ?? conge.typeConge,
      dateDebut:     conge.dateDebut,
      dateFin:       conge.dateFin,
      commentaire:   conge.commentaireRH,
      appUrl,
    });
  }

  /* ── Acquisition mensuelle automatique (2,5 j/mois) ───────────── */

  // Tous les 1ers du mois à 00:05
  @Cron('5 0 1 * *')
  async crediterAcquisitionMensuelle(): Promise<void> {
    const now   = new Date();
    const annee = now.getFullYear();
    const mois  = now.getMonth() + 1;

    // Tous les utilisateurs actifs sauf ADMIN
    const users = await this.userRepo.find({
      where: [
        { role: UserRole.COLLABORATEUR },
        { role: UserRole.CHEF_MISSION },
        { role: UserRole.CHEF_ANTENNE },
        { role: UserRole.EXPERT_COMPTABLE },
      ],
    });

    let credites = 0;

    for (const user of users) {
      // Trouver ou créer le solde CONGES_PAYES de l'année
      let solde = await this.soldeRepo.findOne({
        where: { userId: user.id, typeConge: TypeConge.CONGES_PAYES, annee },
      });

      if (!solde) {
        solde = this.soldeRepo.create({
          userId:         user.id,
          typeConge:      TypeConge.CONGES_PAYES,
          annee,
          joursAcquis:    0,
          joursPris:      0,
          joursEnAttente: 0,
          ...(user.tenantId ? { tenantId: user.tenantId } : {}),
        });
      }

      // Garde-fou : ne pas créditer deux fois le même mois
      // On vérifie que joursAcquis < mois * 2.5 (plafond attendu)
      const plafondAttendu = mois * 2.5;
      if (Number(solde.joursAcquis) >= plafondAttendu) {
        continue;
      }

      solde.joursAcquis = Number(solde.joursAcquis) + 2.5;
      await this.soldeRepo.save(solde);
      credites++;
    }

    this.logger.log(
      `Acquisition mensuelle ${mois}/${annee} : ${credites}/${users.length} utilisateurs crédités de 2,5 j`,
    );
  }

  // Déclencher manuellement (admin uniquement, via endpoint dédié)
  async declencherAcquisitionManuellement(): Promise<{ credites: number; total: number }> {
    await this.crediterAcquisitionMensuelle();
    const total = await this.userRepo.count({
      where: [
        { role: UserRole.COLLABORATEUR },
        { role: UserRole.CHEF_MISSION },
        { role: UserRole.CHEF_ANTENNE },
        { role: UserRole.EXPERT_COMPTABLE },
      ],
    });
    return { credites: total, total };
  }

  /* ── Basculement annuel du reliquat (1er janvier) ──────────────── */

  // Le 1er janvier à 00h10 (après le crédit mensuel de 00h05)
  @Cron('10 0 1 1 *')
  async basculerReliquatAnnuel(): Promise<void> {
    const anneeNouvelle   = new Date().getFullYear();
    const anneePrecedente = anneeNouvelle - 1;

    const users = await this.userRepo.find({
      where: [
        { role: UserRole.COLLABORATEUR },
        { role: UserRole.CHEF_MISSION },
        { role: UserRole.CHEF_ANTENNE },
        { role: UserRole.EXPERT_COMPTABLE },
      ],
    });

    let bascules = 0;

    for (const user of users) {
      const soldePrev = await this.soldeRepo.findOne({
        where: { userId: user.id, typeConge: TypeConge.CONGES_PAYES, annee: anneePrecedente },
      });

      if (!soldePrev) continue;

      const reliquat = Math.max(
        0,
        Number(soldePrev.joursAcquis) - Number(soldePrev.joursPris) - Number(soldePrev.joursEnAttente),
      );

      if (reliquat === 0) continue;

      // Trouver ou créer le solde de la nouvelle année
      let soldeNew = await this.soldeRepo.findOne({
        where: { userId: user.id, typeConge: TypeConge.CONGES_PAYES, annee: anneeNouvelle },
      });

      if (!soldeNew) {
        soldeNew = this.soldeRepo.create({
          userId:         user.id,
          typeConge:      TypeConge.CONGES_PAYES,
          annee:          anneeNouvelle,
          joursAcquis:    0,
          joursPris:      0,
          joursEnAttente: 0,
          ...(user.tenantId ? { tenantId: user.tenantId } : {}),
        });
      }

      soldeNew.joursAcquis = Number(soldeNew.joursAcquis) + reliquat;
      await this.soldeRepo.save(soldeNew);

      // Zéroter le reliquat de l'année source pour garantir l'idempotence
      soldePrev.joursAcquis = Number(soldePrev.joursPris) + Number(soldePrev.joursEnAttente);
      await this.soldeRepo.save(soldePrev);

      bascules++;
    }

    this.logger.log(
      `Basculement reliquat ${anneePrecedente}→${anneeNouvelle} : ${bascules} utilisateurs`,
    );
  }

  async declencherBasculementManuellement(anneeSource?: number): Promise<{ bascules: number; details: { userId: number; nom: string; reliquat: number }[] }> {
    const anneePrecedente = anneeSource ?? (new Date().getFullYear() - 1);
    const anneeNouvelle   = anneePrecedente + 1;

    const users = await this.userRepo.find({
      where: [
        { role: UserRole.COLLABORATEUR },
        { role: UserRole.CHEF_MISSION },
        { role: UserRole.CHEF_ANTENNE },
        { role: UserRole.EXPERT_COMPTABLE },
      ],
    });

    const details: { userId: number; nom: string; reliquat: number }[] = [];

    for (const user of users) {
      const soldePrev = await this.soldeRepo.findOne({
        where: { userId: user.id, typeConge: TypeConge.CONGES_PAYES, annee: anneePrecedente },
      });

      if (!soldePrev) continue;

      const reliquat = Math.max(
        0,
        Number(soldePrev.joursAcquis) - Number(soldePrev.joursPris) - Number(soldePrev.joursEnAttente),
      );

      if (reliquat === 0) continue;

      let soldeNew = await this.soldeRepo.findOne({
        where: { userId: user.id, typeConge: TypeConge.CONGES_PAYES, annee: anneeNouvelle },
      });

      if (!soldeNew) {
        soldeNew = this.soldeRepo.create({
          userId:         user.id,
          typeConge:      TypeConge.CONGES_PAYES,
          annee:          anneeNouvelle,
          joursAcquis:    0,
          joursPris:      0,
          joursEnAttente: 0,
          ...(user.tenantId ? { tenantId: user.tenantId } : {}),
        });
      }

      soldeNew.joursAcquis = Number(soldeNew.joursAcquis) + reliquat;
      await this.soldeRepo.save(soldeNew);

      // Zéroter le reliquat de l'année source pour garantir l'idempotence
      soldePrev.joursAcquis = Number(soldePrev.joursPris) + Number(soldePrev.joursEnAttente);
      await this.soldeRepo.save(soldePrev);

      details.push({ userId: user.id, nom: `${user.firstName} ${user.lastName}`, reliquat });
    }

    this.logger.log(`Basculement manuel ${anneePrecedente}→${anneeNouvelle} : ${details.length} utilisateurs`);
    return { bascules: details.length, details };
  }
}
