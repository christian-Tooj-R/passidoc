import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/tasks')
export class TasksController {
  constructor(private service: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des tâches du dossier' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findAllByClient(clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une tâche' })
  create(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: CreateTaskDto,
    @Req() req: any,
  ) {
    return this.service.create(clientId, dto, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une tâche (statut, assignée, etc.)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une tâche' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
