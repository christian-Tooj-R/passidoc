import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { BudgetMission } from '../entities/budget-mission.entity';
import { Pointage } from '../entities/pointage.entity';
import { IncoherencePointage } from '../entities/incoherence-pointage.entity';
import { User } from '../entities/user.entity';
import { Client } from '../entities/client.entity';
import { Exercice } from '../entities/exercice.entity';
import { BudgetDossier } from '../entities/budget-dossier.entity';
import { CongeAbsence } from '../entities/conge-absence.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SaisieTempsService } from './saisie-temps.service';
import { SaisieTempsController } from './saisie-temps.controller';
import { SaisieTempsScheduler } from './saisie-temps.scheduler';
import { AffairesService } from './affaires.service';
import { RentabiliteService } from './rentabilite.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaisieTemps, Pointage, BudgetMission, IncoherencePointage, User,
      Client, Exercice, BudgetDossier, CongeAbsence,
    ]),
    NotificationsModule,
  ],
  controllers: [SaisieTempsController],
  providers: [SaisieTempsService, SaisieTempsScheduler, AffairesService, RentabiliteService],
  exports: [SaisieTempsService],
})
export class SaisieTempsModule {}
