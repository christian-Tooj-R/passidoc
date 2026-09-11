import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ComptabilitePaieRhService } from './comptabilite-paie-rh.service';

@ApiTags('Paie RH — Comptabilité (V1, export simple)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
@Controller('paie-rh/comptabilite')
export class ComptabilitePaieRhController {
  constructor(private service: ComptabilitePaieRhService) {}

  @Get('export-csv')
  @ApiOperation({ summary: 'Export CSV des écritures agrégées par rubrique pour une période (pas d\'intégration comptable réelle)' })
  async exportCsv(@Query('mois') mois: string, @Query('annee') annee: string, @Req() req: any, @Res() res: Response) {
    const csv = await this.service.exportEcrituresCsv(+mois, +annee, req.user.tenantId);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ecritures-paie-rh-${mois}-${annee}.csv"`,
    });
    res.send(csv);
  }
}
