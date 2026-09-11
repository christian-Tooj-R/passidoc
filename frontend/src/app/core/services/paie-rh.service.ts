import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Service Angular pour le module Paie & RH INTERNE (collaborateurs AFYM — entité `User`
 * côté backend). Distinct du module Paie clients (`paie-tab`), qui a son propre service.
 * Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */

export type TypeContratTravail = 'CDI' | 'CDD' | 'APPRENTISSAGE' | 'STAGE' | 'INTERIM' | 'AUTRE';
export type StatutContratTravail = 'ACTIF' | 'SUSPENDU' | 'ROMPU';
export type ImputationRubriqueRh = 'COTISATION' | 'PRIME' | 'RETENUE' | 'AVANTAGE' | 'INFORMATION';
export type StatutVariablePaieRh = 'BROUILLON' | 'VALIDEE' | 'BULLETIN_GENERE';
export type StatutAcompteSalarie = 'DEMANDE' | 'VALIDE' | 'DEDUIT' | 'ANNULE';
export type StatutCyclePaieRh = 'OUVERT' | 'CALCULE' | 'VALIDE' | 'CLOTURE';
export type StatutExerciceRh = 'OUVERT' | 'CLOTURE';
export type StatutValeurActiviteRh = 'EN_ATTENTE' | 'CALCULE' | 'MODIFIE_MANUEL';
export type GranulariteActivite = 'hebdomadaire' | 'mensuelle' | 'annuelle';
export type OrigineLignePaieRh = 'MANUELLE' | 'CONGE_ABSENCE' | 'ACOMPTE';

/** Même mapping que `BulletinsSalarieService.DEVISE_LABELS` côté backend (PDF) — à ne
 *  jamais désynchroniser des deux côtés. */
const DEVISE_SYMBOLES: Record<string, string> = { EUR: '€', USD: '$', MGA: 'Ar' };

/** Symbole monétaire d'un salarié (`User.devise`) — jamais "€" par défaut silencieux : si la
 *  devise est absente/inconnue, on retombe sur EUR uniquement parce que c'est la devise par
 *  défaut à la création d'un salarié (voir `DEVISES`/`salaries-detail.component.ts`), pas une
 *  hypothèse arbitraire. */
export function deviseSymbole(devise: string | null | undefined): string {
  return DEVISE_SYMBOLES[devise ?? 'EUR'] ?? (devise || '€');
}

/**
 * Nature "arborescence" (panneau gauche de la liste des rubriques, ~Sage) — dérivée de
 * `ImputationRubriqueRh` côté front (même règle que `deriverNatureRubriqueRh()` côté
 * backend, `backend/src/entities/rubrique-paie-rh.entity.ts`) : jamais stockée en base,
 * pour ne pas avoir deux champs qui peuvent se désynchroniser.
 */
export type NatureRubriqueRh = 'DE_BRUT' | 'DE_COTISATION' | 'NON_SOUMISE';

export function deriverNatureRubriqueRh(imputation: ImputationRubriqueRh): NatureRubriqueRh {
  switch (imputation) {
    case 'COTISATION': return 'DE_COTISATION';
    case 'PRIME':
    case 'AVANTAGE': return 'DE_BRUT';
    default: return 'NON_SOUMISE';
  }
}

export const NATURE_RUBRIQUE_LABELS: Record<NatureRubriqueRh, string> = {
  DE_BRUT: 'De brut',
  DE_COTISATION: 'De cotisation',
  NON_SOUMISE: 'Non soumises',
};

/**
 * Type de calcul d'une rubrique — liste FERMÉE (~Sage, simplifiée — voir
 * Doc/MODULE_PAIE_RH_NOTES.md pour le détail des variantes symétriques volontairement
 * omises : Taux/Base, Nombre/Base, Taux×Nombre/Base).
 */
export type TypeCalculRubriqueRh =
  | 'MONTANT_FIXE' | 'NOMBRE_X_BASE' | 'NOMBRE_X_BASE_X_TAUX' | 'NOMBRE_X_TAUX'
  | 'BASE_X_TAUX' | 'BASE_DIV_NOMBRE' | 'NOMBRE_DIV_TAUX' | 'BASE_DIV_TAUX' | 'TOTALISATION';

