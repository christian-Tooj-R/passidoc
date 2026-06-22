import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointageService } from './pointage.service';
import { PointageController } from './pointage.controller';
import { Pointage } from '../entities/pointage.entity';
import { PausePointage } from '../entities/pause-pointage.entity';
import { User } from '../entities/user.entity';
import { SiteLocation } from '../entities/site-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pointage, PausePointage, User, SiteLocation])],
  controllers: [PointageController],
  providers: [PointageService],
})
export class PointageModule {}
