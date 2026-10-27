import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';

@Injectable()
export class AnalyseStrategiqueService {
  constructor(
    @InjectRepository(AnalyseStrategique) private repo: Repository<AnalyseStrategique>,
    @InjectRepository(Exercice) private exerciceRepo: Repository<Exercice>,
  ) {}

  /**
   * Fiche de l'exercice. Plusieurs fiches ont pu être créées pour un même exercice par
   * l'ancienne lecture « get-or-create » (deux lectures simultanées à l'ouverture de
   * l'onglet) : lectures ET écritures visent désormais toujours la plus récemment
   * modifiée, pour ne plus lire une fiche et enregistrer dans l'autre.
   */
  private trouver(clientId: number, exerciceId: number): Promise<AnalyseStrategique | null> {
    return this.repo.findOne({ where: { clientId, exerciceId }, order: { updatedAt: 'DESC', id: 'DESC' } });
  }

  /** Lecture sans effet de bord : une fiche vide (non enregistrée) si l'exercice n'en a pas
   *  encore — elle n'est créée qu'au premier enregistrement (upsert). */
  async findByExercice(clientId: number, exerciceId: number): Promise<AnalyseStrategique> {
    return (await this.trouver(clientId, exerciceId)) ?? this.repo.create({ clientId, exerciceId });
  }

  async upsert(clientId: number, exerciceId: number, data: Partial<AnalyseStrategique>): Promise<AnalyseStrategique> {
    if (exerciceId > 0) {
      const exercice = await this.exerciceRepo.findOne({ where: { id: exerciceId } });
      if (!exercice) throw new NotFoundException('Exercice introuvable');
      if (exercice.statut === ExerciceStatut.CLOTURE) {
        throw new ForbiddenException("Exercice clôturé — données en lecture seule");
      }
    }
    let record = await this.trouver(clientId, exerciceId);
    if (!record) record = this.repo.create({ clientId, exerciceId });
    Object.assign(record, data);
    return this.repo.save(record);
  }

  /** Copie l'analyse stratégique de l'exercice source vers le nouvel exercice (reprise annuelle). */
  async reprendreVersExercice(clientId: number, sourceExerciceId: number, destExerciceId: number): Promise<void> {
    const source = await this.trouver(clientId, sourceExerciceId);
    if (!source) return;
    const hasDonnees = source.forces?.length || source.faiblesses?.length ||
      source.opportunites?.length || source.menaces?.length ||
      source.porterConcurrence || source.businessModelCanvas;
    if (!hasDonnees) return;

    let dest = await this.trouver(clientId, destExerciceId);
    if (!dest) dest = this.repo.create({ clientId, exerciceId: destExerciceId });

    dest.forces              = source.forces ?? [];
    dest.faiblesses          = source.faiblesses ?? [];
    dest.opportunites        = source.opportunites ?? [];
    dest.menaces             = source.menaces ?? [];
    dest.porterConcurrence   = source.porterConcurrence ?? '';
    dest.porterNouveauxEntrants = source.porterNouveauxEntrants ?? '';
    dest.porterClients       = source.porterClients ?? '';
    dest.porterFournisseurs  = source.porterFournisseurs ?? '';
    dest.porterSubstituts    = source.porterSubstituts ?? '';
    dest.businessModelCanvas = source.businessModelCanvas ?? '';
    await this.repo.save(dest);
  }
}
