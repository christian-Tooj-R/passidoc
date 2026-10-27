import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../entities/client.entity';
import { FluxMensuel } from '../entities/flux-mensuel.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { DossierMessage } from '../entities/dossier-message.entity';
import { User } from '../entities/user.entity';
import { ClientsModule } from '../clients/clients.module';
import { MailModule } from '../mail/mail.module';
import { SuiviPiecesController } from './suivi-pieces.controller';
import { SuiviPiecesService } from './suivi-pieces.service';

/** Suivi des pièces manquantes et relances clients (cahier v2 #1). */
@Module({
  imports: [TypeOrmModule.forFeature([Client, FluxMensuel, TenantConfig, DossierMessage, User]), ClientsModule, MailModule],
  controllers: [SuiviPiecesController],
  providers: [SuiviPiecesService],
})
export class SuiviPiecesModule {}
