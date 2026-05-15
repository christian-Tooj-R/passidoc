import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionnaireAdnGlobal } from '../entities/questionnaire-adn-global.entity';
import { QuestionnaireAdnSectoriel } from '../entities/questionnaire-adn-sectoriel.entity';
import { Client } from '../entities/client.entity';
import { UpdateQuestionnaireGlobalDto } from './dto/update-questionnaire-global.dto';
import { UpdateQuestionnaireSectorielDto } from './dto/update-questionnaire-sectoriel.dto';

@Injectable()
export class QuestionnaireAdnService {
  constructor(
    @InjectRepository(QuestionnaireAdnGlobal)
    private globalRepo: Repository<QuestionnaireAdnGlobal>,
    @InjectRepository(QuestionnaireAdnSectoriel)
    private sectorielRepo: Repository<QuestionnaireAdnSectoriel>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  async findOrCreateGlobal(clientId: number) {
    let q = await this.globalRepo.findOne({ where: { clientId } });
    if (!q) {
      q = this.globalRepo.create({ clientId });
      await this.globalRepo.save(q);
    }
    return q;
  }

  async updateGlobal(clientId: number, dto: UpdateQuestionnaireGlobalDto) {
    const q = await this.findOrCreateGlobal(clientId);
    await this.globalRepo.update(q.id, dto);
    return this.findOrCreateGlobal(clientId);
  }

  async findOrCreateSectoriel(clientId: number) {
    let q = await this.sectorielRepo.findOne({ where: { clientId } });
    if (!q) {
      q = this.sectorielRepo.create({ clientId });
      await this.sectorielRepo.save(q);
    }
    return q;
  }

  async updateSectoriel(clientId: number, dto: UpdateQuestionnaireSectorielDto) {
    const q = await this.findOrCreateSectoriel(clientId);
    await this.sectorielRepo.update(q.id, dto);
    if (dto.secteur !== undefined) {
      await this.clientRepo.update(clientId, { secteurActivite: dto.secteur as any });
    }
    return this.findOrCreateSectoriel(clientId);
  }
}
