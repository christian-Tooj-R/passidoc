import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Req } from '@nestjs/common';
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto, @Req() req: any) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une tâche' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Get('grille')
  @ApiOperation({ summary: 'Grille mensuelle du dossier' })
  findGrille(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('annee') annee: string,
  ) {
    return this.service.findGrille(clientId, parseInt(annee) || new Date().getFullYear());
  }

  @Post('toggle-mensuel')
  @ApiOperation({ summary: 'Cocher/décocher une cellule de la grille' })
  toggleMensuel(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: { type: string; mois: number; annee: number },
    @Req() req: any,
  ) {
    return this.service.toggleMensuel(clientId, dto, req.user);
  }

  @Patch('dr-etape/:id')
  @ApiOperation({ summary: 'Basculer le statut d\'une étape DR' })
  toggleDrEtape(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleDrEtape(id);
  }

  @Patch('commentaire')
  @ApiOperation({ summary: 'Mettre à jour le commentaire d\'une ligne de grille' })
  updateCommentaire(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: { type: string; annee: number; commentaire: string },
  ) {
    return this.service.updateCommentaire(clientId, dto.type, dto.annee, dto.commentaire);
  }
}
