import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { VariablesPaieService } from './variables-paie.service';
import { UpsertVariablePaieDto } from './dto/variable-paie.dto';

@ApiTags('Paie — Variables mensuelles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie/variables')
export class VariablesPaieController {
  constructor(private service: VariablesPaieService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Créer/mettre à jour les variables de paie du mois pour un employé' })
  upsert(@Body() dto: UpsertVariablePaieDto, @Req() req: any) {
    return this.service.upsert(dto, req.user.tenantId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Variables de paie (par employé, ou par employé+période)' })
  find(
    @Query('employeClientId', ParseIntPipe) employeClientId: number,
    @Query('mois') mois?: string,
    @Query('annee') annee?: string,
  ) {
    if (mois && annee) return this.service.findOneByPeriode(employeClientId, +mois, +annee);
    return this.service.findByEmploye(employeClientId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Supprimer une variable de paie mensuelle' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.tenantId);
  }
}
