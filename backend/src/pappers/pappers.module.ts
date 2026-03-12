import { Module } from '@nestjs/common';
import { PappersService } from './pappers.service';
import { PappersController } from './pappers.controller';

@Module({
  controllers: [PappersController],
  providers: [PappersService],
})
export class PappersModule {}
