import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectifsClient } from '../entities/objectifs-client.entity';
import { Client } from '../entities/client.entity';
import { ObjectifsService } from './objectifs.service';
import { ObjectifsController } from './objectifs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ObjectifsClient, Client])],
  providers: [ObjectifsService],
  controllers: [ObjectifsController],
})
export class ObjectifsModule {}
