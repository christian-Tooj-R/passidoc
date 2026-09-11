import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { DeclarationsPaieRhService } from './declarations-paie-rh.service';

@ApiTags('Paie RH — Déclarations (V1, récapitulatif)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
@Controller('paie-rh/declarations')
export class DeclarationsPaieRhController {
  constructor(private service: DeclarationsPaieRhService) {}

  @Get('recap')
  @ApiOperation({ summary: 'Récapitulatif agrégé par rubrique pour une période (base de déclaration, pas un fichier officiel)' })
  recap(@Query('mois') mois: string, @Query('annee') annee: string, @Req() req: any) {
    return this.service.recapPeriode(+mois, +annee, req.user.tenantId);
  }
}
