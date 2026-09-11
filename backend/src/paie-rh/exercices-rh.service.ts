import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciceRh, StatutExerciceRh } from '../entities/exercice-rh.entity';

/**
 * Exercices RH annuels de l'entreprise (~"Gestion des exercices" RADIAN/URA) — gouverne
 * l'ouverture des cycles de paie mensuels (`CyclePaieRh`), voir `CyclesPaieRhService.ouvrir()`.
 */
@Injectable()
export class ExercicesRhService {
  constructor(@InjectRepository(ExerciceRh) private repo: Repository<ExerciceRh>) {}

  findAll(tenantId: number): Promise<ExerciceRh[]> {
    return this.repo.find({ where: { tenantId }, order: { annee: 'DESC' } });
  }

  findOuvert(tenantId: number): Promise<ExerciceRh | null> {
    return this.repo.findOne({ where: { tenantId, statut: StatutExerciceRh.OUVERT } });
  }

  async findOne(id: number, tenantId: number): Promise<ExerciceRh> {
    const exercice = await this.repo.findOne({ where: { id, tenantId } });
    if (!exercice) throw new NotFoundException(`Exercice RH ${id} introuvable`);
    return exercice;
  }

  /**
   * Crée un exercice pour une année, directement OUVERT (comme `CyclePaieRh.ouvrir()`, pas
   * d'étape "création" puis "ouverture" séparée en v1 — un seul exercice ouvert à la fois,
   * donc le créer revient toujours à l'ouvrir).
   */
  async creer(annee: number, tenantId: number, userId: number): Promise<ExerciceRh> {
    const existant = await this.repo.findOne({ where: { annee, tenantId } });
    if (existant) throw new BadRequestException(`Un exercice RH ${annee} existe déjà pour ce tenant.`);
    const dejaOuvert = await this.findOuvert(tenantId);
    if (dejaOuvert) {
      throw new BadRequestException(
        `L'exercice RH ${dejaOuvert.annee} est déjà ouvert — clôturez-le avant d'en ouvrir un nouveau.`,
      );
    }
    const exercice = this.repo.create({
      tenantId,
      annee,
      dateDebut: `${annee}-01-01`,
      dateFin: `${annee}-12-31`,
      statut: StatutExerciceRh.OUVERT,
      dateOuverture: new Date(),
      ouvertParId: userId,
    });
    return this.repo.save(exercice);
  }

  async cloturer(id: number, tenantId: number, userId: number): Promise<ExerciceRh> {
    const exercice = await this.findOne(id, tenantId);
    if (exercice.statut === StatutExerciceRh.CLOTURE) {
      throw new BadRequestException('Cet exercice RH est déjà clôturé.');
    }
    exercice.statut = StatutExerciceRh.CLOTURE;
    exercice.dateCloture = new Date();
    exercice.clotureParId = userId;
    return this.repo.save(exercice);
  }
}
