import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ContratsTravailService } from './contrats-travail.service';
import { CreateContratTravailDto, UpdateContratTravailDto } from './dto/contrat-travail.dto';

@ApiTags('Paie RH — Contrats de travail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/contrats')
export class ContratsTravailController {
  constructor(private service: ContratsTravailService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Créer un contrat de travail pour un collaborateur' })
  create(@Body() dto: CreateContratTravailDto, @Req() req: any) {
    return this.service.create(dto, req.user.tenantId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Lister les contrats d'un salarié ou tous les contrats actifs" })
  find(@Req() req: any, @Query('salarieId') salarieId?: string, @Query('actifs') actifs?: string) {
    if (salarieId) return this.service.findBySalarie(+salarieId, req.user.tenantId);
    if (actifs === 'true') return this.service.findTousActifs(req.user.tenantId);
    return [];
  }

  @Get('salarie/:salarieId/actif')
  @ApiOperation({ summary: 'Contrat actif courant d\'un salarié' })
  findActif(@Param('salarieId', ParseIntPipe) salarieId: number, @Req() req: any) {
    return this.service.findActifBySalarie(salarieId, req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un contrat" })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Modifier un contrat de travail (avenant)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContratTravailDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.tenantId, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un contrat de travail' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.tenantId);
  }
}
