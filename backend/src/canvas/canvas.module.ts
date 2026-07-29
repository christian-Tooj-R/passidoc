import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Canvas } from './canvas.entity';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Canvas])],
  controllers: [CanvasController],
  providers: [CanvasService],
})
export class CanvasModule {}
