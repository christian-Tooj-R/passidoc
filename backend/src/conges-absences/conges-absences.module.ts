import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CongesAbsencesService } from './conges-absences.service';
import { CongesAbsencesController } from './conges-absences.controller';
import { CongeAbsence } from '../entities/conge-absence.entity';
import { SoldeConge } from '../entities/solde-conge.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CongeAbsence, SoldeConge, User])],
  controllers: [CongesAbsencesController],
  providers: [CongesAbsencesService],
  exports: [CongesAbsencesService],
})
export class CongesAbsencesModule {}
