import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { RubriquesPaieRhService } from './rubriques-paie-rh.service';
import { CreateRubriquePaieRhDto, UpdateRubriquePaieRhDto } from './dto/rubrique-paie-rh.dto';

/**
 * Paramétrage des rubriques de paie interne AFYM (cotisations, primes fixes, retenues
 * fixes...). Mutations réservées à l'admin/expert-comptable : ce sont les taux appliqués
 * à tous les bulletins du régime concerné.
 */
@ApiTags('Paie RH — Rubriques (paramétrage)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/rubriques')
export class RubriquesPaieRhController {
  constructor(private service: RubriquesPaieRhService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Créer une rubrique de paie RH' })
  create(@Body() dto: CreateRubriquePaieRhDto, @Req() req: any) {
    return this.service.create(dto, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les rubriques (par régime ou toutes pour le tenant)' })
  find(@Req() req: any, @Query('regime') regime?: string) {
    if (regime) return this.service.findByRegime(regime, req.user.tenantId);
    return this.service.findAllForTenant(req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Modifier une rubrique de paie RH' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRubriquePaieRhDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Supprimer une rubrique de paie RH' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.tenantId);
  }
}
