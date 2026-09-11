import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContratTravail } from '../entities/contrat-travail.entity';
import { RubriquePaieRh } from '../entities/rubrique-paie-rh.entity';
import { ConstantePaieRh } from '../entities/constante-paie-rh.entity';
import { VariablePaieRh } from '../entities/variable-paie-rh.entity';
import { BulletinSalarie } from '../entities/bulletin-salarie.entity';
import { CyclePaieRh } from '../entities/cycle-paie-rh.entity';
import { ExerciceRh } from '../entities/exercice-rh.entity';
import { AcompteSalarie } from '../entities/acompte-salarie.entity';
import { User } from '../entities/user.entity';
import { CongeAbsence } from '../entities/conge-absence.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { ValeurActiviteRh } from '../entities/valeur-activite-rh.entity';
import { Pointage } from '../entities/pointage.entity';
import { PausePointage } from '../entities/pause-pointage.entity';
import { CongesAbsencesModule } from '../conges-absences/conges-absences.module';

import { ContratsTravailService } from './contrats-travail.service';
import { RubriquesPaieRhService } from './rubriques-paie-rh.service';
import { ConstantesPaieRhService } from './constantes-paie-rh.service';
import { VariablesPaieRhService } from './variables-paie-rh.service';
import { AcomptesSalarieService } from './acomptes-salarie.service';
import { BulletinsSalarieService } from './bulletins-salarie.service';
import { MoteurCalculPaieRhService } from './moteur-calcul-paie-rh.service';
import { CyclesPaieRhService } from './cycles-paie-rh.service';
import { DeclarationsPaieRhService } from './declarations-paie-rh.service';
import { ComptabilitePaieRhService } from './comptabilite-paie-rh.service';
import { ExercicesRhService } from './exercices-rh.service';
import { ActiviteJourRhService } from './activite-jour-rh.service';

import { ContratsTravailController } from './contrats-travail.controller';
import { RubriquesPaieRhController } from './rubriques-paie-rh.controller';
import { ConstantesPaieRhController } from './constantes-paie-rh.controller';
import { VariablesPaieRhController } from './variables-paie-rh.controller';
import { AcomptesSalarieController } from './acomptes-salarie.controller';
import { BulletinsSalarieController, MesBulletinsController } from './bulletins-salarie.controller';
import { CyclesPaieRhController } from './cycles-paie-rh.controller';
import { DeclarationsPaieRhController } from './declarations-paie-rh.controller';
import { ComptabilitePaieRhController } from './comptabilite-paie-rh.controller';
import { ExercicesRhController } from './exercices-rh.controller';
import { ActiviteJourRhController } from './activite-jour-rh.controller';

/**
 * Module de gestion de paie & RH pour les collaborateurs INTERNES d'AFYM (salariés du
 * cabinet lui-même — entité `User`), inspiré du benchmark Sage 100 Paie & RH.
 *
 * ⚠️ À NE PAS CONFONDRE avec le module `backend/src/paie/` (paie des employés des
 * entreprises CLIENTES d'AFYM, gérée par le cabinet pour le compte du client) — module
 * distinct, non modifié, non touché par celui-ci. Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContratTravail, RubriquePaieRh, ConstantePaieRh, VariablePaieRh,
      BulletinSalarie, CyclePaieRh, ExerciceRh, AcompteSalarie, User, CongeAbsence, TenantConfig,
      ValeurActiviteRh, Pointage, PausePointage,
    ]),
    // Nécessaire pour la génération PDF du bulletin (~Sage) : lecture des soldes de
    // congés (Acquis/Reste/Pris) et des congés pris sur la période — voir
    // BulletinsSalarieService.construirePdf() et Doc/MODULE_PAIE_RH_NOTES.md.
    CongesAbsencesModule,
  ],
  controllers: [
    ContratsTravailController,
    RubriquesPaieRhController,
    ConstantesPaieRhController,
    VariablesPaieRhController,
    AcomptesSalarieController,
    BulletinsSalarieController,
    MesBulletinsController,
    CyclesPaieRhController,
    DeclarationsPaieRhController,
    ComptabilitePaieRhController,
    ExercicesRhController,
    ActiviteJourRhController,
  ],
  providers: [
    ContratsTravailService,
    RubriquesPaieRhService,
    ConstantesPaieRhService,
    VariablesPaieRhService,
    AcomptesSalarieService,
    BulletinsSalarieService,
    MoteurCalculPaieRhService,
    CyclesPaieRhService,
    DeclarationsPaieRhService,
    ComptabilitePaieRhService,
    ExercicesRhService,
    ActiviteJourRhService,
  ],
  exports: [ContratsTravailService, BulletinsSalarieService],
})
export class PaieRhModule {}
