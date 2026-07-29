import { Injectable, ForbiddenException } from '@nestjs/common';
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

  async getStatus(): Promise<{ configured: boolean }> {
    const config = await this.configRepo.findOne({ where: {} });
    return { configured: config?.isConfigured ?? false };
  }

  async setup(dto: SetupDto): Promise<{ message: string }> {
    const existing = await this.configRepo.findOne({ where: {} });
    if (existing?.isConfigured) {
      throw new ForbiddenException('Application déjà configurée');
    }

    if (existing) {
      await this.configRepo.update(existing.id, {
        nomSociete:  dto.nomSociete,
        logoUrl:     dto.logoUrl,
        slogan:      dto.slogan,
        ville:       dto.ville,
        pays:        dto.pays,
        poleLabel1:  dto.poleLabel1 || 'La Réunion',
        poleLabel2:  dto.poleLabel2 || 'Madagascar',
        isConfigured: true,
      });
    } else {
      await this.configRepo.save(this.configRepo.create({
        nomSociete:  dto.nomSociete,
        logoUrl:     dto.logoUrl,
        slogan:      dto.slogan,
        ville:       dto.ville,
        pays:        dto.pays,
        poleLabel1:  dto.poleLabel1 || 'La Réunion',
        poleLabel2:  dto.poleLabel2 || 'Madagascar',
        isConfigured: true,
      }));
    }

    const existingAdmin = await this.userRepo.findOne({ where: { email: dto.adminEmail } });
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
      }));
    }

    return { message: 'Configuration terminée avec succès' };
  }
}
