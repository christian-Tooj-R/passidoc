import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Mission } from '../entities/mission.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { aujourdhuiIso } from '../saisie-temps/affaires.service';
import { echeanceANotifier } from './missions.util';

const dateFr = (iso: string) => iso.split('-').reverse().join('/');

/**
 * R8 — notifications de relance des missions, chaque nuit :
 *  - J-3 : au collaborateur responsable de la mission ;
 *  - J0  : au responsable, à son chef de mission (référent) et au chef d'antenne du dossier
 *          (le rôle « Responsable développement » n'existe pas : le chef d'antenne couvre ce
 *          périmètre, CDC §7).
 * Chaque échéance n'est notifiée qu'une fois par date de relance.
 */
@Injectable()
export class MissionsScheduler {
  private readonly logger = new Logger(MissionsScheduler.name);

  constructor(
    @InjectRepository(Mission) private repo: Repository<Mission>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notifications: NotificationsService,
  ) {}

  @Cron('0 2 * * *')
  async cron() {
    try {
      const n = await this.notifierRelances();
      if (n) this.logger.log(`${n} notification(s) de relance de mission envoyée(s)`);
    } catch (e: any) {
      this.logger.error(`Notifications de relance des missions impossibles : ${e?.message ?? e}`);
    }
  }

  async notifierRelances(aujourdhui = aujourdhuiIso()): Promise<number> {
    const missions = await this.repo.find({
      where: { archivee: false, statut: In(['PROPOSEE', 'EN_DISCUSSION']), dateRelance: Not(IsNull()) },
      relations: ['client', 'responsable'],
    });
    let envoyees = 0;
    for (const m of missions) {
      const echeance = echeanceANotifier(m, aujourdhui);
      if (!echeance || !m.client) continue;
      const responsableId = m.responsableId ?? m.client.responsableId ?? null;
      const destinataires = new Set<number>(responsableId ? [responsableId] : []);
      if (echeance === 'J0') {
        const referentId = m.responsable?.referentId
          ?? (responsableId ? (await this.userRepo.findOne({ where: { id: responsableId } }))?.referentId : null);
        if (referentId) destinataires.add(referentId);
        if (m.client.site) {
          const chefs = await this.userRepo.find({
            where: { tenantId: m.client.tenantId, role: UserRole.CHEF_ANTENNE, antenne: m.client.site as any, isActive: true },
          });
          chefs.forEach(c => destinataires.add(c.id));
        }
      }
      const date = dateFr(m.dateRelance!);
      const message = echeance === 'J3'
        ? `Relance prévue le ${date} : « ${m.titre} » (${m.client.nom})`
        : m.dateRelance! < aujourdhui
          ? `Relance en retard depuis le ${date} : « ${m.titre} » (${m.client.nom})`
          : `À relancer aujourd'hui : « ${m.titre} » (${m.client.nom})`;
      for (const userId of destinataires) {
        await this.notifications.emit(userId, { type: 'MISSION_RELANCE', titre: m.titre, message, clientId: m.clientId });
        envoyees++;
      }
      // J0 atteint : le rappel J-3 n'a plus lieu d'être pour cette date. Requête brute : une
      // notification n'est pas une modification de la mission (updatedAt = « Dernière modif. »).
      await this.repo.query(
        `UPDATE missions SET "notifJ3Pour" = $1${echeance === 'J0' ? ', "notifJ0Pour" = $1' : ''} WHERE id = $2`,
        [m.dateRelance, m.id]);
    }
    return envoyees;
  }
}
