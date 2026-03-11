import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FournisseursService } from './fournisseurs.service';
import { CreateFournisseurDto } from './dto/create-fournisseur.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Fournisseurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/fournisseurs')
export class FournisseursController {
  constructor(private service: FournisseursService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un fournisseur' })
  create(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: CreateFournisseurDto) {
    return this.service.create(clientId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Annuaire fournisseurs du client' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findByClient(clientId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un fournisseur' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateFournisseurDto>,
  ) {
    return this.service.update(id, clientId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un fournisseur' })
  remove(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, clientId);
  }
}
