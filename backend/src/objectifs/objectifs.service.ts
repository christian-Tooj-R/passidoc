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

  /** Copie les objectifs client de l'exercice source vers le nouvel exercice (reprise annuelle). */
  async reprendreVersExercice(clientId: number, sourceExerciceId: number, destExerciceId: number): Promise<void> {
    const source = await this.repo.findOne({ where: { clientId, exerciceId: sourceExerciceId } });
    if (!source) return;
    const hasDonnees = source.objectifs12mois || source.objectifs3a5ans || source.attentesClient;
    if (!hasDonnees) return;

    let dest = await this.repo.findOne({ where: { clientId, exerciceId: destExerciceId } });
    if (!dest) dest = this.repo.create({ clientId, exerciceId: destExerciceId });

    dest.objectifs12mois        = source.objectifs12mois ?? '';
    dest.objectifs3a5ans        = source.objectifs3a5ans ?? '';
    dest.objectifsLongTerme     = source.objectifsLongTerme ?? '';
    dest.attentesClient         = source.attentesClient ?? '';
    dest.depuisQuand            = source.depuisQuand ?? '';
    dest.qualiteRelation        = source.qualiteRelation ?? '';
    dest.axesAmelioration       = source.axesAmelioration ?? '';
    dest.recommandationsFaites  = source.recommandationsFaites ?? '';
    dest.relationCollaborateur  = source.relationCollaborateur ?? '';
    dest.relationPoleSocial     = source.relationPoleSocial ?? '';
    dest.relationPoleJuridique  = source.relationPoleJuridique ?? '';
    dest.relationDirecteur      = source.relationDirecteur ?? '';
    await this.repo.save(dest);
  }
}
