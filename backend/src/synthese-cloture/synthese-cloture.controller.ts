import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SyntheseCloureService } from './synthese-cloture.service';
import { CreateSyntheseCloture } from './dto/create-synthese.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Synthèse Clôture')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/syntheses')
export class SyntheseCloureController {
  constructor(private service: SyntheseCloureService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une synthèse de clôture' })
  create(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: CreateSyntheseCloture) {
    return this.service.create(clientId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des synthèses de clôture' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findByClient(clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une synthèse' })
  findOne(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, clientId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une synthèse' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateSyntheseCloture>,
  ) {
    return this.service.update(id, clientId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une synthèse' })
  remove(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, clientId);
  }
}
