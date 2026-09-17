import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Canvas } from './canvas.entity';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([Canvas]), ClientsModule],
  controllers: [CanvasController],
  providers: [CanvasService],
})
export class CanvasModule {}
