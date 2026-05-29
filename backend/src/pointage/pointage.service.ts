import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pointage } from '../entities/pointage.entity';
import { User } from '../entities/user.entity';
import { SiteLocation } from '../entities/site-location.entity';

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
    @InjectRepository(Pointage)      private repo: Repository<Pointage>,
    @InjectRepository(User)          private userRepo: Repository<User>,
    @InjectRepository(SiteLocation)  private siteRepo: Repository<SiteLocation>,
  ) {}

  // ── Cycle : arrivée → début_pause → fin_pause → départ ──────
  async pointer(userId: number, latitude?: number, longitude?: number): Promise<Pointage> {
    // Récupérer l'utilisateur pour connaître son site
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur introuvable');

    // Vérification géolocalisation si un emplacement est configuré
    const siteLocation = await this.siteRepo.findOne({ where: { site: user.site as any } });
    if (siteLocation) {
      if (latitude == null || longitude == null) {
        throw new BadRequestException(
          'Localisation requise pour pointer. Autorisez la géolocalisation dans votre navigateur.'
        );
      }
      const distance = this.haversine(
        Number(latitude), Number(longitude),
        Number(siteLocation.latitude), Number(siteLocation.longitude),
      );
      if (distance > Number(siteLocation.radiusMeters)) {
        throw new BadRequestException(
          `Vous êtes trop loin du bureau (${Math.round(distance)} m). ` +
          `Zone autorisée : ${siteLocation.radiusMeters} m.`
        );
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const p     = await this.repo.findOne({ where: { userId, date: today } });

    const coords = { latitude: latitude ?? null, longitude: longitude ?? null };

    if (!p) {
      return this.repo.save(this.repo.create({ userId, date: today, heureArrivee: new Date(), ...coords }));
    }
    if (!p.heureDebutPause) { p.heureDebutPause = new Date(); Object.assign(p, coords); return this.repo.save(p); }
    if (!p.heureFinPause)   { p.heureFinPause   = new Date(); Object.assign(p, coords); return this.repo.save(p); }
    if (!p.heureDepart)     { p.heureDepart      = new Date(); Object.assign(p, coords); return this.repo.save(p); }

    throw new BadRequestException('Tous les pointages du jour ont déjà été enregistrés');
  }

  // ── Récupérer l'emplacement bureau d'un site ─────────────────
  async getSiteLocation(site: string): Promise<SiteLocation | null> {
    return this.siteRepo.findOne({ where: { site: site as any } });
  }

  // ── Créer/Mettre à jour l'emplacement d'un site (admin) ──────
  async upsertSiteLocation(
    site: string,
    latitude: number,
    longitude: number,
    radiusMeters: number,
    adresse?: string,
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

  // ── Formule Haversine (distance en mètres entre deux points GPS) ──
  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // rayon Terre en mètres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
