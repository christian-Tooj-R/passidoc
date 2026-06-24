import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Client } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { User } from '../entities/user.entity';
import { Exercice } from '../entities/exercice.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Client, FicheIdentite, User, Exercice]), MulterModule.register({}), NotificationsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
