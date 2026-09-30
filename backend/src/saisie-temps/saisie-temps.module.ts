import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { BudgetMission } from '../entities/budget-mission.entity';
import { Pointage } from '../entities/pointage.entity';
import { IncoherencePointage } from '../entities/incoherence-pointage.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SaisieTempsService } from './saisie-temps.service';
import { SaisieTempsController } from './saisie-temps.controller';
import { SaisieTempsScheduler } from './saisie-temps.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([SaisieTemps, Pointage, BudgetMission, IncoherencePointage, User]), NotificationsModule],
  controllers: [SaisieTempsController],
  providers: [SaisieTempsService, SaisieTempsScheduler],
  exports: [SaisieTempsService],
})
export class SaisieTempsModule {}
