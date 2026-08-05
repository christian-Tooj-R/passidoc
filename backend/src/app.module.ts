import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { FicheIdentiteModule } from './fiche-identite/fiche-identite.module';
import { FluxMensuelModule } from './flux-mensuel/flux-mensuel.module';
import { FournisseursModule } from './fournisseurs/fournisseurs.module';
import { SyntheseCloureModule } from './synthese-cloture/synthese-cloture.module';
import { DocumentsModule } from './documents/documents.module';
import { ExportModule } from './export/export.module';
import { AnalyseStrategiqueModule } from './analyse-strategique/analyse-strategique.module';
import { MissionsModule } from './missions/missions.module';
import { ObjectifsModule } from './objectifs/objectifs.module';
import { ControleInterneModule } from './controle-interne/controle-interne.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { PappersModule } from './pappers/pappers.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { NotesModule } from './notes/notes.module';
import { QuestionnaireAdnModule } from './questionnaire-adn/questionnaire-adn.module';
import { RolePermissionsModule } from './role-permissions/role-permissions.module';
import { PointageModule } from './pointage/pointage.module';
import { EspacesModule } from './espaces/espaces.module';
import { SalariesModule } from './salaries/salaries.module';
import { ExerciceModule } from './exercice/exercice.module';
import { SecteursModule } from './secteurs/secteurs.module';
import { CongesAbsencesModule } from './conges-absences/conges-absences.module';
import { DossierTravailModule } from './dossier-travail/dossier-travail.module';
import { DossierMessagesModule } from './dossier-messages/dossier-messages.module';
import { HelpModule } from './help/help.module';
import { MailModule } from './mail/mail.module';
import { CanvasModule } from './canvas/canvas.module';
import { SetupModule } from './setup/setup.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { TenantConfig } from './entities/tenant-config.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('DB_TYPE') || 'mysql';
        const common = {
          type: dbType as any,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: config.get<string>('DB_SYNC') === 'true',
          logging: config.get<string>('NODE_ENV') === 'development',
        };
        if (dbType === 'postgres') {
          const useSSL = config.get<string>('NODE_ENV') === 'production';
          return {
            ...common,
            url: config.get<string>('DATABASE_URL'),
            ssl: useSSL ? { rejectUnauthorized: false } : false,
          };
        }
        return {
          ...common,
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    UsersModule,
    ClientsModule,
    FicheIdentiteModule,
    FluxMensuelModule,
    FournisseursModule,
    SyntheseCloureModule,
    DocumentsModule,
    ExportModule,
    AnalyseStrategiqueModule,
    MissionsModule,
    ObjectifsModule,
    ControleInterneModule,
    AiAssistantModule,
    PappersModule,
    TasksModule,
    NotificationsModule,
    StorageModule,
    AuditModule,
    NotesModule,
    QuestionnaireAdnModule,
    RolePermissionsModule,
    PointageModule,
    EspacesModule,
    SalariesModule,
    ExerciceModule,
    SecteursModule,
    CongesAbsencesModule,
    DossierTravailModule,
    DossierMessagesModule,
    HelpModule,
    MailModule,
    CanvasModule,
    SetupModule,
    TenantModule,
    TypeOrmModule.forFeature([TenantConfig]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    TenantMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
