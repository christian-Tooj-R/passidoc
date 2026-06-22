import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pointage } from '../entities/pointage.entity';
import { PausePointage } from '../entities/pause-pointage.entity';
import { User } from '../entities/user.entity';
import { SiteLocation } from '../entities/site-location.entity';

export type EtatPointage = 'absent' | 'present' | 'en_pause' | 'revenu' | 'parti';
export type ActionPointage = 'debut_pause' | 'fin_pause' | 'depart';

export interface StatutJour {
  pointage:      Pointage | null;
  etat:          EtatPointage;
  estPointe:     boolean;
  enPause:       boolean;
  estRevenu:     boolean;
  estParti:      boolean;
  dureeNetteMin: number;
  dureePauseMin: number;
  nbPauses:      number;
}

@Injectable()
export class PointageService {
  constructor(
    @InjectRepository(Pointage)       private repo:      Repository<Pointage>,
    @InjectRepository(PausePointage)  private pauseRepo: Repository<PausePointage>,
    @InjectRepository(User)           private userRepo:  Repository<User>,
    @InjectRepository(SiteLocation)   private siteRepo:  Repository<SiteLocation>,
  ) {}

  // ── Pointage avec gestion multi-pauses ──────────────────────
  async pointer(
    userId: number,
    latitude?: number,
    longitude?: number,
    action?: ActionPointage,
  ): Promise<Pointage> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur introuvable');

