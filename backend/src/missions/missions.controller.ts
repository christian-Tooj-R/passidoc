import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { MissionsService } from './missions.service';
import { CreateMissionDto, FiltresMissionsDto, RecommandationCycleDto, UpdateMissionDto } from './dto/mission.dto';

@ApiTags('Missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/missions')
export class MissionsController {
  constructor(private service: MissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Pipeline des missions du dossier (avec ou sans cycle d’origine)' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number, @CurrentUser() user: User) {
    return this.service.lister(clientId, user);
  }

  @Get('synthese')
  @ApiOperation({ summary: 'Indicateurs du pipeline : potentiel, en cours, signées, à relancer' })
  synthese(@Param('clientId', ParseIntPipe) clientId: number, @CurrentUser() user: User) {
    return this.service.syntheseDossier(clientId, user);
  }

  @Get('cycles')
  @ApiOperation({ summary: 'Onglet « Par cycle » : recommandations de l’exercice et missions déjà refusées' })
  cycles(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('exerciceId') exerciceId: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.service.cycles(clientId, exerciceId ? Number(exerciceId) || null : null, user);
  }

  @Patch('cycles/:cycle/recommandation')
  @ApiOperation({ summary: 'Enregistrer les recommandations émises au client sur un cycle' })
  recommandation(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('cycle') cycle: string,
    @Body() dto: RecommandationCycleDto,
    @CurrentUser() user: User,
  ) {
    return this.service.enregistrerRecommandation(clientId, cycle, dto, user);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une mission (depuis un cycle ou hors cycle) — statut « Proposée » par défaut' })
  create(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: CreateMissionDto, @CurrentUser() user: User) {
    return this.service.creer(clientId, dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une mission (statut historisé)' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMissionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.modifier(clientId, id, dto, user);
  }

  @Get(':id/historique')
  @ApiOperation({ summary: 'Historique des changements de statut' })
  historique(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.service.historique(clientId, id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une mission « Proposée » ou « Sans suite » (sinon : archiver)' })
  remove(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.service.supprimer(clientId, id, user);
  }
}

@ApiTags('Missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('missions')
export class MissionsCabinetController {
  constructor(private service: MissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Tableau de bord cabinet : missions de tout le portefeuille visible, filtrées' })
  tableau(@Query() filtres: FiltresMissionsDto, @CurrentUser() user: User) {
    return this.service.tableauCabinet(user, filtres);
  }
}
