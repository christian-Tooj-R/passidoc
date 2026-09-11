import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TacheRecurrenteService } from './tache-recurrente.service';
import { CreateTacheRecurrenteDto, UpdateTacheRecurrenteDto } from './dto/create-tache-recurrente.dto';

@ApiTags('Tâches récurrentes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('taches-recurrentes')
export class TacheRecurrenteController {
  constructor(private service: TacheRecurrenteService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une tâche récurrente' })
  create(@Body() dto: CreateTacheRecurrenteDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les tâches récurrentes (par client ou tenant)' })
  find(@Req() req: any, @Query('clientId') clientId?: string) {
    if (clientId) return this.service.findByClient(+clientId);
    return this.service.findByTenant(req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une tâche récurrente' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTacheRecurrenteDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une tâche récurrente' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post('generer')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Déclencher manuellement la génération des tâches récurrentes' })
  generer(@Req() req: any) {
    return this.service.genererTachesEcheances(req.user.tenantId, true).then(n => ({ created: n }));
  }
}
