import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ExercicesRhService } from './exercices-rh.service';

@ApiTags('Paie RH — Exercices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie-rh/exercices')
export class ExercicesRhController {
  constructor(private service: ExercicesRhService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les exercices RH du tenant' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.tenantId);
  }

  @Get('ouvert')
  @ApiOperation({ summary: "Exercice RH actuellement ouvert (ou null s'il n'y en a aucun)" })
  findOuvert(@Req() req: any) {
    return this.service.findOuvert(req.user.tenantId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ouvrir un nouvel exercice RH pour une année (un seul ouvert à la fois)' })
  creer(@Body('annee', ParseIntPipe) annee: number, @Req() req: any) {
    return this.service.creer(annee, req.user.tenantId, req.user.id);
  }

  @Post(':id/cloturer')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Clôturer un exercice RH' })
  cloturer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.cloturer(id, req.user.tenantId, req.user.id);
  }
}
