import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControleInterne } from '../entities/controle-interne.entity';
import { Client } from '../entities/client.entity';
import { ControleInterneService } from './controle-interne.service';
import { ControleInterneController } from './controle-interne.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ControleInterne, Client])],
  providers: [ControleInterneService],
  controllers: [ControleInterneController],
})
export class ControleInterneModule {}
