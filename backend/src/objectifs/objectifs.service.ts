import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectifsClient } from '../entities/objectifs-client.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';

@Injectable()
export class ObjectifsService {
  constructor(
    @InjectRepository(ObjectifsClient) private repo: Repository<ObjectifsClient>,
    @InjectRepository(Exercice) private exerciceRepo: Repository<Exercice>,
  ) {}

  async findByExercice(clientId: number, exerciceId: number): Promise<ObjectifsClient> {
    let record = await this.repo.findOne({ where: { clientId, exerciceId } });
    if (!record) {
      record = this.repo.create({ clientId, exerciceId });
      return this.repo.save(record);
    }
    return record;
  }

  async upsert(clientId: number, exerciceId: number, data: Partial<ObjectifsClient>): Promise<ObjectifsClient> {
    if (exerciceId > 0) {
      const exercice = await this.exerciceRepo.findOne({ where: { id: exerciceId } });
      if (!exercice) throw new NotFoundException('Exercice introuvable');
      if (exercice.statut === ExerciceStatut.CLOTURE) {
        throw new ForbiddenException("Exercice clôturé — données en lecture seule");
      }
    }
    let record = await this.repo.findOne({ where: { clientId, exerciceId } });
    if (!record) record = this.repo.create({ clientId, exerciceId });
    Object.assign(record, data);
    return this.repo.save(record);
  }
}
