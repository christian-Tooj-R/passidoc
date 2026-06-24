import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercice } from '../entities/exercice.entity';
import { ExerciceService } from './exercice.service';
import { ExerciceController } from './exercice.controller';
import { ControleInterneModule } from '../controle-interne/controle-interne.module';

@Module({
  imports: [TypeOrmModule.forFeature([Exercice]), ControleInterneModule],
  controllers: [ExerciceController],
  providers: [ExerciceService],
  exports: [ExerciceService],
})
export class ExerciceModule {}
