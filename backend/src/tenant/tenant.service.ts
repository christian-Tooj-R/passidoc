import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantConfig } from '../entities/tenant-config.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(TenantConfig) private repo: Repository<TenantConfig>,
  ) {}

  async getConfig(tenantId?: number): Promise<TenantConfig | null> {
    if (tenantId) return this.repo.findOne({ where: { id: tenantId } });
    return this.repo.findOne({ where: {} });
  }

  async updateConfig(tenantId: number, dto: Partial<TenantConfig>): Promise<TenantConfig> {
    const config = await this.repo.findOne({ where: { id: tenantId } });
    if (!config) throw new NotFoundException('Configuration introuvable');
    Object.assign(config, dto);
    return this.repo.save(config);
  }
}
