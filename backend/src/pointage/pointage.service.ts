import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pointage } from '../entities/pointage.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class PointageService {
  constructor(
    @InjectRepository(Pointage) private repo: Repository<Pointage>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // Pointer l'arrivée (ou retourner le pointage existant si déjà fait)
  async pointer(userId: number): Promise<Pointage> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.repo.findOne({ where: { userId, date: today } });
    if (existing) {
      if (!existing.heureDepart) {
        // Pointer le départ
        existing.heureDepart = new Date();
        return this.repo.save(existing);
      }
      throw new BadRequestException('Vous avez déjà pointé arrivée et départ aujourd\'hui');
    }
    const pointage = this.repo.create({ userId, date: today, heureArrivee: new Date() });
    return this.repo.save(pointage);
  }

  // Vue journalière : tous les users + leur pointage du jour
  async getJournee(date: string, site?: string): Promise<{ user: User; pointage: Pointage | null }[]> {
    const usersQuery = this.userRepo.createQueryBuilder('u').where('u.isActive = true');
    if (site) usersQuery.andWhere('u.site = :site', { site });
    const users = await usersQuery.getMany();

    const pointages = await this.repo.find({ where: { date }, relations: ['user'] });
    const map = new Map(pointages.map(p => [p.userId, p]));

    return users.map(u => ({ user: u, pointage: map.get(u.id) ?? null }));
  }

  // Historique d'un utilisateur (30 derniers jours)
  async getHistorique(userId: number): Promise<Pointage[]> {
    return this.repo
      .createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .orderBy('p.date', 'DESC')
      .limit(30)
      .getMany();
  }

  // Statut du jour pour l'utilisateur connecté
  async getMonStatut(userId: number): Promise<{ pointage: Pointage | null; estPointe: boolean; estParti: boolean }> {
    const today = new Date().toISOString().split('T')[0];
    const pointage = await this.repo.findOne({ where: { userId, date: today } });
    return {
      pointage,
      estPointe: !!pointage?.heureArrivee,
      estParti: !!pointage?.heureDepart,
    };
  }
}
