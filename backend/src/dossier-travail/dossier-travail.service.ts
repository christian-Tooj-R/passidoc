import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { DossierTravail } from '../entities/dossier-travail.entity';
import { CycleRevision, TypeCycle } from '../entities/cycle-revision.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';

const CYCLES_ALL: TypeCycle[] = [TypeCycle.VENTE, TypeCycle.ACHAT, TypeCycle.SOCIAL];

@Injectable()
export class DossierTravailService {
  private groq: Groq;
  private model: string;

  constructor(
    @InjectRepository(DossierTravail) private dossierRepo: Repository<DossierTravail>,
    @InjectRepository(CycleRevision)  private cycleRepo: Repository<CycleRevision>,
    @InjectRepository(Exercice)       private exerciceRepo: Repository<Exercice>,
    private config: ConfigService,
  ) {
    this.groq  = new Groq({ apiKey: config.get<string>('GROQ_API_KEY') });
    this.model = config.get<string>('GROQ_MODEL') ?? 'llama-3.1-8b-instant';
  }

  /** Retourne le dossier de travail pour un exercice (le crée si absent). */
  async findOrCreate(clientId: number, exerciceId: number): Promise<DossierTravail> {
    let dossier = await this.dossierRepo.findOne({
      where: { clientId, exerciceId },
      relations: ['cycles'],
    });
    if (!dossier) {
      dossier = await this._createEmpty(clientId, exerciceId);
    }
    // S'assurer que les 3 cycles existent
    for (const type of CYCLES_ALL) {
      if (!dossier.cycles.find((c) => c.typeCycle === type)) {
        const cycle = this.cycleRepo.create({ dossierTravailId: dossier.id, typeCycle: type });
        await this.cycleRepo.save(cycle);
      }
    }
    return this.dossierRepo.findOne({ where: { id: dossier.id }, relations: ['cycles'] }) as Promise<DossierTravail>;
  }

  /** Met à jour la note de synthèse du dossier. */
  async updateNoteSynthese(clientId: number, exerciceId: number, noteSynthese: string): Promise<DossierTravail> {
    await this._checkExerciceOuvert(exerciceId);
    const dossier = await this.findOrCreate(clientId, exerciceId);
    dossier.noteSynthese = noteSynthese;
    await this.dossierRepo.save(dossier);
    return this.dossierRepo.findOne({ where: { id: dossier.id }, relations: ['cycles'] }) as Promise<DossierTravail>;
  }

  /** Met à jour un cycle (%, diligences, conclusion). */
  async updateCycle(
    clientId: number,
    exerciceId: number,
    typeCycle: TypeCycle,
    data: { pourcentageCouverture?: number; diligences?: string; conclusion?: string },
  ): Promise<CycleRevision> {
    await this._checkExerciceOuvert(exerciceId);
    const dossier = await this.findOrCreate(clientId, exerciceId);
    let cycle = dossier.cycles.find((c) => c.typeCycle === typeCycle);
    if (!cycle) {
      cycle = this.cycleRepo.create({ dossierTravailId: dossier.id, typeCycle });
    }
    Object.assign(cycle, data);
    return this.cycleRepo.save(cycle);
  }

  /** Reprise annuelle : copie le dossier de l'exercice source vers le nouvel exercice. */
  async reprendreVersExercice(clientId: number, sourceExerciceId: number, destExerciceId: number): Promise<void> {
    const source = await this.dossierRepo.findOne({
      where: { clientId, exerciceId: sourceExerciceId },
      relations: ['cycles'],
    });
    if (!source) return;

    let dest = await this.dossierRepo.findOne({ where: { clientId, exerciceId: destExerciceId } });
    if (!dest) {
      dest = this.dossierRepo.create({ clientId, exerciceId: destExerciceId });
    }
    // Copier la note de synthèse telle quelle (pas de génération IA)
    dest.noteSynthese = source.noteSynthese ?? '';
    dest = await this.dossierRepo.save(dest);

    // Créer des cycles vierges pour le nouvel exercice (on ne copie pas les diligences/conclusions)
    for (const type of CYCLES_ALL) {
      const existing = await this.cycleRepo.findOne({ where: { dossierTravailId: dest.id, typeCycle: type } });
      if (!existing) {
        await this.cycleRepo.save(this.cycleRepo.create({ dossierTravailId: dest.id, typeCycle: type }));
      }
    }
  }

  /** Interroge l'IA sur un cycle spécifique avec un prompt libre. */
  async queryCycleIa(
    clientId: number,
    exerciceId: number,
    typeCycle: TypeCycle,
    question: string,
    res: import('express').Response,
  ): Promise<void> {
    const dossier = await this.dossierRepo.findOne({
      where: { clientId, exerciceId },
      relations: ['cycles'],
    });
    const exercice = await this.exerciceRepo.findOne({ where: { id: exerciceId } });

    const cycle = dossier?.cycles.find((c) => c.typeCycle === typeCycle);
    const cycleLabel = { VENTE: 'Ventes', ACHAT: 'Achats', SOCIAL: 'Social' }[typeCycle];

    const context = `
Vous êtes un assistant expert-comptable. Répondez uniquement à partir des données ci-dessous.
Ne faites aucune hypothèse en dehors de ces informations.

Dossier client : #${clientId}
Exercice comptable : ${exercice?.annee ?? exerciceId}
Statut exercice : ${exercice?.statut ?? 'inconnu'}
Cycle analysé : ${cycleLabel}

Données du cycle ${cycleLabel} :
- Taux de couverture : ${cycle?.pourcentageCouverture ?? 0}%
- Diligences effectuées : ${cycle?.diligences || '(non renseignées)'}
- Conclusion provisoire : ${cycle?.conclusion || '(non renseignée)'}

Note de synthèse globale du dossier :
${dossier?.noteSynthese || '(non renseignée)'}
`.trim();

    const stream = await this.groq.chat.completions.create({
      model: this.model,
      stream: true,
      messages: [
        { role: 'system', content: context },
        { role: 'user',   content: question },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) res.write(delta);
    }
    res.end();
  }

  private async _createEmpty(clientId: number, exerciceId: number): Promise<DossierTravail> {
    const dossier = this.dossierRepo.create({ clientId, exerciceId, cycles: [] });
    const saved = await this.dossierRepo.save(dossier);
    for (const type of CYCLES_ALL) {
      await this.cycleRepo.save(this.cycleRepo.create({ dossierTravailId: saved.id, typeCycle: type }));
    }
    return this.dossierRepo.findOne({ where: { id: saved.id }, relations: ['cycles'] }) as Promise<DossierTravail>;
  }

  private async _checkExerciceOuvert(exerciceId: number): Promise<void> {
    if (exerciceId <= 0) return;
    const exercice = await this.exerciceRepo.findOne({ where: { id: exerciceId } });
    if (!exercice) throw new NotFoundException('Exercice introuvable');
    if (exercice.statut === ExerciceStatut.CLOTURE) {
      throw new ForbiddenException('Exercice clôturé — données en lecture seule');
    }
  }
}
