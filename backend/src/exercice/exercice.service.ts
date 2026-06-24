import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';
import { computeExercice } from '../clients/clients.service';
import { ControleInterneService } from '../controle-interne/controle-interne.service';

@Injectable()
export class ExerciceService {
  constructor(
    @InjectRepository(Exercice) private repo: Repository<Exercice>,
    private controleInterneService: ControleInterneService,
  ) {}

  findByClient(clientId: number): Promise<Exercice[]> {
    return this.repo.find({ where: { clientId }, order: { annee: 'DESC' } });
  }

  findCurrent(clientId: number): Promise<Exercice | null> {
    return this.repo.findOne({
      where: { clientId, statut: ExerciceStatut.OUVERT },
      order: { annee: 'DESC' },
    });
  }

  async createForClient(clientId: number, dateClotureExercice: string): Promise<Exercice> {
    const dates = computeExercice(dateClotureExercice);
    const existing = await this.repo.findOne({ where: { clientId, annee: dates.annee } });
    if (existing) throw new ConflictException(`Un exercice ${dates.annee} existe déjà pour ce dossier`);
    return this.repo.save(this.repo.create({ clientId, ...dates, statut: ExerciceStatut.OUVERT }));
  }

  async cloturer(id: number, userId: number): Promise<{ closed: Exercice; next: Exercice }> {
    const exercice = await this.repo.findOne({ where: { id } });
    if (!exercice) throw new NotFoundException('Exercice introuvable');
    if (exercice.statut === ExerciceStatut.CLOTURE) throw new ConflictException('Exercice déjà clôturé');

    exercice.statut   = ExerciceStatut.CLOTURE;
    exercice.clotureLeAt  = new Date();
    exercice.clotureParId = userId;
    const closed = await this.repo.save(exercice);

    // Calculer les dates du prochain exercice à partir de la même date de clôture annuelle
    const [, prevMonth, prevDay] = exercice.dateCloture.split('-');
    const nextAnnee = exercice.annee + 1;
    const prevClotureDate = new Date(exercice.dateCloture);
    prevClotureDate.setDate(prevClotureDate.getDate() + 1);
    const nextDateOuverture = prevClotureDate.toISOString().split('T')[0];
    const nextDateCloture = `${nextAnnee}-${prevMonth}-${prevDay}`;

    const next = await this.repo.save(
      this.repo.create({
        clientId: exercice.clientId,
        annee: nextAnnee,
        dateOuverture: nextDateOuverture,
        dateCloture: nextDateCloture,
        statut: ExerciceStatut.OUVERT,
      }),
    );

    // Reprise annuelle : copie le contrôle interne vers le nouvel exercice
    await this.controleInterneService.reprendreVersExercice(exercice.clientId, exercice.id, next.id);

    return { closed, next };
  }
}
