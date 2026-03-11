import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Client } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Client, FicheIdentite])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