    // Vérification géolocalisation
    const siteLocation = await this.siteRepo.findOne({ where: { site: user.site as any } });
    if (siteLocation) {
      if (latitude == null || longitude == null) {
        throw new BadRequestException(
          'Localisation requise pour pointer. Autorisez la géolocalisation dans votre navigateur.',
        );
      }
      const distance = this.haversine(
        Number(latitude), Number(longitude),
        Number(siteLocation.latitude), Number(siteLocation.longitude),
      );
      if (distance > Number(siteLocation.radiusMeters)) {
        throw new BadRequestException(
          `Vous êtes trop loin du bureau (${Math.round(distance)} m). Zone autorisée : ${siteLocation.radiusMeters} m.`,
        );
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const coords = { latitude: latitude ?? null, longitude: longitude ?? null };

    // Pas encore pointé aujourd'hui → arrivée
    let p = await this.repo.findOne({ where: { userId, date: today }, relations: ['pauses'] });
    if (!p) {
      p = await this.repo.save(
        this.repo.create({ userId, date: today, heureArrivee: new Date(), ...coords }),
      );
      p.pauses = [];
      return p;
    }

    // Départ déjà enregistré
    if (p.heureDepart) {
      throw new BadRequestException('Tous les pointages du jour ont déjà été enregistrés');
    }

    const pauseOuverte = p.pauses?.find(pp => !pp.heureFin) ?? null;

    if (action === 'debut_pause') {
      if (pauseOuverte) throw new BadRequestException('Une pause est déjà en cours');
      await this.pauseRepo.save(this.pauseRepo.create({ pointageId: p.id, heureDebut: new Date() }));
      return (await this.repo.findOne({ where: { id: p.id }, relations: ['pauses'] }))!;
    }

    if (action === 'fin_pause') {
      if (!pauseOuverte) throw new BadRequestException('Aucune pause en cours');
      pauseOuverte.heureFin = new Date();
      await this.pauseRepo.save(pauseOuverte);
      return (await this.repo.findOne({ where: { id: p.id }, relations: ['pauses'] }))!;
    }

    if (action === 'depart') {
      if (pauseOuverte) throw new BadRequestException('Terminez la pause avant de pointer le départ');
      p.heureDepart = new Date();
      Object.assign(p, coords);
      // Détacher pauses pour éviter la cascade sur un tableau potentiellement non à jour
      const pauses = p.pauses;
      delete (p as any).pauses;
      const saved = await this.repo.save(p);
      saved.pauses = pauses;
      return saved;
    }

    // Rétro-compat : sans action → arrivée déjà gérée ci-dessus
    if (!pauseOuverte && !p.heureDepart) {
      if ((p.pauses?.length ?? 0) === 0) {
        await this.pauseRepo.save(this.pauseRepo.create({ pointageId: p.id, heureDebut: new Date() }));
        return (await this.repo.findOne({ where: { id: p.id }, relations: ['pauses'] }))!;
      } else {
        p.heureDepart = new Date();
        Object.assign(p, coords);
        const pauses = p.pauses;
        delete (p as any).pauses;
        const saved = await this.repo.save(p);
        saved.pauses = pauses;
        return saved;
      }
    } else if (pauseOuverte) {
      pauseOuverte.heureFin = new Date();
      await this.pauseRepo.save(pauseOuverte);
      return (await this.repo.findOne({ where: { id: p.id }, relations: ['pauses'] }))!;
    }

    return this.repo.findOne({ where: { id: p.id }, relations: ['pauses'] }) as any;
  }

  // ── Emplacement bureau ───────────────────────────────────────
  async getSiteLocation(site: string): Promise<SiteLocation | null> {
    return this.siteRepo.findOne({ where: { site: site as any } });
  }

  async upsertSiteLocation(
    site: string, latitude: number, longitude: number,
    radiusMeters: number, adresse?: string,
  ): Promise<SiteLocation> {
    let existing = await this.siteRepo.findOne({ where: { site: site as any } });
    if (!existing) {
      existing = this.siteRepo.create({ site: site as any, latitude, longitude, radiusMeters, adresse });
    } else {
      existing.latitude = latitude;
      existing.longitude = longitude;
      existing.radiusMeters = radiusMeters;
      if (adresse) existing.adresse = adresse;
    }
    return this.siteRepo.save(existing);
  }

  // ── Vue journalière équipe ───────────────────────────────────
  async getJournee(date: string, site?: string): Promise<{ user: User; pointage: Pointage | null }[]> {
    const q = this.userRepo.createQueryBuilder('u').where('u.isActive = true');
    if (site) q.andWhere('u.site = :site', { site });
    const users = await q.getMany();
    const pointages = await this.repo.find({ where: { date }, relations: ['user', 'pauses'] });
    const map = new Map(pointages.map(p => [p.userId, p]));
    return users.map(u => ({ user: u, pointage: map.get(u.id) ?? null }));
  }

  // ── Historique individuel (30 jours) ────────────────────────
  async getHistorique(userId: number): Promise<Pointage[]> {
    return this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.pauses', 'pp')
      .where('p.userId = :userId', { userId })
      .orderBy('p.date', 'DESC')
      .limit(30)
      .getMany();
  }

  // ── Historique global admin (200 lignes) ────────────────────
  async getHistoriqueAll(site?: string): Promise<(Pointage & { user: User })[]> {
    const q = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .leftJoinAndSelect('p.pauses', 'pp')
      .orderBy('p.date', 'DESC')
      .addOrderBy('p.heureArrivee', 'DESC')
      .limit(200);
    if (site) q.where('u.site = :site', { site });
    return q.getMany() as any;
  }

  // ── Statut du jour ───────────────────────────────────────────
  async getMonStatut(userId: number): Promise<StatutJour> {
    const today = new Date().toISOString().split('T')[0];
    const p = await this.repo.findOne({ where: { userId, date: today }, relations: ['pauses'] });

    const pauseOuverte = p?.pauses?.find(pp => !pp.heureFin) ?? null;

    let etat: EtatPointage = 'absent';
    if (p?.heureDepart)  etat = 'parti';
    else if (pauseOuverte) etat = 'en_pause';
    else if (p?.pauses?.length && !pauseOuverte) etat = 'revenu';
    else if (p?.heureArrivee) etat = 'present';

    const dureePauseMin = p ? this.calcPause(p) : 0;

    return {
      pointage:      p ?? null,
      etat,
      estPointe:     !!p?.heureArrivee,
      enPause:       etat === 'en_pause',
      estRevenu:     etat === 'revenu',
      estParti:      etat === 'parti',
      dureeNetteMin: p ? this.calcNette(p) : 0,
      dureePauseMin,
      nbPauses:      p?.pauses?.length ?? 0,
    };
  }

  // ── Calculs durée ────────────────────────────────────────────
  calcPause(p: Pointage): number {
    if (!p.pauses?.length) return 0;
    return p.pauses.reduce((sum, pp) => {
      const fin = pp.heureFin ? new Date(pp.heureFin) : new Date();
      return sum + Math.max(0, Math.floor((fin.getTime() - new Date(pp.heureDebut).getTime()) / 60000));
    }, 0);
  }

  calcNette(p: Pointage): number {
    const fin   = p.heureDepart ? new Date(p.heureDepart) : new Date();
    const total = Math.max(0, Math.floor((fin.getTime() - new Date(p.heureArrivee).getTime()) / 60000));
    return Math.max(0, total - this.calcPause(p));
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
