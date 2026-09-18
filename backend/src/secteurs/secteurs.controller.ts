import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SecteursService } from './secteurs.service';
import { CreateSecteurDto, UpdateSecteurDto } from './dto/create-secteur.dto';

@ApiTags('Secteurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('secteurs')
export class SecteursController {
  constructor(private service: SecteursService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des secteurs actifs' })
  findAll(@Req() req: any, @Query('all') all?: string) {
    return this.service.findAll(all === 'true', req.user?.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un secteur' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un secteur' })
  create(@Req() req: any, @Body() dto: CreateSecteurDto) {
    return this.service.create(dto, req.user?.tenantId);
  }

  @Patch('sync-all')
  @ApiOperation({ summary: 'Synchroniser les libellés NAF de tous les secteurs' })
  syncAll() {
    return this.service.syncAllNaf();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un secteur' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSecteurDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/sync-naf')
  @ApiOperation({ summary: 'Synchroniser le libellé NAF d\'un secteur' })
  syncNaf(@Param('id', ParseIntPipe) id: number) {
    return this.service.syncNaf(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Désactiver un secteur' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
