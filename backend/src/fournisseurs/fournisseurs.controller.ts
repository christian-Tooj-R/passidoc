import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FournisseursService } from './fournisseurs.service';
import { CreateFournisseurDto } from './dto/create-fournisseur.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@ApiTags('Fournisseurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/fournisseurs')
export class FournisseursController {
  constructor(private service: FournisseursService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un fournisseur' })
  create(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: CreateFournisseurDto, @CurrentUser() user: User) {
    return this.service.create(clientId, dto, user);
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
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, clientId, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un fournisseur' })
  remove(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.service.remove(id, clientId, user);
  }
}
