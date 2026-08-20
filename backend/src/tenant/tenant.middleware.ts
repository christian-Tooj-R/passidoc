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
    // 1. Header explicite (dev local / frontend Angular)
    const header = req.headers['x-tenant-slug'] as string | undefined;
    if (header) return header.toLowerCase().trim();

    // 2. Sous-domaine réel uniquement (ex: afym.passidoc.re)
    // Ignorer les domaines hébergeurs (onrender.com, etc.) qui ne sont pas des sous-domaines tenant
    const host = req.hostname || '';
    const bare = host.split(':')[0];
    const parts = bare.split('.');
    const hebergeurs = ['onrender.com', 'vercel.app', 'netlify.app', 'pages.dev'];
    const isHebergeur = hebergeurs.some(h => bare.endsWith(h));

    if (parts.length >= 3 && !isHebergeur) return parts[0].toLowerCase();

    return null;
  }
}
