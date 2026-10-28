import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from '../entities/mission.entity';
import { MissionHistorique } from '../entities/mission-historique.entity';
import { RecommandationCycle } from '../entities/recommandation-cycle.entity';
import { Client } from '../entities/client.entity';
import { Exercice } from '../entities/exercice.entity';
import { Secteur } from '../entities/secteur.entity';
import { User } from '../entities/user.entity';
import { MissionsService } from './missions.service';
import { MissionsScheduler } from './missions.scheduler';
import { MissionsCabinetController, MissionsController } from './missions.controller';
import { ClientsModule } from '../clients/clients.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, MissionHistorique, RecommandationCycle, Client, Exercice, Secteur, User]),
    ClientsModule,
    NotificationsModule,
  ],
  providers: [MissionsService, MissionsScheduler],
  controllers: [MissionsController, MissionsCabinetController],
})
export class MissionsModule {}
