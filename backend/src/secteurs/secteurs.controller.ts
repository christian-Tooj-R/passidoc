import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
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
  findAll(@Query('all') all?: string) {
    return this.service.findAll(all === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un secteur' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un secteur (ADMIN)' })
  create(@Body() dto: CreateSecteurDto) {
    return this.service.create(dto);
  }

  @Patch('sync-all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Synchroniser les libellés NAF de tous les secteurs (ADMIN)' })
  syncAll() {
    return this.service.syncAllNaf();
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un secteur (ADMIN)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSecteurDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/sync-naf')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Synchroniser le libellé NAF d\'un secteur (ADMIN)' })
  syncNaf(@Param('id', ParseIntPipe) id: number) {
    return this.service.syncNaf(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Désactiver un secteur (ADMIN)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
