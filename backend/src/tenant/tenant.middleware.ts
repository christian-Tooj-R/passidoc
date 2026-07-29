import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response, NextFunction } from 'express';
import { TenantConfig } from '../entities/tenant-config.entity';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(TenantConfig) private repo: Repository<TenantConfig>,
  ) {}

  async use(req: Request & { tenant?: TenantConfig | null; tenantSlug?: string }, _res: Response, next: NextFunction) {
    const slug = this.extractSlug(req);
    req.tenantSlug = slug ?? undefined;

    if (slug) {
      req.tenant = await this.repo.findOne({ where: { slug } }) ?? null;
    } else {
      req.tenant = null;
    }

    next();
  }

  private extractSlug(req: Request): string | null {
    // 1. Header explicite (dev local / tests)
    const header = req.headers['x-tenant-slug'] as string | undefined;
    if (header) return header.toLowerCase().trim();

    // 2. Sous-domaine du Host
    const host = (req.headers['x-forwarded-host'] as string) || req.hostname || '';
    const bare = host.split(':')[0]; // retire le port
    const parts = bare.split('.');

    // "afym.passidoc.re" → 3 parts → slug = "afym"
    // "passidoc.re" ou "localhost" → ≤ 2 parts → pas de sous-domaine
    if (parts.length >= 3) return parts[0].toLowerCase();

    return null;
  }
}
