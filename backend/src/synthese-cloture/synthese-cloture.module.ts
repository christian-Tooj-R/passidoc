import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyntheseCloureService } from './synthese-cloture.service';
import { SyntheseCloureController } from './synthese-cloture.controller';
import { SyntheseCloture } from '../entities/synthese-cloture.entity';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([SyntheseCloture]), ClientsModule],
  controllers: [SyntheseCloureController],
  providers: [SyntheseCloureService],
})
export class SyntheseCloureModule {}
