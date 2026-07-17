import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControleInterne } from '../entities/controle-interne.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';

@Injectable()
export class ControleInterneService {
  constructor(
    @InjectRepository(ControleInterne) private repo: Repository<ControleInterne>,
    @InjectRepository(Exercice) private exerciceRepo: Repository<Exercice>,
  ) {}

  async findByExercice(clientId: number, exerciceId: number): Promise<ControleInterne> {
    let record = await this.repo.findOne({ where: { clientId, exerciceId } });
    if (!record) {
      record = this.repo.create({ clientId, exerciceId });
      return this.repo.save(record);
    }
    return record;
  }

  async upsert(clientId: number, exerciceId: number, data: Partial<ControleInterne>): Promise<ControleInterne> {
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

  /** Copie le contrôle interne de l'exercice source vers le nouvel exercice (reprise annuelle). */
  async reprendreVersExercice(clientId: number, sourceExerciceId: number, destExerciceId: number): Promise<void> {
    const source = await this.repo.findOne({ where: { clientId, exerciceId: sourceExerciceId } });
    if (!source) return;
    const hasDonnees = source.noteGenerale || source.processOk?.length || source.processDefaillants?.length || source.outilsPilotage?.length;
    if (!hasDonnees) return;
    let dest = await this.repo.findOne({ where: { clientId, exerciceId: destExerciceId } });
    if (!dest) dest = this.repo.create({ clientId, exerciceId: destExerciceId });
    dest.processOk          = source.processOk ?? [];
    dest.processDefaillants = source.processDefaillants ?? [];
    dest.outilsPilotage     = source.outilsPilotage ?? [];
    dest.noteGenerale       = source.noteGenerale ? `[Repris de l'exercice précédent]\n${source.noteGenerale}` : '';
    await this.repo.save(dest);
  }
}
