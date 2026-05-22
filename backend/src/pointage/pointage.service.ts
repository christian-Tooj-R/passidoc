import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pointage } from '../entities/pointage.entity';
import { User } from '../entities/user.entity';

export type EtatPointage = 'absent' | 'present' | 'en_pause' | 'revenu' | 'parti';

export interface StatutJour {
  pointage:      Pointage | null;
  etat:          EtatPointage;
  estPointe:     boolean;
  enPause:       boolean;
  estRevenu:     boolean;
  estParti:      boolean;
  dureeNetteMin: number;
  dureePauseMin: number;
}

@Injectable()
export class PointageService {
  constructor(
    @InjectRepository(Pointage) private repo: Repository<Pointage>,
    @InjectRepository(User)     private userRepo: Repository<User>,
  ) {}

  // ── Cycle : arrivée → début_pause → fin_pause → départ ──────
  async pointer(userId: number): Promise<Pointage> {
    const today = new Date().toISOString().split('T')[0];
    const p     = await this.repo.findOne({ where: { userId, date: today } });

    if (!p) {
      return this.repo.save(this.repo.create({ userId, date: today, heureArrivee: new Date() }));
    }
    if (!p.heureDebutPause) { p.heureDebutPause = new Date(); return this.repo.save(p); }
    if (!p.heureFinPause)   { p.heureFinPause   = new Date(); return this.repo.save(p); }
    if (!p.heureDepart)     { p.heureDepart      = new Date(); return this.repo.save(p); }

    throw new BadRequestException('Tous les pointages du jour ont déjà été enregistrés');
  }

  // ── Vue journalière équipe ───────────────────────────────────
  async getJournee(date: string, site?: string): Promise<{ user: User; pointage: Pointage | null }[]> {
    const q = this.userRepo.createQueryBuilder('u').where('u.isActive = true');
    if (site) q.andWhere('u.site = :site', { site });
    const users = await q.getMany();

    const pointages = await this.repo.find({ where: { date }, relations: ['user'] });
    const map = new Map(pointages.map(p => [p.userId, p]));
    return users.map(u => ({ user: u, pointage: map.get(u.id) ?? null }));
  }

  // ── Historique individuel (30 jours) ────────────────────────
  async getHistorique(userId: number): Promise<Pointage[]> {
    return this.repo.createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .orderBy('p.date', 'DESC')
      .limit(30)
      .getMany();
  }

  // ── Historique global admin (200 lignes) ────────────────────
  async getHistoriqueAll(site?: string): Promise<(Pointage & { user: User })[]> {
    const q = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .orderBy('p.date', 'DESC')
      .addOrderBy('p.heureArrivee', 'DESC')
      .limit(200);
    if (site) q.where('u.site = :site', { site });
    return q.getMany() as any;
  }

  // ── Statut du jour (utilisateur connecté) ───────────────────
  async getMonStatut(userId: number): Promise<StatutJour> {
    const today = new Date().toISOString().split('T')[0];
    const p     = await this.repo.findOne({ where: { userId, date: today } });

    let etat: EtatPointage = 'absent';
    if (p?.heureDepart)          etat = 'parti';
    else if (p?.heureFinPause)   etat = 'revenu';
    else if (p?.heureDebutPause) etat = 'en_pause';
    else if (p?.heureArrivee)    etat = 'present';

    return {
      pointage:      p ?? null,
      etat,
      estPointe:     !!p?.heureArrivee,
      enPause:       etat === 'en_pause',
      estRevenu:     etat === 'revenu',
      estParti:      etat === 'parti',
      dureeNetteMin: p ? this.calcNette(p) : 0,
      dureePauseMin: p ? this.calcPause(p) : 0,
    };
  }

  private calcPause(p: Pointage): number {
    if (!p.heureDebutPause) return 0;
    const fin = p.heureFinPause ? new Date(p.heureFinPause) : new Date();
    return Math.max(0, Math.floor((fin.getTime() - new Date(p.heureDebutPause).getTime()) / 60000));
  }

  private calcNette(p: Pointage): number {
    const fin   = p.heureDepart ? new Date(p.heureDepart) : new Date();
    const total = Math.max(0, Math.floor((fin.getTime() - new Date(p.heureArrivee).getTime()) / 60000));
    return Math.max(0, total - this.calcPause(p));
  }
}
