import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalariesService, CreateSalarieDto } from './salaries.service';

@ApiTags('Salariés')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/salaries')
export class SalariesController {
  constructor(private svc: SalariesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des salariés d\'un dossier' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.svc.findByClient(clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter un salarié' })
  create(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: CreateSalarieDto,
  ) {
    return this.svc.create(clientId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un salarié' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateSalarieDto>,
  ) {
    return this.svc.update(id, clientId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un salarié' })
  remove(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.remove(id, clientId);
  }
}
