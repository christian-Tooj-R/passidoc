import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControleInterne } from '../entities/controle-interne.entity';
import { Exercice } from '../entities/exercice.entity';
import { ControleInterneService } from './controle-interne.service';
import { ControleInterneController } from './controle-interne.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ControleInterne, Exercice])],
  providers: [ControleInterneService],
  controllers: [ControleInterneController],
  exports: [ControleInterneService],
})
export class ControleInterneModule {}
