import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateUserDto) {
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({ ...dto, password: hashed });
    const saved = await this.repo.save(user);
    return this.sanitize(saved);
  }

  async findAll() {
    const users = await this.repo.find({ order: { createdAt: 'DESC' } });
    return users.map(this.sanitize);
  }

  async findOne(id: number) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.sanitize(user);
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (dto.password) dto.password = await bcrypt.hash(dto.password, 10);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.repo.update(id, { isActive: false });
    return { message: 'Utilisateur désactivé' };
  }

  async getAssignable(currentUser: User) {
    if (currentUser.role === UserRole.ADMIN) {
      return this.findAll();
    }
    if (currentUser.site === UserSite.REUNION) {
      // Tous les collaborateurs Madagascar actifs + lui-même
      const mgTeam = await this.repo.find({ where: { site: UserSite.MADAGASCAR, isActive: true } });
      const self = await this.repo.findOne({ where: { id: currentUser.id } });
      const result = self ? [self, ...mgTeam] : mgTeam;
      return result.map(u => this.sanitize(u));
    }
    // Collaborateur Madagascar : uniquement lui-même
    const self = await this.repo.findOne({ where: { id: currentUser.id } });
    return self ? [this.sanitize(self)] : [];
  }

  async getMyTeam(currentUser: User) {
    if (currentUser.site === UserSite.REUNION) {
      // Mes collaborateurs Madagascar
      const team = await this.repo.find({ where: { referentId: currentUser.id, isActive: true } });
      return { referent: null, team: team.map(u => this.sanitize(u)) };
    }
    // Collaborateur Madagascar : mon référent Réunion
    const referent = currentUser.referentId
      ? await this.repo.findOne({ where: { id: currentUser.referentId } })
      : null;
    return { referent: referent ? this.sanitize(referent) : null, team: [] };
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

  /** Vue salariés : tous les users actifs + anciens, triés par nom */
  async findSalaries(site?: string) {
    const where: any = site ? { site } : {};
    const users = await this.repo.find({ where, order: { lastName: 'ASC', firstName: 'ASC' } });
    return users.map(this.sanitize);
  }

  /** Mise à jour des champs RH uniquement */
  async updateRH(id: number, dto: {
    poste?: string | null;
    typeContrat?: string | null;
    dateEntree?: string | null;
    dateSortie?: string | null;
    telephone?: string | null;
    firstName?: string;
    lastName?: string;
    site?: string;
  }) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    Object.assign(user, dto);
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

  private sanitize(user: User) {
    const { password, twoFactorSecret, ...safe } = user;
    return safe;
  }
}
