import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FluxMensuelService } from './flux-mensuel.service';
import { FluxMensuelController } from './flux-mensuel.controller';
import { FluxMensuel } from '../entities/flux-mensuel.entity';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([FluxMensuel]), ClientsModule],
  controllers: [FluxMensuelController],
  providers: [FluxMensuelService],
})
export class FluxMensuelModule {}
