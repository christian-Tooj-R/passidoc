import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';
import { Exercice } from '../entities/exercice.entity';
import { AnalyseStrategiqueService } from './analyse-strategique.service';
import { AnalyseStrategiqueController } from './analyse-strategique.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyseStrategique, Exercice])],
  providers: [AnalyseStrategiqueService],
  controllers: [AnalyseStrategiqueController],
})
export class AnalyseStrategiqueModule {}
