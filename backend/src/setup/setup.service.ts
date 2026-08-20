import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantConfig } from '../entities/tenant-config.entity';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { SetupDto } from './setup.dto';
import { SecteursService } from '../secteurs/secteurs.service';

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(TenantConfig) private configRepo:    Repository<TenantConfig>,
    @InjectRepository(User)         private userRepo:      Repository<User>,
    @InjectDataSource()             private dataSource:    DataSource,
    private                         secteursService:       SecteursService,
  ) {}

  async getStatus(slug?: string): Promise<{ configured: boolean }> {
    if (!slug) return { configured: false };
    const config = await this.configRepo.findOne({ where: { slug } });
    return { configured: config?.isConfigured ?? false };
  }

  async setup(dto: SetupDto): Promise<{ message: string }> {
    const existing = await this.configRepo.findOne({ where: { slug: dto.slug } });
    if (existing?.isConfigured) {
      throw new ConflictException(`Le sous-domaine "${dto.slug}" est déjà utilisé`);
    }

    let config = existing ?? this.configRepo.create();
    Object.assign(config, {
      slug:        dto.slug,
      nomSociete:  dto.nomSociete,
      logoUrl:     dto.logoUrl,
      slogan:      dto.slogan,
      ville:       dto.ville,
      pays:        dto.pays,
      poleLabel1:  dto.poleLabel1 || 'La Réunion',
      poleLabel2:  dto.poleLabel2 || 'Madagascar',
      poleFlag1:   dto.poleFlag1  || '🇷🇪',
      poleFlag2:   dto.poleFlag2  || '🇲🇬',
      isConfigured: true,
    });
    const savedConfig = await this.configRepo.save(config);

    const existingAdmin = await this.userRepo.findOne({
      where: { email: dto.adminEmail, tenantId: savedConfig.id },
    });
    if (!existingAdmin) {
      const hashed = await bcrypt.hash(dto.adminPassword, 10);
      await this.userRepo.save(this.userRepo.create({
        firstName: dto.adminFirstName,
        lastName:  dto.adminLastName,
        email:     dto.adminEmail,
        password:  hashed,
        role:      UserRole.ADMIN,
        site:      UserSite.REUNION,
        isActive:  true,
        tenantId:  savedConfig.id,
      }));
    }

    await this.secteursService.seedForTenant(savedConfig.id);

    return { message: 'Configuration terminée avec succès' };
  }

  async recoverAdmin(slug: string): Promise<{ email: string; firstName: string; lastName: string }> {
    const config = await this.configRepo.findOne({ where: { slug } });
    if (!config) throw new ForbiddenException(`Tenant "${slug}" introuvable`);
    const admin = await this.userRepo.findOne({
      where: { tenantId: config.id, role: UserRole.ADMIN },
    });
    if (!admin) throw new ForbiddenException('Aucun admin trouvé pour ce tenant');
    return { email: admin.email, firstName: admin.firstName, lastName: admin.lastName };
  }

  async resetAdminPassword(
    slug: string,
    newPassword: string,
    opts?: { email?: string; firstName?: string; lastName?: string },
  ): Promise<{ message: string; email: string }> {
    const config = await this.configRepo.findOne({ where: { slug } });
    if (!config) throw new ForbiddenException(`Tenant "${slug}" introuvable`);
    const hashed = await bcrypt.hash(newPassword, 10);

    const admin = await this.userRepo.findOne({ where: { tenantId: config.id, role: UserRole.ADMIN } });
    if (admin) {
      const update: Partial<User> = { password: hashed };
      if (opts?.email)     update.email     = opts.email;
      if (opts?.firstName) update.firstName = opts.firstName;
      if (opts?.lastName)  update.lastName  = opts.lastName;
      await this.userRepo.update(admin.id, update);
      return { message: 'Mot de passe réinitialisé', email: opts?.email ?? admin.email };
    }

    // Pas d'admin : on en crée un
    const email     = opts?.email     ?? `admin@${slug}.local`;
    const firstName = opts?.firstName ?? 'Admin';
    const lastName  = opts?.lastName  ?? slug;
    await this.userRepo.save(this.userRepo.create({
      email, firstName, lastName, password: hashed,
      role: UserRole.ADMIN, site: UserSite.REUNION,
      isActive: true, tenantId: config.id,
    }));
    return { message: 'Admin créé', email };
  }

  async activate(slug: string): Promise<{ message: string }> {
    const config = await this.configRepo.findOne({ where: { slug } });
    if (!config) throw new ForbiddenException(`Tenant "${slug}" introuvable`);
    await this.configRepo.update(config.id, { isConfigured: true });
    return { message: `Tenant "${slug}" marqué comme configuré` };
  }

  async resetDatabase(): Promise<{ message: string }> {
    const dbType = this.dataSource.options.type;

    if (dbType === 'postgres') {
      await this.dataSource.query('DROP SCHEMA public CASCADE');
      await this.dataSource.query('CREATE SCHEMA public');
      await this.dataSource.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    } else {
      // MySQL fallback
      const rows = await this.dataSource.query('SHOW TABLES');
      await this.dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const row of rows) {
        const table = Object.values(row)[0] as string;
        await this.dataSource.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await this.dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    // Recrée toutes les tables à partir des entités enregistrées
    await this.dataSource.synchronize();

    // Re-seeder les secteurs d'activité (onModuleInit ne se relance pas)
    await this.secteursService.seedIfEmpty();

    return { message: 'Base de données réinitialisée — tous les tokens existants sont invalidés' };
  }
}
