import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from '../entities/mission.entity';
import { Client } from '../entities/client.entity';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([Mission, Client]), ClientsModule],
  providers: [MissionsService],
  controllers: [MissionsController],
})
export class MissionsModule {}
