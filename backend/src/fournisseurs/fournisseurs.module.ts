import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FournisseursService } from './fournisseurs.service';
import { FournisseursController } from './fournisseurs.controller';
import { Fournisseur } from '../entities/fournisseur.entity';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([Fournisseur]), ClientsModule],
  controllers: [FournisseursController],
  providers: [FournisseursService],
})
export class FournisseursModule {}
