import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FicheIdentiteService } from './fiche-identite.service';
import { FicheIdentiteController } from './fiche-identite.controller';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([FicheIdentite]), ClientsModule],
  controllers: [FicheIdentiteController],
  providers: [FicheIdentiteService],
})
export class FicheIdentiteModule {}
