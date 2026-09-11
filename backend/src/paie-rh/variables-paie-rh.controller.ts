import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { VariablesPaieRhService } from './variables-paie-rh.service';
import { UpsertVariablePaieRhDto } from './dto/variable-paie-rh.dto';

@ApiTags('Paie RH — Variables mensuelles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/variables')
export class VariablesPaieRhController {
  constructor(private service: VariablesPaieRhService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Créer ou mettre à jour les variables de paie du mois pour un salarié' })
  upsert(@Body() dto: UpsertVariablePaieRhDto, @Req() req: any) {
    return this.service.upsert(dto, req.user.tenantId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Lister les variables d'un salarié, ou celles d'une période précise" })
  find(
    @Query('salarieId', ParseIntPipe) salarieId: number,
    @Query('mois') mois: string | undefined,
    @Query('annee') annee: string | undefined,
    @Req() req: any,
  ) {
    if (mois && annee) return this.service.findOneByPeriode(salarieId, +mois, +annee, req.user.tenantId);
    return this.service.findBySalarie(salarieId, req.user.tenantId);
  }

  @Get('activite')
  @ApiOperation({ summary: "Vue globale de l'activité de tous les salariés pour une période (~Feuille d'activité)" })
  findActivite(@Query('mois', ParseIntPipe) mois: number, @Query('annee', ParseIntPipe) annee: number, @Req() req: any) {
    return this.service.findActiviteParPeriode(mois, annee, req.user.tenantId);
  }

  @Post('activite/recalculer')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: "Recalculer l'activité (absences + acomptes) de tous les salariés de la période" })
  recalculerActivite(@Query('mois', ParseIntPipe) mois: number, @Query('annee', ParseIntPipe) annee: number, @Req() req: any) {
    return this.service.recalculerActivitePeriode(mois, annee, req.user.tenantId);
  }

  @Post('salarie/:salarieId/synchroniser-absences')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Resynchroniser les absences validées du mois depuis le circuit congés/absences' })
  synchroniserAbsences(
    @Param('salarieId', ParseIntPipe) salarieId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.synchroniserAbsences(salarieId, mois, annee, req.user.tenantId);
  }

  @Post('salarie/:salarieId/synchroniser-acomptes')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Resynchroniser les acomptes validés du mois' })
  synchroniserAcomptes(
    @Param('salarieId', ParseIntPipe) salarieId: number,
    @Query('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.service.synchroniserAcomptes(salarieId, mois, annee, req.user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Supprimer les variables de paie du mois' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.tenantId);
  }
}
