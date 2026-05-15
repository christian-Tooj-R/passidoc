import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FluxMensuelService } from './flux-mensuel.service';
import { CreateFluxDto } from './dto/create-flux.dto';
import { UpdateFluxDto } from './dto/update-flux.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Alertes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/alertes')
export class AlertesGlobalesController {
  constructor(private service: FluxMensuelService) {}

  @Get()
  @ApiOperation({ summary: 'Toutes les alertes flux manquants/en retard (tous clients)' })
  getAll() {
    return this.service.getAlertesGlobales();
  }
}

@ApiTags('Flux Mensuels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/flux')
export class FluxMensuelController {
  constructor(private service: FluxMensuelService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un flux mensuel' })
  create(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: CreateFluxDto) {
    return this.service.create(clientId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des flux mensuels' })
  @ApiQuery({ name: 'annee', required: false, type: Number })
  findAll(@Param('clientId', ParseIntPipe) clientId: number, @Query('annee') annee?: number) {
    return this.service.findByClient(clientId, annee);
  }

  @Get('alertes')
  @ApiOperation({ summary: 'Flux manquants ou en retard (alertes)' })
  alertes(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.getAlertes(clientId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un flux (ex: marquer comme déposé)' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFluxDto,
  ) {
    return this.service.update(id, clientId, dto);
  }

  @Post('init-annee')
  @ApiOperation({ summary: 'Initialiser tous les flux de l\'année comme MANQUANT' })
  initAnnee(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body('annee') annee: number,
  ) {
    return this.service.initAnnee(clientId, annee);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un flux' })
  remove(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, clientId);
  }
}
