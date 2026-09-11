import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { BulletinsPaieService } from './bulletins-paie.service';

@ApiTags('Paie — Bulletins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie/bulletins')
export class BulletinsPaieController {
  constructor(private service: BulletinsPaieService) {}

  @Get('calculer')
  @ApiOperation({ summary: "Aperçu du calcul d'un bulletin (sans le persister)" })
  calculer(
    @Query('employeClientId', ParseIntPipe) employeClientId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.calculer(employeClientId, mois, annee, req.user.tenantId);
  }

  @Post('generer')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Générer (et persister) le bulletin de paie du mois' })
  generer(
    @Query('employeClientId', ParseIntPipe) employeClientId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.generer(employeClientId, mois, annee, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les bulletins (par employé ou par client)' })
  find(@Req() req: any, @Query('employeClientId') employeClientId?: string, @Query('clientId') clientId?: string) {
    if (employeClientId) return this.service.findByEmploye(+employeClientId, req.user.tenantId);
    if (clientId) return this.service.findByClient(+clientId, req.user.tenantId);
    return [];
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger le bulletin de paie en PDF' })
  async pdf(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    const buffer = await this.service.genererPdf(id, req.user.tenantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bulletin-paie-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
