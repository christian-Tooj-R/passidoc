import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ParametresPaieService } from './parametres-paie.service';
import { CreateParametrePaieDto, UpdateParametrePaieDto } from './dto/parametre-paie.dto';

@ApiTags('Paie — Paramètres du moteur')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie/parametres')
export class ParametresPaieController {
  constructor(private service: ParametresPaieService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Créer un paramètre du moteur de paie' })
  create(@Body() dto: CreateParametrePaieDto, @Req() req: any) {
    return this.service.create(dto, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les paramètres (par régime ou tous pour le tenant)' })
  find(@Req() req: any, @Query('regime') regime?: string) {
    if (regime) return this.service.findByRegime(regime, req.user.tenantId);
    return this.service.findAllForTenant(req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Modifier un paramètre du moteur de paie' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParametrePaieDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Supprimer un paramètre du moteur de paie' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.tenantId);
  }
}
