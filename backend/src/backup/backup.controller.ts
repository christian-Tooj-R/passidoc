import { Controller, Get, Query, Req, Res, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../entities/user.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { BackupService } from './backup.service';

@ApiTags('Export / Sauvegarde')
@Controller('backup')
export class BackupController {
  constructor(
    private service: BackupService,
    private config: ConfigService,
    @InjectRepository(TenantConfig) private tenantRepo: Repository<TenantConfig>,
  ) {}

  @Get('export-sql')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Exporter toutes les données du tenant en fichier .sql' })
  async exportSql(@Req() req: any, @Res() res: Response) {
    await this.streamExport(req.user.tenantId, res);
  }

  /**
   * Même export, mais accessible sans login via un secret dédié
   * (BACKUP_SECRET, distinct de RESET_SECRET qui sert à des opérations
   * destructrices — on ne veut pas qu'une fuite du secret de sauvegarde
   * permette aussi de vider la base) — pratique pour déclencher une
   * sauvegarde d'urgence sans avoir à partager un mot de passe de compte réel.
   */
  @Get('export-sql-secret')
  @Public()
  @ApiOperation({ summary: 'Export via secret partagé (sans login) — requiert ?secret= et ?slug= ou ?tenantId=' })
  @ApiQuery({ name: 'secret', required: true })
  @ApiQuery({ name: 'slug', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async exportSqlBySecret(
    @Query('secret') secret: string,
    @Query('slug') slug: string | undefined,
    @Query('tenantId') tenantIdParam: string | undefined,
    @Res() res: Response,
  ) {
    const expected = this.config.get<string>('BACKUP_SECRET');
    if (!expected || !secret || secret !== expected) {
      throw new ForbiddenException('Secret invalide');
    }

    let tenantId: number | undefined;
    if (tenantIdParam) {
      tenantId = Number(tenantIdParam);
    } else if (slug) {
      const tenant = await this.tenantRepo.findOne({ where: { slug } });
      if (!tenant) throw new NotFoundException(`Tenant "${slug}" introuvable`);
      tenantId = tenant.id;
    }
    if (!tenantId) throw new ForbiddenException('Précisez ?slug= ou ?tenantId=');

    await this.streamExport(tenantId, res);
  }

  private async streamExport(tenantId: number, res: Response) {
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="passidoc-export-${date}.sql"`);
    await this.service.exportSql(tenantId, res);
  }
}
