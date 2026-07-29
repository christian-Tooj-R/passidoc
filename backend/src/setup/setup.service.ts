import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantConfig } from '../entities/tenant-config.entity';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { SetupDto } from './setup.dto';

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(TenantConfig) private configRepo: Repository<TenantConfig>,
    @InjectRepository(User)         private userRepo:   Repository<User>,
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

    return { message: 'Configuration terminée avec succès' };
  }
}
