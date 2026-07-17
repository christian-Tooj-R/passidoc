import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../entities/client.entity';
import { ConversationIA } from '../entities/conversation-ia.entity';
import { DossierTravail } from '../entities/dossier-travail.entity';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Client, ConversationIA, DossierTravail])],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
