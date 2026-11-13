import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutilBp } from '../entities/outil-bp.entity';
import { Exercice } from '../entities/exercice.entity';
import { User } from '../entities/user.entity';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';
import { Canvas } from '../canvas/canvas.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { QuestionnaireAdnGlobal } from '../entities/questionnaire-adn-global.entity';
import { ControleInterne } from '../entities/controle-interne.entity';
import { ObjectifsClient } from '../entities/objectifs-client.entity';
import { SyntheseCloture } from '../entities/synthese-cloture.entity';
import { FluxMensuel } from '../entities/flux-mensuel.entity';
import { Fournisseur } from '../entities/fournisseur.entity';
import { BalanceMensuelle } from '../entities/balance-mensuelle.entity';
import { Mission } from '../entities/mission.entity';
import { Secteur } from '../entities/secteur.entity';
import { ClientsModule } from '../clients/clients.module';
import { BusinessPartnerService } from './business-partner.service';
import { BusinessPartnerController } from './business-partner.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutilBp, Exercice, User, AnalyseStrategique, Canvas, FicheIdentite, QuestionnaireAdnGlobal, ControleInterne,
      ObjectifsClient, SyntheseCloture, FluxMensuel, Fournisseur, BalanceMensuelle, Mission, Secteur,
    ]),
    ClientsModule,
  ],
  providers: [BusinessPartnerService],
  controllers: [BusinessPartnerController],
})
export class BusinessPartnerModule {}
