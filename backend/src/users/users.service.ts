import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserAntenne, UserRole, UserSite } from '../entities/user.entity';
import { Task, TaskStatut } from '../entities/task.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateUserDto, tenantId?: number) {
    const where: any = { email: dto.email };
    if (tenantId) where.tenantId = tenantId;
    const exists = await this.repo.findOne({ where });
    if (exists) throw new ConflictException('Email déjà utilisé dans ce cabinet');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({ ...dto, password: hashed, ...(tenantId ? { tenantId, isActive: true } : {}) });
    const saved = await this.repo.save(user);
    return this.sanitize(saved);
  }

  async findAll(currentUser?: User) {
    const tid = currentUser?.tenantId;
    if (currentUser && currentUser.role === UserRole.CHEF_ANTENNE) {
      const users = await this.repo.find({ where: { antenne: currentUser.antenne as UserAntenne, ...(tid ? { tenantId: tid } : {}) }, order: { createdAt: 'DESC' } });
      return users.map(this.sanitize);
    }
    const users = await this.repo.find({ where: tid ? { tenantId: tid } : {}, order: { createdAt: 'DESC' } });
    return users.map(this.sanitize);
  }

  async findOne(id: number, tenantId?: number) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.repo.findOne({ where });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.sanitize(user);
  }

  async update(id: number, dto: UpdateUserDto, tenantId?: number) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.repo.findOne({ where });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (dto.password) dto.password = await bcrypt.hash(dto.password, 10);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number, tenantId?: number) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.repo.findOne({ where });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.repo.update(id, { isActive: false });
    return { message: 'Utilisateur désactivé' };
  }

  async getAssignable(currentUser: User) {
    const tid = currentUser.tenantId;
    const base = tid ? { tenantId: tid } : {};
    if ([UserRole.ADMIN, UserRole.EXPERT_COMPTABLE].includes(currentUser.role)) {
      return this.findAll(currentUser);
    }
    if (currentUser.role === UserRole.CHEF_ANTENNE) {
      const team = await this.repo.find({ where: { ...base, antenne: currentUser.antenne as UserAntenne, isActive: true } });
      const self = await this.repo.findOne({ where: { id: currentUser.id } });
      const all = self ? [self, ...team.filter(u => u.id !== currentUser.id)] : team;
      return all.map(u => this.sanitize(u));
    }
    if (currentUser.role === UserRole.CHEF_MISSION) {
      const team = await this.repo.find({ where: { ...base, referentId: currentUser.id, isActive: true } });
      const self = await this.repo.findOne({ where: { id: currentUser.id } });
      const all = self ? [self, ...team] : team;
      return all.map(u => this.sanitize(u));
    }
    // Symétrique depuis le passage à EST/OUEST : un collaborateur voit l'équipe de
    // l'autre pôle, quel que soit le sien (avant, réservé au pôle 1).
    if (currentUser.site) {
      const autrePole = currentUser.site === UserSite.EST ? UserSite.OUEST : UserSite.EST;
      const autreTeam = await this.repo.find({ where: { ...base, site: autrePole, isActive: true } });
      const self = await this.repo.findOne({ where: { id: currentUser.id } });
      const result = self ? [self, ...autreTeam] : autreTeam;
      return result.map(u => this.sanitize(u));
    }
    const self = await this.repo.findOne({ where: { id: currentUser.id } });
    return self ? [this.sanitize(self)] : [];
  }

  async getMyTeam(currentUser: User) {
    const tid = currentUser.tenantId;
    const base = tid ? { tenantId: tid } : {};
    if ([UserRole.ADMIN, UserRole.EXPERT_COMPTABLE].includes(currentUser.role)) {
      const team = await this.repo.find({ where: { ...base, isActive: true }, order: { lastName: 'ASC', firstName: 'ASC' } });
      return { referent: null, team: team.map(u => this.sanitize(u)) };
    }
    if (currentUser.role === UserRole.CHEF_ANTENNE || currentUser.role === UserRole.GERANT_OUEST) {
      const team = await this.repo.find({ where: { ...base, antenne: currentUser.antenne as UserAntenne, isActive: true } });
      return { referent: null, team: team.map(u => this.sanitize(u)) };
    }
    if (currentUser.role === UserRole.CHEF_MISSION) {
      const team = await this.repo.find({ where: { ...base, referentId: currentUser.id, isActive: true } });
      return { referent: null, team: team.map(u => this.sanitize(u)) };
    }
    // Symétrique depuis le passage à EST/OUEST : plus de branche réservée au pôle 1.
    // Tout collaborateur voit à la fois son référent et ses propres supervisés.
    const team = await this.repo.find({ where: { ...base, referentId: currentUser.id, isActive: true } });
    const referent = currentUser.referentId
      ? await this.repo.findOne({ where: { id: currentUser.referentId } })
      : null;
    return { referent: referent ? this.sanitize(referent) : null, team: team.map(u => this.sanitize(u)) };
  }

  async setReferent(userId: number, referentId: number | null, actorId: number) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const previousReferentId = user.referentId;
    await this.repo.update(userId, { referentId: referentId as any });
    if (referentId) {
      const referent = await this.repo.findOne({ where: { id: referentId } });
      if (userId !== actorId) {
        await this.notifications.emit(userId, {
          type: 'TEAM_ASSIGNED',
          message: `Vous avez été rattaché à l'équipe de ${referent?.firstName} ${referent?.lastName}`,
          titre: `${referent?.firstName} ${referent?.lastName}`,
          clientId: null,
        });
      }
      if (referentId !== actorId) {
        await this.notifications.emit(referentId, {
          type: 'TEAM_ASSIGNED',
          message: `${user.firstName} ${user.lastName} a été ajouté à votre équipe`,
          titre: `${user.firstName} ${user.lastName}`,
          clientId: null,
        });
      }
    } else if (previousReferentId) {
      const previousReferent = await this.repo.findOne({ where: { id: previousReferentId } });
      if (userId !== actorId) {
        await this.notifications.emit(userId, {
          type: 'TEAM_ASSIGNED',
          message: `Vous avez été retiré de l'équipe de ${previousReferent?.firstName} ${previousReferent?.lastName}`,
          titre: `${previousReferent?.firstName} ${previousReferent?.lastName}`,
          clientId: null,
        });
      }
      if (previousReferentId !== actorId) {
        await this.notifications.emit(previousReferentId, {
          type: 'TEAM_ASSIGNED',
          message: `${user.firstName} ${user.lastName} a été retiré de votre équipe`,
          titre: `${user.firstName} ${user.lastName}`,
          clientId: null,
        });
      }
    }
    return this.findOne(userId);
  }

  /** Organigramme : tous les users actifs du tenant (tous rôles) */
  async getOrgChart(tenantId: number) {
    const users = await this.repo.find({
      where: { tenantId, isActive: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return users.map(this.sanitize);
  }

  /** Vue salariés : tous les users actifs + anciens, triés par nom */
  async findSalaries(site?: string, tenantId?: number) {
    const where: any = {};
    if (site) where.site = site;
    if (tenantId) where.tenantId = tenantId;
    const users = await this.repo.find({ where, order: { lastName: 'ASC', firstName: 'ASC' } });
    return users.map(this.sanitize);
  }

  /** Mise à jour des champs RH uniquement */
  async updateRH(id: number, dto: {
    // Identité
    firstName?: string; lastName?: string;
    dateNaissance?: string | null; lieuNaissance?: string | null;
    sexe?: string | null; nationalite?: string | null;
    situationMatrimoniale?: string | null; nbEnfantsCharge?: number | null;
    // Coordonnées
    adresse?: string | null; codePostal?: string | null;
    ville?: string | null; pays?: string | null; telephone?: string | null;
    // Pro
    site?: string; poste?: string | null; departement?: string | null;
    typeContrat?: string | null; dateEntree?: string | null;
    dateFinContrat?: string | null; dateSortie?: string | null;
    statut?: string | null; tempsTravail?: string | null; heuresHebdo?: number | null;
    // Admin
    matricule?: string | null; numeroCIN?: string | null;
    numeroSS?: string | null; numeroFiscal?: string | null;
    // Paie
    salaireBase?: number | null; modePaiement?: string | null;
    banque?: string | null; iban?: string | null; devise?: string | null;
  }, tenantId?: number) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (tenantId && user.tenantId && user.tenantId !== tenantId) {
      throw new ForbiddenException('Accès refusé');
    }
    // Liste blanche explicite (jamais Object.assign direct) — le DTO n'étant pas une
    // classe validée par class-validator, un Object.assign(user, dto) laisserait passer
    // n'importe quelle propriété du corps de requête brut (ex: role, isActive, password).
    const ALLOWED_KEYS = [
      'firstName', 'lastName',
      'dateNaissance', 'lieuNaissance', 'sexe', 'nationalite', 'situationMatrimoniale', 'nbEnfantsCharge',
      'adresse', 'codePostal', 'ville', 'pays', 'telephone',
      'site', 'poste', 'departement', 'typeContrat', 'dateEntree', 'dateFinContrat', 'dateSortie',
      'statut', 'tempsTravail', 'heuresHebdo',
      'matricule', 'numeroCIN', 'numeroSS', 'numeroFiscal',
      'salaireBase', 'modePaiement', 'banque', 'iban', 'devise',
    ] as const;
    for (const key of ALLOWED_KEYS) {
      if (key in dto) (user as any)[key] = (dto as any)[key];
    }
    // Si une date de sortie est renseignée, désactiver le compte
    if (dto.dateSortie) user.isActive = false;
    if (dto.dateSortie === null) user.isActive = true;
    const saved = await this.repo.save(user);
    return this.sanitize(saved);
  }

  async getTheme(userId: number): Promise<Record<string, any>> {
    const user = await this.repo.findOne({ where: { id: userId } });
    return user?.themePrefs ?? {};
  }

  async saveTheme(userId: number, prefs: Record<string, any>): Promise<Record<string, any>> {
    await this.repo.update(userId, { themePrefs: prefs });
    return prefs;
  }

  async getTaskCounts(tenantId?: number): Promise<{ userId: number; count: number }[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .select('t.assigneeId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('t.assigneeId IS NOT NULL')
      .andWhere('t.statut != :done', { done: TaskStatut.TERMINEE });
    if (tenantId) qb.andWhere('t.tenantId = :tenantId', { tenantId });
    const rows = await qb.groupBy('t.assigneeId').getRawMany();
    return rows.map(r => ({ userId: Number(r.userId), count: Number(r.count) }));
  }

  private sanitize(user: User) {
    const { password, twoFactorSecret, ...safe } = user;
    return safe;
  }
}
