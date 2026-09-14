import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CyclesPaieRhService } from './cycles-paie-rh.service';

@ApiTags('Paie RH — Cycle mensuel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('paie-rh/cycles')
export class CyclesPaieRhController {
  constructor(private service: CyclesPaieRhService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les cycles de paie du tenant' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.tenantId);
  }

  @Post('ouvrir')
  @ApiOperation({ summary: 'Ouvrir (ou récupérer) le cycle de paie du mois' })
  ouvrir(@Query('mois', ParseIntPipe) mois: number, @Query('annee', ParseIntPipe) annee: number, @Req() req: any) {
    return this.service.ouvrir(mois, annee, req.user.tenantId);
  }

  @Get(':mois/:annee')
  @ApiOperation({ summary: "Détail d'un cycle" })
  findOne(@Param('mois') mois: string, @Param('annee') annee: string, @Req() req: any) {
    return this.service.findOne(+mois, +annee, req.user.tenantId);
  }

  @Get(':mois/:annee/salaries')
  @ApiOperation({ summary: 'Liste des salariés à traiter pour la période (assistant de préparation)' })
  listerSalaries(@Param('mois') mois: string, @Param('annee') annee: string, @Req() req: any) {
    return this.service.listerSalariesATraiter(+mois, +annee, req.user.tenantId);
  }

  @Post(':mois/:annee/calculer')
  @ApiOperation({ summary: 'Calculer (générer) en masse les bulletins des salariés restants — `forcer=true` régénère aussi les bulletins existants non payés' })
  calculerTout(
    @Param('mois') mois: string,
    @Param('annee') annee: string,
    @Query('forcer') forcer: string | undefined,
    @Req() req: any,
  ) {
    return this.service.calculerTout(+mois, +annee, req.user.tenantId, forcer === 'true');
  }

  @Post(':mois/:annee/valider')
  @ApiOperation({ summary: 'Valider le cycle (tous les bulletins doivent être générés)' })
  valider(@Param('mois') mois: string, @Param('annee') annee: string, @Req() req: any) {
    return this.service.valider(+mois, +annee, req.user.tenantId, req.user.id);
  }

  @Post(':mois/:annee/devalider')
  @ApiOperation({ summary: 'Dévalider le cycle (retour à CALCULÉ, pour permettre un recalcul)' })
  devalider(@Param('mois') mois: string, @Param('annee') annee: string, @Req() req: any) {
    return this.service.devalider(+mois, +annee, req.user.tenantId);
  }

  @Post(':mois/:annee/cloturer')
  @ApiOperation({ summary: 'Clôturer le cycle (verrouille la période — immutabilité)' })
  cloturer(@Param('mois') mois: string, @Param('annee') annee: string, @Req() req: any) {
    return this.service.cloturer(+mois, +annee, req.user.tenantId);
  }
}
