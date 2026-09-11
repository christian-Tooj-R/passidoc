import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { BudgetMission } from '../entities/budget-mission.entity';
import { Pointage } from '../entities/pointage.entity';
import { IncoherencePointage } from '../entities/incoherence-pointage.entity';
import { SaisieTempsService } from './saisie-temps.service';
import { SaisieTempsController } from './saisie-temps.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SaisieTemps, Pointage, BudgetMission, IncoherencePointage])],
  controllers: [SaisieTempsController],
  providers: [SaisieTempsService],
  exports: [SaisieTempsService],
})
export class SaisieTempsModule {}
