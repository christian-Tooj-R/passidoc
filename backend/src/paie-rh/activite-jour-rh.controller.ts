import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ActiviteJourRhService } from './activite-jour-rh.service';
import type { GranulariteActivite } from './activite-jour-rh.service';

@ApiTags("Paie RH — Feuille d'activité (journalière)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/activite-jour')
export class ActiviteJourRhController {
  constructor(private service: ActiviteJourRhService) {}

  @Get('catalogue')
  @ApiOperation({ summary: "Catalogue fixe des variables d'activité (Présence, Absence, Heures travaillées, Heures sup)" })
  findCatalogue() {
    return this.service.findCatalogue();
  }

  @Get('salarie/:salarieId/grille')
  @ApiOperation({ summary: "Grille journalière d'une variable pour un salarié/mois (~Consultation feuille d'activité)" })
  findGrille(
    @Param('salarieId', ParseIntPipe) salarieId: number,
    @Query('variableCode') variableCode: string,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.findGrilleJournaliere(salarieId, variableCode, mois, annee, req.user.tenantId);
  }

  @Get('salarie/:salarieId/rollup')
  @ApiOperation({ summary: 'Regroupement hebdomadaire/mensuel/annuel' })
  findRollup(
    @Param('salarieId', ParseIntPipe) salarieId: number,
    @Query('variableCode') variableCode: string,
    @Query('granularite') granularite: GranulariteActivite,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.findRollup(salarieId, variableCode, granularite, mois, annee, req.user.tenantId);
  }

  @Post('initialiser')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: "Initialiser les lignes d'activité du mois (toutes variables)" })
  initialiser(
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Query('salarieId') salarieId: string | undefined,
    @Req() req: any,
  ) {
    return this.service.initialiser(mois, annee, req.user.tenantId, salarieId ? +salarieId : undefined);
  }

  @Post('calculer')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: "Calculer les valeurs d'activité (depuis pointage + congés validés)" })
  calculer(
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Query('salarieId') salarieId: string | undefined,
    @Query('recalculerModifs') recalculerModifs: string | undefined,
    @Req() req: any,
  ) {
    return this.service.calculer(mois, annee, req.user.tenantId, salarieId ? +salarieId : undefined, recalculerModifs === 'true');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Corriger manuellement une valeur (protège la ligne du recalcul auto)' })
  modifier(@Param('id', ParseIntPipe) id: number, @Body('valeur') valeur: number, @Req() req: any) {
    return this.service.modifierValeur(id, Number(valeur), req.user.tenantId);
  }
}
