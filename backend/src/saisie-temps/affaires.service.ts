import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Exercice } from '../entities/exercice.entity';
import { Client } from '../entities/client.entity';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { BudgetDossier } from '../entities/budget-dossier.entity';
import { AffaireInfo, ContexteAffaire, listerAffaires, resoudreAffaire } from './affaire.util';
import { lieuParDefaut } from './lieu-travail';

/** Date du jour au format ISO, dans le fuseau du serveur. */
export function aujourdhuiIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Accès base de données autour des affaires (exercices comptables des dossiers) — la règle
 * d'attribution elle-même est dans affaire.util.ts (fonctions pures, testées unitairement).
 */
@Injectable()
export class AffairesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AffairesService.name);

  constructor(
    @InjectRepository(Exercice) private exerciceRepo: Repository<Exercice>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(SaisieTemps) private saisieRepo: Repository<SaisieTemps>,
    @InjectRepository(BudgetDossier) private budgetRepo: Repository<BudgetDossier>,
  ) {}

  /** Contexte d'attribution (date de clôture annuelle + exercices PASSIDOC) de plusieurs dossiers. */
  async contextes(clientIds: number[]): Promise<Map<number, ContexteAffaire>> {
    const ids = [...new Set(clientIds.filter(Boolean))];
    const map = new Map<number, ContexteAffaire>();
    if (!ids.length) return map;
    const [clients, exercices] = await Promise.all([
      this.clientRepo.find({ where: { id: In(ids) }, select: { id: true, dateClotureExercice: true } }),
      this.exerciceRepo.find({ where: { clientId: In(ids) } }),
    ]);
    for (const c of clients) map.set(c.id, { dateClotureExercice: c.dateClotureExercice ?? null, exercices: [] });
    for (const e of exercices) map.get(e.clientId)?.exercices!.push(e);
    return map;
  }

  async contexte(clientId: number): Promise<ContexteAffaire> {
    return (await this.contextes([clientId])).get(clientId) ?? {};
  }

  async resoudre(clientId: number | null | undefined, date: string, missionCode?: string | null): Promise<string | null> {
    if (!clientId) return null;
    return resoudreAffaire(date, await this.contexte(clientId), missionCode);
  }

  /** Affaires proposées pour un dossier (sélecteur de la saisie, onglet Rentabilité). */
  async lister(clientId: number, tenantId: number): Promise<AffaireInfo[]> {
    const client = await this.clientRepo.findOne({ where: { id: clientId, tenantId }, select: { id: true } });
    if (!client) throw new NotFoundException('Dossier introuvable');
    const [ctx, saisies, budgets] = await Promise.all([
      this.contexte(clientId),
      this.saisieRepo.createQueryBuilder('s')
        .select('DISTINCT s.affaire', 'affaire')
        .where('s.clientId = :clientId AND s.affaire IS NOT NULL', { clientId })
        .getRawMany<{ affaire: string }>(),
      this.budgetRepo.find({ where: { clientId }, select: { affaire: true } }),
    ]);
    return listerAffaires(ctx, aujourdhuiIso(), [...saisies.map(s => s.affaire), ...budgets.map(b => b.affaire)]);
  }

  /**
   * Rattrapage unique des saisies antérieures à l'ajout de la colonne `affaire` : chaque saisie
   * avec client mais sans affaire reçoit celle que la règle lui attribue aujourd'hui. Idempotent
   * (ne touche que les lignes encore NULL) et ne bloque jamais le démarrage.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.rattraperAffaires();
    await this.rattraperLieuxTravail();
  }

  private async rattraperAffaires(): Promise<void> {
    try {
      const saisies = await this.saisieRepo.find({
        where: { affaire: IsNull(), clientId: Not(IsNull()) },
        select: { id: true, clientId: true, date: true, missionCode: true },
      });
      if (!saisies.length) return;
      const ctx = await this.contextes(saisies.map(s => s.clientId));
      const parCode = new Map<string, number[]>();
      for (const s of saisies) {
        const code = resoudreAffaire(s.date, ctx.get(s.clientId) ?? {}, s.missionCode);
        parCode.set(code, [...(parCode.get(code) ?? []), s.id]);
      }
      for (const [code, ids] of parCode) {
        for (let i = 0; i < ids.length; i += 500) {
          await this.saisieRepo.update({ id: In(ids.slice(i, i + 500)) }, { affaire: code });
        }
      }
      this.logger.log(`Affaires attribuées à ${saisies.length} saisie(s) existante(s).`);
    } catch (e: any) {
      this.logger.error(`Rattrapage des affaires impossible (démarrage poursuivi) : ${e?.message ?? e}`);
    }
  }

  /** Cahier v2 #5 : les saisies antérieures au pôle de travail prennent le site du collaborateur. */
  private async rattraperLieuxTravail(): Promise<void> {
    try {
      const saisies = await this.saisieRepo.find({
        where: { lieuTravail: IsNull() },
        relations: ['collaborateur'],
        select: { id: true, collaborateur: { id: true, site: true } },
      });
      if (!saisies.length) return;
      const parLieu = new Map<string, number[]>();
      for (const s of saisies) {
        const lieu = lieuParDefaut(s.collaborateur);
        parLieu.set(lieu, [...(parLieu.get(lieu) ?? []), s.id]);
      }
      for (const [lieu, ids] of parLieu) {
        for (let i = 0; i < ids.length; i += 500) {
          await this.saisieRepo.update({ id: In(ids.slice(i, i + 500)) }, { lieuTravail: lieu });
        }
      }
      this.logger.log(`Pôle de travail attribué à ${saisies.length} saisie(s) existante(s).`);
    } catch (e: any) {
      this.logger.error(`Rattrapage des pôles de travail impossible (démarrage poursuivi) : ${e?.message ?? e}`);
    }
  }
}
