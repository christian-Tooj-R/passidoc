import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Req, ParseIntPipe, HttpCode, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CongesAbsencesService } from './conges-absences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TypeConge, StatutConge } from '../entities/conge-absence.entity';

const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:4200').split(',').map(o => o.trim());

function isSafeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.some(o => {
      const allowed = new URL(o);
      return parsed.origin === allowed.origin;
    });
  } catch { return false; }
}

@ApiTags('Congés & Absences')
@Controller('conges')
export class CongesAbsencesController {
  constructor(private svc: CongesAbsencesService) {}

  /* ── Calendrier (public auth) ─────────────────────────────── */

  @Get('calendrier')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Calendrier des absences (motif masqué)' })
  @ApiQuery({ name: 'mois',  required: true  })
  @ApiQuery({ name: 'annee', required: true  })
  @ApiQuery({ name: 'site',  required: false })
  getCalendrier(
    @Req() req: any,
    @Query('mois')  mois:  string,
    @Query('annee') annee: string,
    @Query('site')  site?: string,
  ) {
    return this.svc.getCalendrier(Number(mois), Number(annee), site, req.user?.tenantId);
  }

  /* ── Action email (sans auth — token JWT dans l'URL) ────────── */

  @Get(':id/email-action')
  @ApiOperation({ summary: 'Approuver ou refuser via lien email' })
  async emailAction(
    @Param('id', ParseIntPipe) id: number,
    @Query('token')    token:    string,
    @Query('action')   action:   'approuver' | 'refuser',
    @Query('redirect') redirect: string,
    @Res() res: Response,
  ) {
    const safeUrl = redirect && isSafeRedirect(redirect)
      ? redirect
      : (ALLOWED_ORIGINS[0] + '/rh/conges');
    try {
      const result = await this.svc.approuverParEmailToken(id, action, token);
      const msg = encodeURIComponent(result.message);
      return res.redirect(`${safeUrl}?email_action=${result.statut}&msg=${msg}`);
    } catch (e: any) {
      const msg = encodeURIComponent(e.message ?? 'Erreur');
      return res.redirect(`${safeUrl}?email_action=ERROR&msg=${msg}`);
    }
  }

  /* ── Demandes ─────────────────────────────────────────────── */

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Liste toutes les demandes' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: StatutConge })
  @ApiQuery({ name: 'annee', required: false })
  findAll(
    @Req() req: any,
    @Query('userId') userId?: string,
    @Query('statut') statut?: StatutConge,
    @Query('annee') annee?: string,
  ) {
    return this.svc.findAll({
      userId: userId ? Number(userId) : undefined,
      statut,
      annee: annee ? Number(annee) : undefined,
      tenantId: req.user?.tenantId,
    });
  }

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Statistiques congés' })
  @ApiQuery({ name: 'annee', required: false })
  getStats(@Req() req: any, @Query('annee') annee?: string) {
    return this.svc.getStats(annee ? Number(annee) : undefined, req.user?.tenantId);
  }

  @Get('mes-demandes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mes demandes de congés' })
  mesDemandes(@Req() req: any, @Query('annee') annee?: string) {
    return this.svc.findAll({
      userId: req.user.id,
      annee: annee ? Number(annee) : undefined,
      tenantId: req.user?.tenantId,
    });
  }

  @Get('mes-soldes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mes soldes de congés' })
  mesSoldes(@Req() req: any, @Query('annee') annee?: string) {
    return this.svc.getSoldes(req.user.id, annee ? Number(annee) : undefined);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Soumettre une demande de congé' })
  create(@Req() req: any, @Body() dto: {
    typeConge: TypeConge;
    dateDebut: string;
    dateFin: string;
    nombreJours: number;
    motif?: string;
    userId?: number;
  }) {
    const userId = dto.userId ?? req.user.id;
    return this.svc.create({ ...dto, userId, tenantId: req.user?.tenantId });
  }

  @Patch(':id/approuver')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Approuver une demande' })
  approuver(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body('commentaire') commentaire?: string,
  ) {
    return this.svc.approuver(id, req.user.id, commentaire);
  }

  @Patch(':id/refuser')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Refuser une demande' })
  refuser(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body('commentaire') commentaire?: string,
  ) {
    return this.svc.refuser(id, req.user.id, commentaire);
  }

  @Patch(':id/annuler')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Annuler sa propre demande' })
  annuler(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.svc.annuler(id, req.user.id);
  }

  /* ── Soldes ───────────────────────────────────────────────── */

  @Get('soldes/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Soldes d\'un collaborateur' })
  getSoldes(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('annee') annee?: string,
  ) {
    return this.svc.getSoldes(userId, annee ? Number(annee) : undefined);
  }

  @Patch('soldes/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Mettre à jour le solde d\'un collaborateur' })
  updateSolde(
    @Req() req: any,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: { typeConge: TypeConge; annee: number; joursAcquis: number },
  ) {
    return this.svc.updateSolde(userId, dto.typeConge, dto.annee, dto.joursAcquis, req.user?.tenantId);
  }

  @Post('admin/acquisition-mensuelle')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Déclencher manuellement l\'acquisition mensuelle (+2,5 j)' })
  declencherAcquisition() {
    return this.svc.declencherAcquisitionManuellement();
  }

  @Post('admin/basculement-reliquat')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Basculer le reliquat de l\'année N vers l\'année N+1' })
  declencherBasculement(@Body() body?: { anneeSource?: number }) {
    return this.svc.declencherBasculementManuellement(body?.anneeSource);
  }
}
