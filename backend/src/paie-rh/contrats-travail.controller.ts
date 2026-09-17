import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  /** ADMIN et EXPERT_COMPTABLE gèrent les contrats de tous ; un salarié ne consulte que le sien. */
  private assertCanView(req: any, salarieId: number) {
    const role = req.user?.role;
    const privileged = role === UserRole.ADMIN || role === UserRole.EXPERT_COMPTABLE;
    if (!privileged && req.user?.id !== salarieId) {
      throw new ForbiddenException('Accès réservé à votre propre contrat');
    }
  }

  @Get()
  @ApiOperation({ summary: "Lister les contrats d'un salarié ou tous les contrats actifs" })
  find(@Req() req: any, @Query('salarieId') salarieId?: string, @Query('actifs') actifs?: string) {
    if (salarieId) {
      this.assertCanView(req, +salarieId);
      return this.service.findBySalarie(+salarieId, req.user.tenantId);
    }
    if (actifs === 'true') {
      if (req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.EXPERT_COMPTABLE) {
        throw new ForbiddenException("Accès réservé à l'administration RH");
      }
      return this.service.findTousActifs(req.user.tenantId);
    }
    return [];
  }

  @Get('salarie/:salarieId/actif')
  @ApiOperation({ summary: 'Contrat actif courant d\'un salarié' })
  findActif(@Param('salarieId', ParseIntPipe) salarieId: number, @Req() req: any) {
    this.assertCanView(req, salarieId);
    return this.service.findActifBySalarie(salarieId, req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un contrat" })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const contrat = await this.service.findOne(id, req.user.tenantId);
    this.assertCanView(req, (contrat as any).salarieId);
    return contrat;
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
