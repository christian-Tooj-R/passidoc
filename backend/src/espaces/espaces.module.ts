import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Espace } from '../entities/espace.entity';
import { EspaceDoc } from '../entities/espace-doc.entity';
import { EspacesService } from './espaces.service';
import { EspacesController } from './espaces.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Espace, EspaceDoc]),
    MulterModule.register(),
  ],
  controllers: [EspacesController],
  providers: [EspacesService],
})
export class EspacesModule {}
