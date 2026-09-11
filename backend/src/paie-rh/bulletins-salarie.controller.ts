import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { BulletinsSalarieService } from './bulletins-salarie.service';

@ApiTags('Paie RH — Bulletins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/bulletins')
export class BulletinsSalarieController {
  constructor(private service: BulletinsSalarieService) {}

  @Get('calculer')
  @ApiOperation({ summary: "Aperçu du calcul d'un bulletin (sans le persister)" })
  calculer(
    @Query('salarieId', ParseIntPipe) salarieId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.calculer(salarieId, mois, annee, req.user.tenantId);
  }

  @Get('apercu-pdf')
  @ApiOperation({ summary: "Aperçu PDF du bulletin en direct (sans le persister) — bouton \"Aperçu / Imprimer\"" })
  async apercuPdf(
    @Query('salarieId', ParseIntPipe) salarieId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.apercuPdf(salarieId, mois, annee, req.user.tenantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="apercu-bulletin-${salarieId}-${mois}-${annee}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get('cumul-annuel')
  @ApiOperation({ summary: "Cumul annuel (janvier → période incluse) des bulletins déjà générés d'un salarié" })
  cumulAnnuel(
    @Query('salarieId', ParseIntPipe) salarieId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.cumulAnnuel(salarieId, mois, annee, req.user.tenantId);
  }

  @Post('generer')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Générer (et persister) le bulletin de salaire du mois' })
  generer(
    @Query('salarieId', ParseIntPipe) salarieId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.generer(salarieId, mois, annee, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les bulletins (par salarié ou par période)' })
  find(@Req() req: any, @Query('salarieId') salarieId?: string, @Query('mois') mois?: string, @Query('annee') annee?: string) {
    if (salarieId) return this.service.findBySalarie(+salarieId, req.user.tenantId);
    if (mois && annee) return this.service.findByPeriode(+mois, +annee, req.user.tenantId);
    return [];
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger le bulletin de salaire en PDF' })
  async pdf(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    const buffer = await this.service.genererPdf(id, req.user.tenantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bulletin-salaire-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post(':id/paiement')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Enregistrer le paiement du bulletin (donnée informative uniquement)' })
  enregistrerPaiement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { datePaiement: string; modePaiement: string; referencePaiement?: string },
    @Req() req: any,
  ) {
    return this.service.enregistrerPaiement(id, req.user.tenantId, dto);
  }

  @Post(':id/dupliquer')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Générer un duplicata clairement identifié (BUL-007)' })
  dupliquer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.dupliquer(id, req.user.tenantId);
  }

  @Post(':id/regularisation')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Générer un bulletin correctif/régularisation sans écraser l\'original (BUL-008)' })
  regularisation(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.genererRegularisation(id, req.user.tenantId);
  }
}

/**
 * Portail salarié (V1) : un collaborateur connecté ne peut consulter QUE ses propres
 * bulletins déjà générés — CDC §18/critère d'acceptation §34 ("Un salarié peut consulter
 * son bulletin après publication"). Aucune restriction de rôle au-delà de l'authentification.
 */
@ApiTags('Paie RH — Portail salarié')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('paie-rh/mes-bulletins')
export class MesBulletinsController {
  constructor(private service: BulletinsSalarieService) {}

  @Get()
  @ApiOperation({ summary: 'Mes bulletins de salaire déjà générés' })
  mesBulletins(@Req() req: any) {
    return this.service.findMesBulletins(req.user.id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger un de mes bulletins en PDF' })
  async pdf(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    const buffer = await this.service.genererPdfPourSalarie(id, req.user.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bulletin-salaire-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
