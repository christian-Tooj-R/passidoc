import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../entities/client.entity';
import { ConversationIA } from '../entities/conversation-ia.entity';
import { DossierTravail } from '../entities/dossier-travail.entity';
import { FluxMensuel } from '../entities/flux-mensuel.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantTravailService } from './ai-assistant-travail.service';
import { AiAssistantTravailController } from './ai-assistant-travail.controller';
import { ClientsModule } from '../clients/clients.module';
import { SaisieTempsModule } from '../saisie-temps/saisie-temps.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ConversationIA, DossierTravail, FluxMensuel, TenantConfig]),
    ClientsModule,
    SaisieTempsModule,
  ],
  controllers: [AiAssistantController, AiAssistantTravailController],
  providers: [AiAssistantService, AiAssistantTravailService],
})
export class AiAssistantModule {}
