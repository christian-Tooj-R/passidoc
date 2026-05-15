import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from '../entities/mission.entity';
import { Client } from '../entities/client.entity';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mission, Client])],
  providers: [MissionsService],
  controllers: [MissionsController],
})
export class MissionsModule {}
