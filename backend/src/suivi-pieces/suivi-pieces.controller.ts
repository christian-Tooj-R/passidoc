import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { SuiviPiecesService } from './suivi-pieces.service';
import { EnvoyerRelanceDto } from './dto/relance.dto';

const annee = (a?: string) => (a && /^\d{4}$/.test(a) ? Number(a) : undefined);

@ApiTags('Suivi des pièces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SuiviPiecesController {
  constructor(private service: SuiviPiecesService) {}

  @Get('suivi-pieces')
  @ApiOperation({ summary: 'Tableau de bord des pièces manquantes par dossier (cahier v2 #1)' })
  @ApiQuery({ name: 'annee', required: false })
  tableau(@CurrentUser() user: User, @Query('annee') a?: string) {
    return this.service.tableauDeBord(user, annee(a));
  }

  @Get('clients/:clientId/suivi-pieces/relance')
  @ApiOperation({ summary: "Aperçu de la relance du client (destinataire, pièces, texte selon l'approche client)" })
  apercu(@Param('clientId', ParseIntPipe) clientId: number, @CurrentUser() user: User, @Query('annee') a?: string) {
    return this.service.apercuRelance(clientId, user, annee(a));
  }

  @Post('clients/:clientId/suivi-pieces/relance')
  @ApiOperation({ summary: 'Envoyer la relance des pièces manquantes au contact opérationnel du dossier' })
  envoyer(
    @Param('clientId', ParseIntPipe) clientId: number, @CurrentUser() user: User,
    @Body() dto: EnvoyerRelanceDto, @Query('annee') a?: string,
  ) {
    return this.service.envoyerRelance(clientId, user, dto, annee(a));
  }
}
