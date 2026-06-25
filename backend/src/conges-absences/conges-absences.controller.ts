import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Req, ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CongesAbsencesService } from './conges-absences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TypeConge, StatutConge } from '../entities/conge-absence.entity';

@ApiTags('Congés & Absences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('conges')
export class CongesAbsencesController {
  constructor(private svc: CongesAbsencesService) {}

  /* ── Demandes ─────────────────────────────────────────── */

  @Get()
  @ApiOperation({ summary: 'Liste toutes les demandes' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: StatutConge })
  @ApiQuery({ name: 'annee', required: false })
  findAll(
    @Query('userId') userId?: string,
    @Query('statut') statut?: StatutConge,
    @Query('annee') annee?: string,
  ) {
    return this.svc.findAll({
      userId: userId ? Number(userId) : undefined,
      statut,
      annee: annee ? Number(annee) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques congés' })
  @ApiQuery({ name: 'annee', required: false })
  getStats(@Query('annee') annee?: string) {
    return this.svc.getStats(annee ? Number(annee) : undefined);
  }

  @Get('mes-demandes')
  @ApiOperation({ summary: 'Mes demandes de congés' })
  mesDemandes(@Req() req: any, @Query('annee') annee?: string) {
    return this.svc.findAll({
      userId: req.user.id,
      annee: annee ? Number(annee) : undefined,
    });
  }

  @Get('mes-soldes')
  @ApiOperation({ summary: 'Mes soldes de congés' })
  mesSoldes(@Req() req: any, @Query('annee') annee?: string) {
    return this.svc.getSoldes(req.user.id, annee ? Number(annee) : undefined);
  }

  @Post()
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
    return this.svc.create({ ...dto, userId });
  }

  @Patch(':id/approuver')
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
  @ApiOperation({ summary: 'Annuler sa propre demande' })
  annuler(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.svc.annuler(id, req.user.id);
  }

  /* ── Soldes ───────────────────────────────────────────── */

  @Get('soldes/:userId')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Soldes d\'un collaborateur' })
  getSoldes(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('annee') annee?: string,
  ) {
    return this.svc.getSoldes(userId, annee ? Number(annee) : undefined);
  }

  @Patch('soldes/:userId')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Mettre à jour le solde d\'un collaborateur' })
  updateSolde(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: { typeConge: TypeConge; annee: number; joursAcquis: number },
  ) {
    return this.svc.updateSolde(userId, dto.typeConge, dto.annee, dto.joursAcquis);
  }
}
