import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ConstantesPaieRhService } from './constantes-paie-rh.service';
import { CreateConstantePaieRhDto, UpdateConstantePaieRhDto } from './dto/constante-paie-rh.dto';

/**
 * « Liste des constantes » (~Sage 100 Paie & RH) — objet séparé et composable référencé
 * depuis les rubriques de paie interne AFYM. Mutations réservées à l'admin/expert-comptable.
 * Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@ApiTags('Paie RH — Constantes (paramétrage)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/constantes')
export class ConstantesPaieRhController {
  constructor(private service: ConstantesPaieRhService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Créer une constante de paie RH' })
  create(@Body() dto: CreateConstantePaieRhDto, @Req() req: any) {
    return this.service.create(dto, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les constantes — historique complet (toutes dates d\'effet) pour le tenant' })
  findAll(@Req() req: any) {
    return this.service.findAllForTenant(req.user.tenantId);
  }

  @Get('resoudre/:code')
  @ApiOperation({ summary: 'Prévisualiser la valeur résolue d\'une constante pour un régime/date donnés' })
  resoudre(
    @Param('code') code: string,
    @Req() req: any,
    @Query('regime') regime = 'TOUS',
    @Query('date') date?: string,
  ) {
    return this.service.previsualiser(code, regime, req.user.tenantId, date).then((valeur) => ({ code, valeur }));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Modifier une constante de paie RH' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateConstantePaieRhDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Supprimer une constante de paie RH' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.tenantId);
  }
}
