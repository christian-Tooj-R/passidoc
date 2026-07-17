import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercice } from '../entities/exercice.entity';
import { ExerciceService } from './exercice.service';
import { ExerciceController } from './exercice.controller';
import { ControleInterneModule } from '../controle-interne/controle-interne.module';
import { AnalyseStrategiqueModule } from '../analyse-strategique/analyse-strategique.module';
import { ObjectifsModule } from '../objectifs/objectifs.module';
import { DossierTravailModule } from '../dossier-travail/dossier-travail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exercice]),
    ControleInterneModule,
    AnalyseStrategiqueModule,
    ObjectifsModule,
    DossierTravailModule,
  ],
  controllers: [ExerciceController],
  providers: [ExerciceService],
  exports: [ExerciceService],
})
export class ExerciceModule {}
