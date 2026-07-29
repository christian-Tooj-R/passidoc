import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantConfig } from '../entities/tenant-config.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(TenantConfig) private repo: Repository<TenantConfig>,
  ) {}

  async getConfig(): Promise<TenantConfig | null> {
    return this.repo.findOne({ where: {} });
  }

  async updateConfig(dto: Partial<TenantConfig>): Promise<TenantConfig> {
    const config = await this.repo.findOne({ where: {} });
    if (!config) throw new NotFoundException('Configuration introuvable');
    Object.assign(config, dto);
    return this.repo.save(config);
  }
}
