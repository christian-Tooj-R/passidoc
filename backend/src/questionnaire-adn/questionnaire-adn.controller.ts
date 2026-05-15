import { Controller, Get, Patch, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { QuestionnaireAdnService } from './questionnaire-adn.service';
import { UpdateQuestionnaireGlobalDto } from './dto/update-questionnaire-global.dto';
import { UpdateQuestionnaireSectorielDto } from './dto/update-questionnaire-sectoriel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Questionnaire ADN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/questionnaire-adn')
export class QuestionnaireAdnController {
  constructor(private service: QuestionnaireAdnService) {}

  @Get('global')
  @ApiOperation({ summary: 'Récupérer le questionnaire ADN global' })
  getGlobal(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findOrCreateGlobal(clientId);
  }

  @Patch('global')
  @ApiOperation({ summary: 'Enregistrer le questionnaire ADN global' })
  updateGlobal(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: UpdateQuestionnaireGlobalDto,
  ) {
    return this.service.updateGlobal(clientId, dto);
  }

  @Get('sectoriel')
  @ApiOperation({ summary: 'Récupérer le questionnaire ADN sectoriel' })
  getSectoriel(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findOrCreateSectoriel(clientId);
  }

  @Patch('sectoriel')
  @ApiOperation({ summary: 'Enregistrer le questionnaire ADN sectoriel' })
  updateSectoriel(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: UpdateQuestionnaireSectorielDto,
  ) {
    return this.service.updateSectoriel(clientId, dto);
  }
}
