import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AcomptesSalarieService } from './acomptes-salarie.service';
import { CreateAcompteSalarieDto } from './dto/acompte-salarie.dto';

@ApiTags('Paie RH — Acomptes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/acomptes')
export class AcomptesSalarieController {
  constructor(private service: AcomptesSalarieService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Demander un acompte pour un salarié' })
  create(@Body() dto: CreateAcompteSalarieDto, @Req() req: any) {
    return this.service.create(dto, req.user.tenantId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Lister les acomptes d'un salarié" })
  find(@Query('salarieId', ParseIntPipe) salarieId: number, @Req() req: any) {
    return this.service.findBySalarie(salarieId, req.user.tenantId);
  }

  @Patch(':id/valider')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Valider un acompte (sera déduit du bulletin de la période indiquée)' })
  valider(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.valider(id, req.user.tenantId);
  }

  @Patch(':id/annuler')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Annuler un acompte non encore déduit' })
  annuler(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.annuler(id, req.user.tenantId);
  }
}
