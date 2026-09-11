import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeClient } from '../entities/employe-client.entity';
import { RubriquePaie } from '../entities/rubrique-paie.entity';
import { ParametrePaie } from '../entities/parametre-paie.entity';
import { VariablePaie } from '../entities/variable-paie.entity';
import { BulletinPaie } from '../entities/bulletin-paie.entity';
import { Client } from '../entities/client.entity';

import { EmployesClientsService } from './employes-clients.service';
import { RubriquesPaieService } from './rubriques-paie.service';
import { ParametresPaieService } from './parametres-paie.service';
import { VariablesPaieService } from './variables-paie.service';
import { BulletinsPaieService } from './bulletins-paie.service';
import { MoteurCalculPaieService } from './moteur-calcul-paie.service';

import { EmployesClientsController } from './employes-clients.controller';
import { RubriquesPaieController } from './rubriques-paie.controller';
import { ParametresPaieController } from './parametres-paie.controller';
import { VariablesPaieController } from './variables-paie.controller';
import { BulletinsPaieController } from './bulletins-paie.controller';

/**
 * Module de gestion de paie pour les EMPLOYÉS DES CLIENTS d'AFYM (paie externalisée
 * gérée par le cabinet — cf. `FicheIdentite.cycleChargesPaie.gestionPaie`).
 *
 * À ne pas confondre avec le module RH interne (`salaries`, `conges-absences`) qui gère
 * les collaborateurs AFYM. Voir Doc/MODULE_PAIE_NOTES.md pour les hypothèses de calcul.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeClient, RubriquePaie, ParametrePaie, VariablePaie, BulletinPaie, Client]),
  ],
  controllers: [
    EmployesClientsController,
    RubriquesPaieController,
    ParametresPaieController,
    VariablesPaieController,
    BulletinsPaieController,
  ],
  providers: [
    EmployesClientsService,
    RubriquesPaieService,
    ParametresPaieService,
    VariablesPaieService,
    BulletinsPaieService,
    MoteurCalculPaieService,
  ],
  exports: [EmployesClientsService, BulletinsPaieService],
})
export class PaieModule {}