export const TYPE_CALCUL_RUBRIQUE_LABELS: Record<TypeCalculRubriqueRh, string> = {
  MONTANT_FIXE: 'Montant pris tel quel',
  NOMBRE_X_BASE: 'Nombre × Base',
  NOMBRE_X_BASE_X_TAUX: 'Nombre × Base × Taux',
  NOMBRE_X_TAUX: 'Nombre × Taux',
  BASE_X_TAUX: 'Base × Taux',
  BASE_DIV_NOMBRE: 'Base / Nombre',
  NOMBRE_DIV_TAUX: 'Nombre / Taux',
  BASE_DIV_TAUX: 'Base / Taux',
  TOTALISATION: 'Totalisation (brut)',
};

/** D'où vient la valeur d'un opérande Nombre/Base/Taux d'une rubrique. */
export type SourceOperandeRubriqueRh = 'VALEUR' | 'CONSTANTE' | 'BRUT' | 'SALAIRE_BASE';

export interface OperandeCalculRubriqueRh {
  source: SourceOperandeRubriqueRh;
  valeur: number | null;
  constanteCode: string | null;
}

export interface ElementCalculPartRubriqueRh {
  nombre: OperandeCalculRubriqueRh;
  base: OperandeCalculRubriqueRh;
  taux: OperandeCalculRubriqueRh;
  reportApresCloture: boolean;
  impressionBulletin: boolean;
  saisieAutorisee: boolean;
}

export function operandeVide(valeur: number | null = null): OperandeCalculRubriqueRh {
  return { source: 'VALEUR', valeur, constanteCode: null };
}

export function elementVide(): ElementCalculPartRubriqueRh {
  return {
    nombre: operandeVide(1),
    base: operandeVide(0),
    taux: operandeVide(0),
    reportApresCloture: false,
    impressionBulletin: true,
    saisieAutorisee: false,
  };
}

/* ── Surcharge ponctuelle par bulletin (onglet "Rubriques" du dialogue "Bulletin du
   salarié") — voir SurchargeRubriquePaieRh côté backend, variable-paie-rh.entity.ts ──── */

export type PartRubriqueRh = 'SALARIALE' | 'PATRONALE';
export type ChampCalculRubriqueRh = 'nombre' | 'base' | 'taux';

export interface SurchargeRubriquePaieRh {
  rubriqueCode: string;
  part: PartRubriqueRh;
  champ: ChampCalculRubriqueRh;
  valeur: number;
}

/* ── Constantes (~Sage "Liste des constantes") ─────────────────────────────────────── */

export type TypeConstantePaieRh = 'VALEUR' | 'CALCUL';
export type ArrondiConstantePaieRh = 'AUCUN' | 'PLUS_PROCHE';
export type OperateurCalculConstante = '+' | '-' | '*' | '/';
export type SourceOperandeConstante = 'CONSTANTE' | 'VALEUR';

export const OPERATEUR_CONSTANTE_LABELS: Record<OperateurCalculConstante, string> = {
  '+': 'Addition (+)', '-': 'Soustraction (−)', '*': 'Multiplication (×)', '/': 'Division (÷)',
};

export interface OperandeConstantePaieRh {
  operateur: OperateurCalculConstante;
  source: SourceOperandeConstante;
  constanteCode: string | null;
  valeur: number | null;
}

export interface ConstantePaieRh {
  id: number;
  code: string;
  libelle: string;
  memo: string | null;
  regimePaieCode: string;
  typeConstante: TypeConstantePaieRh;
  valeur: number | null;
  operandes: OperandeConstantePaieRh[] | null;
  arrondi: ArrondiConstantePaieRh;
  dateEffet: string;
  visible: boolean;
  estPlaceholder: boolean;
  notes: string | null;
}

export interface HistoriqueContratEntry {
  date: string;
  champ: string;
  ancienneValeur: unknown;
  nouvelleValeur: unknown;
  auteurId: number | null;
  motif: string | null;
}

