import { Controller, Get, Post, Patch, Body, UseGuards, Req, Query, ParseIntPipe, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { TasksScheduler } from './tasks.scheduler';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class AllTasksController {
  constructor(
    private service: TasksService,
    private scheduler: TasksScheduler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Toutes les tâches accessibles' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une tâche sans dossier client' })
  createGlobal(@Body() dto: CreateTaskDto, @Req() req: any) {
    return this.service.create(null, dto, req.user);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard hebdomadaire des tâches' })
  getDashboard(@Req() req: any, @Query('semaine') semaine?: string) {
    return this.service.getDashboard(semaine ? parseInt(semaine) : undefined, req.user?.tenantId);
  }

  @Get('mes-taches')
  @ApiOperation({ summary: 'Tâches assignées à l\'utilisateur connecté' })
  mesTaches(@Req() req: any) {
    return this.service.findMesTaches(req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une tâche (statut, priorité…)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ── "Prendre" une tâche ouverte (N'importe qui) ────────────────────────────
  @Patch(':id/prendre')
  @ApiOperation({ summary: 'Prendre une tâche ouverte (self-assign)' })
  prendreTache(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.update(id, { assigneeId: req.user.id }, req.user);
  }

  // ── Déclencheurs manuels pour les crons (admin / test) ────────────────────
  @Post('admin/notifier-echeances')
  @ApiOperation({ summary: 'Déclencher manuellement les notifications J-1' })
  triggerNotifications() {
    return this.scheduler.notifierEcheancesProches();
  }

  @Post('admin/reporter-retards')
  @ApiOperation({ summary: 'Déclencher manuellement le report des tâches en retard' })
  triggerReport() {
    return this.scheduler.reporterTachesEnRetard();
  }

  @Post('admin/creer-recurrentes')
  @ApiOperation({ summary: 'Déclencher manuellement la création de tâches récurrentes' })
  triggerRecurrences() {
    return this.scheduler.creerTachesRecurrentes();
  }
}
