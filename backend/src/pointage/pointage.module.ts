import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointageService } from './pointage.service';
import { PointageController } from './pointage.controller';
import { Pointage } from '../entities/pointage.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pointage, User])],
  controllers: [PointageController],
  providers: [PointageService],
})
export class PointageModule {}
