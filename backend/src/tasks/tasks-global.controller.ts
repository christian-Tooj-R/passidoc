import { Controller, Get, UseGuards, Req, Query, ParseIntPipe, Optional } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class AllTasksController {
  constructor(private service: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Toutes les tâches accessibles' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard hebdomadaire des tâches' })
  getDashboard(@Query('semaine') semaine?: string) {
    return this.service.getDashboard(semaine ? parseInt(semaine) : undefined);
  }
}
