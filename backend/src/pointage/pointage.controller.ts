import { Controller, Post, Get, Query, UseGuards, HttpCode, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';
import { PointageService } from './pointage.service';

@ApiTags('Pointage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pointage')
export class PointageController {
  constructor(private svc: PointageService) {}

  @Post('pointer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pointer arrivée ou départ' })
  pointer(@CurrentUser() user: User) {
    return this.svc.pointer(user.id);
  }

  @Get('journee')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Vue journalière de tous les collaborateurs (admin/expert)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-18' })
  @ApiQuery({ name: 'site', required: false, enum: ['REUNION', 'MADAGASCAR'] })
  getJournee(@Query('date') date?: string, @Query('site') site?: string) {
    const d = date ?? new Date().toISOString().split('T')[0];
    return this.svc.getJournee(d, site);
  }

  @Get('mon-statut')
  @ApiOperation({ summary: 'Statut de pointage du jour pour l\'utilisateur connecté' })
  getMonStatut(@CurrentUser() user: User) {
    return this.svc.getMonStatut(user.id);
  }

  @Get('historique')
  @ApiOperation({ summary: 'Historique des 30 derniers jours' })
  getHistorique(@CurrentUser() user: User) {
    return this.svc.getHistorique(user.id);
  }

  @Get('historique/all')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Historique global tous utilisateurs (admin/expert)' })
  @ApiQuery({ name: 'site', required: false, enum: ['REUNION', 'MADAGASCAR'] })
  getHistoriqueAll(@Query('site') site?: string) {
    return this.svc.getHistoriqueAll(site);
  }
}
