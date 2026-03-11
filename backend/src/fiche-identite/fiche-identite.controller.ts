import { Controller, Get, Patch, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FicheIdentiteService } from './fiche-identite.service';
import { UpdateFicheIdentiteDto } from './dto/update-fiche-identite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Fiche Identité')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/fiche-identite')
export class FicheIdentiteController {
  constructor(private service: FicheIdentiteService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer la fiche identité d\'un client' })
  findOne(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findByClient(clientId);
  }

  @Patch()
  @ApiOperation({ summary: 'Mettre à jour la fiche identité' })
  update(@Param('clientId', ParseIntPipe) clientId: number, @Body() dto: UpdateFicheIdentiteDto) {
    return this.service.update(clientId, dto);
  }
}