export interface ContratTravail {
  id: number;
  salarieId: number;
  typeContrat: TypeContratTravail;
  dateDebut: string;
  dateFin: string | null;
  statut: StatutContratTravail;
  quotiteTravail: number;
  salaireBase: number;
  regimePaieCode: string;
  motifFin: string | null;
  historique: HistoriqueContratEntry[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface RubriquePaieRh {
  id: number;
  code: string;
  libelle: string;
  memo: string | null;
  regimePaieCode: string;
  dateEffet: string;
  typeCalcul: TypeCalculRubriqueRh;
  elementSalarial: ElementCalculPartRubriqueRh;
  elementPatronal: ElementCalculPartRubriqueRh | null;
  assietteRubriqueCode: string | null;
  reportAssiette: boolean;
  plafondMensuel: number | null;
  imputation: ImputationRubriqueRh;
  ordreAffichage: number;
  isActive: boolean;
  estPlaceholder: boolean;
  compteComptable: string | null;
  notes: string | null;
}

export interface LignePaieLibreRh {
  libelle: string;
  montant: number;
  origine?: OrigineLignePaieRh;
  sourceId?: number;
}

export interface VariablePaieRh {
  id: number;
  salarieId: number;
  mois: number;
  annee: number;
  heuresSupplementaires: number;
  tauxMajorationHeuresSup: number | null;
  primes: LignePaieLibreRh[] | null;
  absences: LignePaieLibreRh[] | null;
  avantagesNature: LignePaieLibreRh[] | null;
  retenuesDiverses: LignePaieLibreRh[] | null;
  surchargesRubriques: SurchargeRubriquePaieRh[] | null;
  commentaire: string | null;
  statut: StatutVariablePaieRh;
}

export interface LigneBulletinRh {
  code: string;
  libelle: string;
  imputation: string;
  /** Nombre résolu — absent des anciens bulletins, ou `null` si sans sens pour ce type de calcul. */
  nombreSalarial?: number | null;
  base: number;
  tauxSalarial: number | null;
  montantSalarial: number;
  nombrePatronal?: number | null;
  tauxPatronal: number | null;
  montantPatronal: number;
  imprimable: boolean;
  typeCalcul?: string;
}

export interface ResultatCalculPaieRh {
  salarieId: number;
  mois: number;
  annee: number;
  salaireBase: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  coutEmployeur: number;
  detailRubriques: LigneBulletinRh[];
  detailBrut: {
    salaireBase: number;
    montantHeuresSupplementaires: number;
    totalPrimesVariables: number;
    totalAvantagesNature: number;
    totalAbsences: number;
  };
}

export interface BulletinSalarie {
  id: number;
  salarieId: number;
  contratTravailId: number | null;
  mois: number;
  annee: number;
  regimePaieCode: string;
  salaireBase: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  coutEmployeur: number;
  detailRubriques: LigneBulletinRh[];
  datePaiement: string | null;
  modePaiement: string | null;
  referencePaiement: string | null;
  version: number;
  estRegularisation: boolean;
  bulletinOrigineId: number | null;
  estPlaceholder: boolean;
  dateGeneration: string;
}

/** Cumul annuel (~Sage "Bulletin calculé", colonne "Cumul") — voir CumulAnnuelPaieRh backend. */
export interface CumulAnnuelPaieRh {
  salarieId: number;
  annee: number;
  moisJusqua: number;
  nbBulletinsInclus: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  coutEmployeur: number;
}

export interface AcompteSalarie {
  id: number;
  salarieId: number;
  periodeMois: number;
  periodeAnnee: number;
  montant: number;
  dateDemande: string;
  dateVersement: string | null;
  statut: StatutAcompteSalarie;
  motif: string | null;
}

export interface CyclePaieRh {
  id: number;
  mois: number;
  annee: number;
  statut: StatutCyclePaieRh;
  nbSalaries: number;
  nbBulletinsGeneres: number;
  totalBrut: number;
  totalNetAPayer: number;
  dateCalcul: string | null;
  dateValidation: string | null;
  dateCloture: string | null;
}

export interface SalarieATraiter {
  salarieId: number;
  salarie?: { id: number; firstName: string; lastName: string; site: string; devise: string | null };
  contratId: number;
  regimePaieCode: string;
  salaireBase: number;
  bulletinId: number | null;
  bulletinStatut: 'GENERE' | 'A_TRAITER';
  netAPayer: number | null;
}

/** Exercice RH annuel de l'entreprise (~"Gestion des exercices" RADIAN) — voir "Période en cours". */
export interface ExerciceRh {
  id: number;
  annee: number;
  dateDebut: string;
  dateFin: string;
  statut: StatutExerciceRh;
  dateOuverture: string | null;
  dateCloture: string | null;
  ouvertParId: number | null;
  clotureParId: number | null;
}

/** Variable du catalogue fixe de "Feuille d'activité" (~RADIAN). */
export interface VariableActiviteRh {
  code: string;
  libelle: string;
  unite: 'bool' | 'h';
}

/** Une ligne de la grille journalière de "Feuille d'activité". */
export interface LigneActiviteJourRh {
  jour: string;
  semaine: number;
  valeur: number;
  statut: StatutValeurActiviteRh | null;
  id: number | null;
}

/** Une ligne agrégée (hebdomadaire/mensuelle/annuelle) de "Feuille d'activité". */
export interface LigneRollupActiviteRh {
  periode: string;
  valeur: number;
}

/** Une ligne de l'écran "Activité" — résumé des variables de paie d'un salarié pour la période. */
export interface ActivitePeriodeRh {
  salarieId: number;
  salarie?: { id: number; firstName: string; lastName: string; site: string; devise: string | null };
  contratId: number;
  variableId: number | null;
  statut: StatutVariablePaieRh | null;
  heuresSupplementaires: number;
  totalPrimes: number;
  totalAbsences: number;
  totalAvantagesNature: number;
  totalRetenues: number;
  nbAbsencesAuto: number;
}

@Injectable({ providedIn: 'root' })
export class PaieRhService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/paie-rh`;

  /* ── Contrats de travail ────────────────────────────────────────────────────── */

  findContratsBySalarie(salarieId: number) {
    return this.http.get<ContratTravail[]>(`${this.base}/contrats`, { params: { salarieId } });
  }

  findContratActif(salarieId: number) {
    return this.http.get<ContratTravail | null>(`${this.base}/contrats/salarie/${salarieId}/actif`);
  }

  createContrat(dto: {
    salarieId: number; typeContrat?: TypeContratTravail; dateDebut: string; dateFin?: string;
    quotiteTravail?: number; salaireBase: number; regimePaieCode?: string; motif?: string;
  }) {
    return this.http.post<ContratTravail>(`${this.base}/contrats`, dto);
  }

  updateContrat(id: number, dto: Partial<ContratTravail> & { motif?: string }) {
    return this.http.patch<ContratTravail>(`${this.base}/contrats/${id}`, dto);
  }

  /* ── Rubriques (paramétrage) ────────────────────────────────────────────────── */

  findRubriques(regime?: string) {
    let params = new HttpParams();
    if (regime) params = params.set('regime', regime);
    return this.http.get<RubriquePaieRh[]>(`${this.base}/rubriques`, { params });
  }

  createRubrique(dto: Partial<RubriquePaieRh>) {
    return this.http.post<RubriquePaieRh>(`${this.base}/rubriques`, dto);
  }

  updateRubrique(id: number, dto: Partial<RubriquePaieRh>) {
    return this.http.patch<RubriquePaieRh>(`${this.base}/rubriques/${id}`, dto);
  }

  removeRubrique(id: number) {
    return this.http.delete<void>(`${this.base}/rubriques/${id}`);
  }

  /* ── Constantes (~Sage "Liste des constantes") ─────────────────────────────────── */

  findConstantes() {
    return this.http.get<ConstantePaieRh[]>(`${this.base}/constantes`);
  }

  createConstante(dto: Partial<ConstantePaieRh>) {
    return this.http.post<ConstantePaieRh>(`${this.base}/constantes`, dto);
  }

  updateConstante(id: number, dto: Partial<ConstantePaieRh>) {
    return this.http.patch<ConstantePaieRh>(`${this.base}/constantes/${id}`, dto);
  }

  removeConstante(id: number) {
    return this.http.delete<void>(`${this.base}/constantes/${id}`);
  }

  /** Prévisualisation de la valeur résolue d'une constante (picker + éditeur CALCUL). */
  resoudreConstante(code: string, regime = 'TOUS') {
    return this.http.get<{ code: string; valeur: number }>(`${this.base}/constantes/resoudre/${code}`, { params: { regime } });
  }


  /* ── Variables mensuelles ───────────────────────────────────────────────────── */

  findVariables(salarieId: number, mois?: number, annee?: number) {
    let params = new HttpParams().set('salarieId', salarieId);
    if (mois) params = params.set('mois', mois);
    if (annee) params = params.set('annee', annee);
    return this.http.get<VariablePaieRh | VariablePaieRh[]>(`${this.base}/variables`, { params });
  }

  upsertVariable(dto: {
    salarieId: number; mois: number; annee: number;
    heuresSupplementaires?: number; tauxMajorationHeuresSup?: number;
    primes?: { libelle: string; montant: number }[];
    absences?: { libelle: string; montant: number }[];
    avantagesNature?: { libelle: string; montant: number }[];
    retenuesDiverses?: { libelle: string; montant: number }[];
    surchargesRubriques?: SurchargeRubriquePaieRh[];
    commentaire?: string; statut?: StatutVariablePaieRh;
  }) {
    return this.http.post<VariablePaieRh>(`${this.base}/variables`, dto);
  }

  synchroniserAbsences(salarieId: number, mois: number, annee: number) {
    return this.http.post<VariablePaieRh>(
      `${this.base}/variables/salarie/${salarieId}/synchroniser-absences`, {}, { params: { mois, annee } },
    );
  }

  synchroniserAcomptes(salarieId: number, mois: number, annee: number) {
    return this.http.post<VariablePaieRh>(
      `${this.base}/variables/salarie/${salarieId}/synchroniser-acomptes`, {}, { params: { mois, annee } },
    );
  }

  /* ── Acomptes ───────────────────────────────────────────────────────────────── */

  findAcomptes(salarieId: number) {
    return this.http.get<AcompteSalarie[]>(`${this.base}/acomptes`, { params: { salarieId } });
  }

  createAcompte(dto: { salarieId: number; periodeMois: number; periodeAnnee: number; montant: number; dateDemande?: string; motif?: string }) {
    return this.http.post<AcompteSalarie>(`${this.base}/acomptes`, dto);
  }

  validerAcompte(id: number) {
    return this.http.patch<AcompteSalarie>(`${this.base}/acomptes/${id}/valider`, {});
  }

  annulerAcompte(id: number) {
    return this.http.patch<AcompteSalarie>(`${this.base}/acomptes/${id}/annuler`, {});
  }

  /* ── Bulletins ──────────────────────────────────────────────────────────────── */

  calculerBulletin(salarieId: number, mois: number, annee: number) {
    return this.http.get<ResultatCalculPaieRh>(`${this.base}/bulletins/calculer`, { params: { salarieId, mois, annee } });
  }

  cumulAnnuel(salarieId: number, mois: number, annee: number) {
    return this.http.get<CumulAnnuelPaieRh>(`${this.base}/bulletins/cumul-annuel`, { params: { salarieId, mois, annee } });
  }

  genererBulletin(salarieId: number, mois: number, annee: number) {
    return this.http.post<BulletinSalarie>(`${this.base}/bulletins/generer`, {}, { params: { salarieId, mois, annee } });
  }

  findBulletinsBySalarie(salarieId: number) {
    return this.http.get<BulletinSalarie[]>(`${this.base}/bulletins`, { params: { salarieId } });
  }

  findBulletinsByPeriode(mois: number, annee: number) {
    return this.http.get<BulletinSalarie[]>(`${this.base}/bulletins`, { params: { mois, annee } });
  }

  telechargerBulletinPdf(id: number) {
    return this.http.get(`${this.base}/bulletins/${id}/pdf`, { responseType: 'blob' });
  }

  /** Aperçu PDF en direct (sans persister) — bouton "Aperçu / Imprimer" du bulletin calculé. */
  apercuPdfBulletin(salarieId: number, mois: number, annee: number) {
    return this.http.get(`${this.base}/bulletins/apercu-pdf`, { params: { salarieId, mois, annee }, responseType: 'blob' });
  }

  enregistrerPaiement(id: number, dto: { datePaiement: string; modePaiement: string; referencePaiement?: string }) {
    return this.http.post<BulletinSalarie>(`${this.base}/bulletins/${id}/paiement`, dto);
  }

  dupliquerBulletin(id: number) {
    return this.http.post<BulletinSalarie>(`${this.base}/bulletins/${id}/dupliquer`, {});
  }

  genererRegularisation(id: number) {
    return this.http.post<BulletinSalarie>(`${this.base}/bulletins/${id}/regularisation`, {});
  }

  /* ── Portail salarié ────────────────────────────────────────────────────────── */

  mesBulletins() {
    return this.http.get<BulletinSalarie[]>(`${this.base}/mes-bulletins`);
  }

  telechargerMonBulletinPdf(id: number) {
    return this.http.get(`${this.base}/mes-bulletins/${id}/pdf`, { responseType: 'blob' });
  }

  /* ── Cycle mensuel ──────────────────────────────────────────────────────────── */

  findCycles() {
    return this.http.get<CyclePaieRh[]>(`${this.base}/cycles`);
  }

  ouvrirCycle(mois: number, annee: number) {
    return this.http.post<CyclePaieRh>(`${this.base}/cycles/ouvrir`, {}, { params: { mois, annee } });
  }

  findCycle(mois: number, annee: number) {
    return this.http.get<CyclePaieRh>(`${this.base}/cycles/${mois}/${annee}`);
  }

  listerSalariesATraiter(mois: number, annee: number) {
    return this.http.get<SalarieATraiter[]>(`${this.base}/cycles/${mois}/${annee}/salaries`);
  }

  /** `forcer` régénère aussi les bulletins déjà générés (non payés) du mois. */
  calculerCycle(mois: number, annee: number, forcer = false) {
    return this.http.post<{ generes: number; erreurs: { salarieId: number; message: string }[] }>(
      `${this.base}/cycles/${mois}/${annee}/calculer`, {}, { params: { forcer: String(forcer) } },
    );
  }

  validerCycle(mois: number, annee: number) {
    return this.http.post<CyclePaieRh>(`${this.base}/cycles/${mois}/${annee}/valider`, {});
  }

  cloturerCycle(mois: number, annee: number) {
    return this.http.post<CyclePaieRh>(`${this.base}/cycles/${mois}/${annee}/cloturer`, {});
  }

  /* ── Exercices RH (~"Gestion des exercices" RADIAN) ────────────────────────────── */

  findExercices() {
    return this.http.get<ExerciceRh[]>(`${this.base}/exercices`);
  }

  findExerciceOuvert() {
    return this.http.get<ExerciceRh | null>(`${this.base}/exercices/ouvert`);
  }

  creerExercice(annee: number) {
    return this.http.post<ExerciceRh>(`${this.base}/exercices`, { annee });
  }

  cloturerExercice(id: number) {
    return this.http.post<ExerciceRh>(`${this.base}/exercices/${id}/cloturer`, {});
  }

  /* ── Activité (~"Feuille d'activité" RADIAN) ───────────────────────────────────── */

  findActivitePeriode(mois: number, annee: number) {
    return this.http.get<ActivitePeriodeRh[]>(`${this.base}/variables/activite`, { params: { mois, annee } });
  }

  recalculerActivitePeriode(mois: number, annee: number) {
    return this.http.post<{ traites: number; erreurs: { salarieId: number; message: string }[] }>(
      `${this.base}/variables/activite/recalculer`, {}, { params: { mois, annee } },
    );
  }

  /* ── Feuille d'activité journalière (~"Consultation feuille d'activité" RADIAN) ────── */

  findCatalogueActivite() {
    return this.http.get<VariableActiviteRh[]>(`${this.base}/activite-jour/catalogue`);
  }

  findGrilleActiviteJour(salarieId: number, variableCode: string, mois: number, annee: number) {
    return this.http.get<LigneActiviteJourRh[]>(
      `${this.base}/activite-jour/salarie/${salarieId}/grille`, { params: { variableCode, mois, annee } },
    );
  }

  findRollupActivite(salarieId: number, variableCode: string, granularite: GranulariteActivite, mois: number, annee: number) {
    return this.http.get<LigneRollupActiviteRh[]>(
      `${this.base}/activite-jour/salarie/${salarieId}/rollup`, { params: { variableCode, granularite, mois, annee } },
    );
  }

  initialiserActiviteJour(mois: number, annee: number, salarieId?: number) {
    let params: any = { mois, annee };
    if (salarieId) params = { ...params, salarieId };
    return this.http.post<{ creees: number }>(`${this.base}/activite-jour/initialiser`, {}, { params });
  }

  calculerActiviteJour(mois: number, annee: number, salarieId?: number, recalculerModifs = false) {
    let params: any = { mois, annee, recalculerModifs: String(recalculerModifs) };
    if (salarieId) params = { ...params, salarieId };
    return this.http.post<{ calculees: number }>(`${this.base}/activite-jour/calculer`, {}, { params });
  }

  modifierValeurActiviteJour(id: number, valeur: number) {
    return this.http.patch<LigneActiviteJourRh>(`${this.base}/activite-jour/${id}`, { valeur });
  }

}

export const STATUT_CYCLE_LABELS: Record<StatutCyclePaieRh, string> = {
  OUVERT: 'Ouvert', CALCULE: 'Calculé', VALIDE: 'Validé', CLOTURE: 'Clôturé',
};

export const TYPE_CONTRAT_LABELS: Record<TypeContratTravail, string> = {
  CDI: 'CDI', CDD: 'CDD', APPRENTISSAGE: 'Apprentissage', STAGE: 'Stage', INTERIM: 'Intérim', AUTRE: 'Autre',
};

export const IMPUTATION_RUBRIQUE_LABELS: Record<ImputationRubriqueRh, string> = {
  COTISATION: 'Cotisation', PRIME: 'Prime', RETENUE: 'Retenue', AVANTAGE: 'Avantage', INFORMATION: 'Information',
};
