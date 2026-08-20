import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CongesAbsencesService } from './conges-absences.service';
import { CongesAbsencesController } from './conges-absences.controller';
import { CongeAbsence } from '../entities/conge-absence.entity';
import { SoldeConge } from '../entities/solde-conge.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CongeAbsence, SoldeConge, User]),
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret:      cfg.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '72h' },
      }),
    }),
  ],
  controllers: [CongesAbsencesController],
  providers: [CongesAbsencesService],
  exports: [CongesAbsencesService],
})
export class CongesAbsencesModule {}
