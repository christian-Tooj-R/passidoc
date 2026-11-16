import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { BusinessPartnerService } from './business-partner.service';
import { EnregistrerOutilBpDto, ValiderOutilBpDto } from './dto/outil-bp.dto';

@ApiTags('Tableau de bord BP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/bp')
export class BusinessPartnerController {
  constructor(private service: BusinessPartnerService) {}

  @Get()
  @ApiOperation({ summary: "Les 9 outils stratégiques de l'exercice, l'exercice N-1 et les droits du lecteur" })
  tableau(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('exerciceId', ParseIntPipe) exerciceId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.tableau(clientId, exerciceId, user);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Suggestions tirées des données du dossier et profil client auto-généré' })
  suggestions(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('exerciceId', ParseIntPipe) exerciceId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.suggestions(clientId, exerciceId, user);
  }

  @Get('suggestions-ia')
  @ApiOperation({ summary: "Suggestions de l'IA pour un outil (à ajouter ou écarter comme les autres)" })
  suggestionsIa(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('exerciceId', ParseIntPipe) exerciceId: number,
    @Query('outil') outil: string,
    @CurrentUser() user: User,
  ) {
    return this.service.suggestionsIa(clientId, exerciceId, outil, user);
  }

  @Patch(':outil')
  @ApiOperation({ summary: 'Enregistrer un outil (repasse en brouillon)' })
  enregistrer(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('outil') outil: string,
    @Query('exerciceId', ParseIntPipe) exerciceId: number,
    @Body() dto: EnregistrerOutilBpDto,
    @CurrentUser() user: User,
  ) {
    return this.service.enregistrer(clientId, exerciceId, outil, dto.contenu, user);
  }

  @Post(':outil/valider')
  @ApiOperation({ summary: 'Valider un outil (Admin, Expert, Chef d’antenne, Chef de mission)' })
  valider(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('outil') outil: string,
    @Query('exerciceId', ParseIntPipe) exerciceId: number,
    @Body() dto: ValiderOutilBpDto,
    @CurrentUser() user: User,
  ) {
    return this.service.valider(clientId, exerciceId, outil, user, dto?.commentaire);
  }
}
