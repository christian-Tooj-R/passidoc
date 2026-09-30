import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SaisieTempsScheduler {
  private readonly logger = new Logger(SaisieTempsScheduler.name);

  constructor(
    @InjectRepository(SaisieTemps) private saisieRepo: Repository<SaisieTemps>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notifications: NotificationsService,
  ) {}

  // ── Alerte hebdomadaire : heures saisies < heures contractuelles (chaque lundi à 6h30) ──
  @Cron('30 6 * * 1')
  async alerterHeuresHebdomadaires(): Promise<number> {
    try {
      const today = new Date();
      const lundi = new Date(today);
      lundi.setDate(today.getDate() - 7);
      const vendredi = new Date(today);
      vendredi.setDate(today.getDate() - 3);

      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dateDebut = fmt(lundi);
      const dateFin = fmt(vendredi);

      const alertes = await this.verifierSemaine(dateDebut, dateFin);
      this.logger.log(`[Heures hebdo] ${alertes} alerte(s) envoyée(s) pour la semaine du ${dateDebut} au ${dateFin}`);
      return alertes;
    } catch (err) {
      this.logger.error('[Heures hebdo] Erreur cron alerterHeuresHebdomadaires', err);
      return 0;
    }
  }

  /**
   * Calcule les heures saisies par chaque collaborateur actif sur la période [dateDebut, dateFin]
   * et notifie l'intéressé + son référent direct si le total est en dessous de ses heures
   * hebdomadaires contractuelles (`User.heuresHebdo`, 40h par défaut si non renseigné).
   */
  async verifierSemaine(dateDebut: string, dateFin: string): Promise<number> {
    const users = await this.userRepo.find({
      where: { isActive: true },
    });

    let alertes = 0;
    for (const user of users) {
      if (user.role === UserRole.ADMIN) continue;

      const seuil = user.heuresHebdo ?? 40;
      const { total } = await this.saisieRepo.createQueryBuilder('s')
        .select('COALESCE(SUM(s.dureeHeures), 0)', 'total')
        .where('s.collaborateurId = :userId', { userId: user.id })
        .andWhere('s.date BETWEEN :debut AND :fin', { debut: dateDebut, fin: dateFin })
        .getRawOne();

      const heuresSaisies = Number(total) || 0;
      if (heuresSaisies >= seuil) continue;

      const manque = Math.round((seuil - heuresSaisies) * 10) / 10;

      await this.notifications.emit(user.id, {
        type: 'HEURES_HEBDO_INSUFFISANTES',
        message: `Semaine du ${dateDebut} au ${dateFin} : ${heuresSaisies}h saisies sur ${seuil}h attendues (il manque ${manque}h)`,
      });

      if (user.referentId) {
        await this.notifications.emit(user.referentId, {
          type: 'HEURES_HEBDO_INSUFFISANTES_EQUIPE',
          message: `${user.firstName} ${user.lastName} : ${heuresSaisies}h saisies sur ${seuil}h attendues la semaine du ${dateDebut} au ${dateFin} (il manque ${manque}h)`,
        });
      }

      alertes++;
    }
    return alertes;
  }
}
