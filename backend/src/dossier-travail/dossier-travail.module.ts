import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DossierTravail } from '../entities/dossier-travail.entity';
import { CycleRevision } from '../entities/cycle-revision.entity';
import { Exercice } from '../entities/exercice.entity';
import { DossierTravailService } from './dossier-travail.service';
import { DossierTravailController } from './dossier-travail.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DossierTravail, CycleRevision, Exercice])],
  providers: [DossierTravailService],
  controllers: [DossierTravailController],
  exports: [DossierTravailService],
})
export class DossierTravailModule {}
