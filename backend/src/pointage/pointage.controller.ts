import { Controller, Post, Get, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { PointageService } from './pointage.service';

@ApiTags('Pointage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @ApiOperation({ summary: 'Vue journalière de tous les collaborateurs' })
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
}
