import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DossierMessage } from '../entities/dossier-message.entity';
import { DossierMessagesService } from './dossier-messages.service';
import { DossierMessagesController } from './dossier-messages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DossierMessage])],
  controllers: [DossierMessagesController],
  providers: [DossierMessagesService],
})
export class DossierMessagesModule {}
