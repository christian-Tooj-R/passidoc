import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionnaireAdnService } from './questionnaire-adn.service';
import { QuestionnaireAdnController } from './questionnaire-adn.controller';
import { QuestionnaireAdnGlobal } from '../entities/questionnaire-adn-global.entity';
import { QuestionnaireAdnSectoriel } from '../entities/questionnaire-adn-sectoriel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionnaireAdnGlobal, QuestionnaireAdnSectoriel])],
  controllers: [QuestionnaireAdnController],
  providers: [QuestionnaireAdnService],
})
export class QuestionnaireAdnModule {}
