import { Controller, Post, Get, Body, Param, Query, UseGuards, HttpCode, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';
import { PointageService } from './pointage.service';

@ApiTags('Pointage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pointage')
export class PointageController {
  constructor(private svc: PointageService) {}

  @Post('pointer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pointer arrivée, pause ou départ avec coordonnées GPS' })
  @ApiBody({ schema: { properties: {
    latitude:  { type: 'number' },
    longitude: { type: 'number' },
    action:    { type: 'string', enum: ['debut_pause', 'fin_pause', 'depart'] },
  }}})
  pointer(
    @CurrentUser() user: User,
    @Body() body: { latitude?: number; longitude?: number; action?: 'debut_pause' | 'fin_pause' | 'depart' },
  ) {
    return this.svc.pointer(user.id, body.latitude, body.longitude, body.action);
  }

  @Get('journee')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Vue journalière de tous les collaborateurs (admin/expert)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-18' })
  @ApiQuery({ name: 'site', required: false, enum: ['REUNION', 'MADAGASCAR'] })
  getJournee(@Query('date') date?: string, @Query('site') site?: string) {
    const d = date ?? new Date().toISOString().split('T')[0];
    return this.svc.getJournee(d, site);
  }

  @Get('mon-statut')
  @ApiOperation({ summary: 'Statut de pointage du jour pour l\'utilisateur connecté' })
  getMonStatut(@CurrentUser() user: User) {
    return this.svc.getMonStatut(user.id);
  }

  @Get('historique')
  @ApiOperation({ summary: 'Historique des 30 derniers jours' })
  getHistorique(@CurrentUser() user: User) {
    return this.svc.getHistorique(user.id);
  }

  @Get('historique/all')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Historique global tous utilisateurs (admin/expert)' })
  @ApiQuery({ name: 'site', required: false, enum: ['REUNION', 'MADAGASCAR'] })
  getHistoriqueAll(@Query('site') site?: string) {
    return this.svc.getHistoriqueAll(site);
  }

  // ── Emplacement bureau ─────────────────────────────────────────
  @Get('site-location/:site')
  @ApiOperation({ summary: 'Coordonnées GPS du bureau pour un site' })
  getSiteLocation(@Param('site') site: string) {
    return this.svc.getSiteLocation(site);
  }

  @Patch('site-location/:site')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Configurer les coordonnées GPS du bureau' })
  @ApiBody({ schema: { properties: {
    latitude:     { type: 'number' },
    longitude:    { type: 'number' },
    radiusMeters: { type: 'number', default: 300 },
    adresse:      { type: 'string' },
  }}})
  upsertSiteLocation(
    @Param('site') site: string,
    @Body() body: { latitude: number; longitude: number; radiusMeters?: number; adresse?: string },
  ) {
    return this.svc.upsertSiteLocation(site, body.latitude, body.longitude, body.radiusMeters ?? 300, body.adresse);
  }

  @Delete('site-location/:site')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Supprimer la configuration GPS du bureau' })
  deleteSiteLocation(@Param('site') site: string) {
    return this.svc.deleteSiteLocation(site);
  }
}
