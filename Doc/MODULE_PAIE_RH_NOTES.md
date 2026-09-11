# Module Paie & RH interne — Collaborateurs AFYM

## Objet et périmètre

Ce module ajoute la gestion de la paie pour les **collaborateurs INTERNES d'AFYM**
(les salariés du cabinet lui-même — Réunion et Madagascar), inspiré du benchmark
Sage 100 Paie & RH (voir `Cahier_des_charges_Module_Paie_RH_Benchmark_Sage.docx`, 38
sections). Il va de la création du contrat de travail jusqu'à la génération d'un
bulletin de salaire PDF, en passant par les rubriques/paramètres de paie, le cycle
mensuel, les acomptes, l'intégration avec le circuit congés/absences existant, et des
écrans V1 best-effort (récapitulatif de déclarations, export comptable simple, portail
salarié).

**⚠️ À ne pas confondre avec le module Paie clients** (`backend/src/paie/`,
`employe-client.entity.ts`, `rubrique-paie.entity.ts`, `parametre-paie.entity.ts`,
`variable-paie.entity.ts`, `bulletin-paie.entity.ts`, `frontend/.../paie-tab/`,
`Doc/MODULE_PAIE_NOTES.md`), qui gère la paie EXTERNALISÉE des employés des entreprises
**clientes** d'AFYM. Ce module-là existe (au moment de la rédaction, en cours de
construction en parallèle par un autre agent, non commité) et n'a été ni modifié ni
touché — seulement consulté en lecture seule pour s'inspirer du style d'entités/services
(architecture moteur de calcul, génération PDF via `pdfmake`).

## ⚠️ Correction importante par rapport au brief initial de cette tâche

Le brief de cette tâche indiquait que `backend/src/entities/salarie.entity.ts` et
`backend/src/salaries/` représentaient **« le salarié AFYM lui-même »**. Après
vérification directe du code, **c'est inexact** :

- `Salarie` (table `salaries_dossier`, module `backend/src/salaries/`, route
  `clients/:clientId/salaries`) est un **dossier KYC d'un employé d'un CLIENT** d'AFYM
  (rattaché à `Client` via `clientId`), sans aucun lien avec les collaborateurs internes
  ni avec le circuit congés/absences.
- Le véritable salarié AFYM interne est l'entité **`User`**
  (`backend/src/entities/user.entity.ts`), qui porte déjà `site` (enum `UserSite` :
  `REUNION`/`MADAGASCAR`), `salaireBase`, `typeContrat`, `matricule`, `banque`, `iban`,
  `devise`, `modePaiement`, etc. C'est aussi cette entité qu'utilisent déjà
  `backend/src/conges-absences/` (`CongeAbsence.userId`, `SoldeConge.userId`) et le
  frontend `frontend/src/app/features/salaries/` (qui consomme l'endpoint
  `GET /users/salaries`, pas `Salarie`).

Toutes les nouvelles entités de ce module référencent donc **`User`** (colonne
`salarieId`, choisie pour rester lisible malgré la contrainte de vocabulaire du brief),
et non `Salarie`.

## Aucune source officielle pour les barèmes réels

Comme le rappelle le CDC Sage lui-même (section 12, "Profil Madagascar — socle à
prévoir") : les cotisations sociales sont **juridictionnelles** — CNaPS/OSTIE/FMFP pour
Madagascar, URSSAF/DSN pour la France — et aucun taux réel n'a été trouvé dans le
dossier du projet (`CDC AFYM - MEMOIRE ARO.pdf` ne mentionne aucun module de paie
interne ; `TACHES_V2.md` liste seulement TACHE-11 "RH — Variables de paie" comme
**en attente de décision de la direction (Alvin)**, avec deux options bien plus légères
qu'un moteur de paie complet : export CSV/Excel des absences pour un prestataire
externe, ou rapport mensuel formaté. **Cette tâche construit néanmoins le moteur complet
demandé explicitement par le briefing reçu** — mais ce point mérite d'être signalé à la
direction : le besoin réel de paie interne pourrait être beaucoup plus simple que ce
qui a été livré ici.

Toutes les valeurs numériques insérées automatiquement (taux de cotisations, plafond
sécu, diviseur horaire mensuel, taux de majoration heures sup, **taux de maintien de
salaire par type d'absence**) sont des **valeurs d'exemple (placeholders)**, marquées
`estPlaceholder: true` en base, avec avertissement visible dans l'UI et dans le PDF
généré. **Elles doivent être validées par un expert paie / la direction avant toute mise
en production réelle**, séparément pour un profil Réunion et un profil Madagascar (aucun
taux Madagascar distinct n'a été inséré — les collaborateurs Madagascar utilisent
aujourd'hui les mêmes rubriques `TOUS` que la Réunion, ce qui est presque certainement
incorrect et doit être corrigé une fois les taux CNaPS/OSTIE/FMFP connus).

## Principe d'architecture : rien n'est codé en dur

Le moteur de calcul (`backend/src/paie-rh/moteur-calcul-paie-rh.service.ts`) ne contient
**aucune règle conditionnelle "if site === REUNION"**. Tout passe par deux tables de
paramétrage, sélectionnées via un champ `regimePaieCode` (string libre, initialisé
depuis `user.site` — `REUNION`/`MADAGASCAR` — mais éditable/étendable à tout autre code,
au niveau du **contrat de travail**, pas de l'utilisateur) :

- **`RubriquePaieRh`** (`paie_rh_rubriques`) : lignes de bulletin paramétrables (code,
  libellé, base de calcul BRUT/SALAIRE_BASE/FIXE, taux salarial/patronal ou montant
  fixe, plafond optionnel, imputation COTISATION/PRIME/RETENUE/AVANTAGE/INFORMATION,
  ordre d'affichage, compte comptable informatif). Éditable depuis l'API
  `paie-rh/rubriques` (réservé ADMIN/EXPERT_COMPTABLE).
- **`ParametrePaieRh`** (`paie_rh_parametres`) : constantes scalaires utilisées par le
  moteur (durée légale mensuelle, taux de majoration HS par défaut, plafond sécu
  indicatif, **jours ouvrés/mois**, **taux de maintien de salaire par type de congé**
  `MAINTIEN_<TYPE_CONGE>`). Éditable depuis `paie-rh/parametres`.

Un tenant qui n'a encore aucune ligne dans ces deux tables se voit générer
automatiquement un jeu d'exemple au premier accès (`estPlaceholder: true`), uniquement
pour rendre le parcours démontrable de bout en bout sans configuration préalable. Dès
qu'au moins une ligne existe, l'auto-seed ne se redéclenche plus (identique au
fonctionnement du module Paie clients).

## Modèle de données

- **`ContratTravail`** (`paie_rh_contrats`) : contrat de travail d'un `User` (type,
  dates, statut ACTIF/SUSPENDU/ROMPU, quotité de travail %, salaire de base mensuel
  brut, `regimePaieCode`). Historisation MVP1 simplifiée : les changements de champs
  sensibles (salaire, quotité, type de contrat, régime, statut, date de fin) sont
  journalisés dans un champ JSON `historique` (ancienne/nouvelle valeur, auteur, date,
  motif) à chaque modification, plutôt qu'une vraie ligne d'avenant versionnée — voir
  "Limitations connues" ci-dessous. Un seul contrat ACTIF à la fois par salarié (le
  précédent est marqué ROMPU quand un nouveau est créé).
- **`RubriquePaieRh`** / **`ParametrePaieRh`** : paramétrage (voir ci-dessus).
- **`VariablePaieRh`** (`paie_rh_variables`, unique par salarié/mois/année) : variables
  saisies pour le mois (heures sup + taux de majoration éventuellement surchargé,
  primes, absences, avantages en nature, retenues diverses — chacune une liste libre
  `{ libelle, montant, origine?, sourceId? }`). Le champ `origine` (`MANUELLE` /
  `CONGE_ABSENCE` / `ACOMPTE`) distingue les lignes saisies à la main de celles
  synchronisées automatiquement.
- **`AcompteSalarie`** (`paie_rh_acomptes`) : acompte (avance sur salaire) demandé pour
  un salarié, sur une période de déduction (`periodeMois`/`periodeAnnee`), statut
  DEMANDE → VALIDE → DEDUIT (ou ANNULE).
- **`BulletinSalarie`** (`paie_rh_bulletins`) : **snapshot figé** du calcul au moment de
  la génération (`detailRubriques` en JSON). Si les rubriques/paramètres sont modifiés
  ensuite, les bulletins déjà générés ne changent pas rétroactivement (traçabilité).
  Porte aussi `datePaiement`/`modePaiement`/`referencePaiement` (informatif, PAS
  d'intégration bancaire réelle), et `version`/`estRegularisation`/`bulletinOrigineId`
  pour un duplicata ou un correctif sans écraser l'original.
- **`CyclePaieRh`** (`paie_rh_cycles`, unique par mois/année/tenant) : cycle mensuel,
  statuts simplifiés OUVERT → CALCULE → VALIDE → CLOTURE (CLOTURE verrouille la
  période — immutabilité).

## Moteur de calcul (`backend/src/paie-rh/moteur-calcul-paie-rh.service.ts`)

Architecture calquée sur `backend/src/paie/moteur-calcul-paie.service.ts` (module paie
clients) pour rester cohérente et testable de la même façon :

1. `salaireBase` = `ContratTravail.salaireBase` tel quel (pas de recalcul automatique
   proportionnel à la quotité de travail — champ informatif en v1, comme pour
   `EmployeClient.quotiteTravail`).
2. `montantHeuresSupplementaires` = `(salaireBase / heuresLegalesMois) × (1 +
   tauxMajorationHS / 100) × heuresSupplementaires`.
3. `totalBrut` = `salaireBase − absences + heuresSup + primes(variables) +
   avantagesNature`.
4. Chaque `RubriquePaieRh` active pour le régime du contrat calcule une base (BRUT,
   SALAIRE_BASE ou FIXE, plafonnée si `plafondMensuel` renseigné), puis
   `montantSalarial`/`montantPatronal` (taux % ou montant fixe).
5. `totalCotisationsSalariales` / `totalCotisationsPatronales` = somme des lignes
   `imputation = COTISATION`.
6. `netImposable` = `totalBrut − totalCotisationsSalariales`.
7. `netAPayer` = `netImposable − avantagesNature − retenuesDiverses(saisies) −
   retenues(rubriques) + primes/avantages(rubriques)`.
8. `coutEmployeur` = `totalBrut + totalCotisationsPatronales` (nouveau par rapport au
   module paie clients — demandé explicitement par le CDC §9.1).

### Intégration congés/absences (MVP2, `VariablesPaieRhService.synchroniserAbsences`)

Avant tout calcul/génération de bulletin, le service recharge automatiquement les
`CongeAbsence` **APPROUVEE** du salarié qui chevauchent le mois demandé, et les convertit
en lignes `absences` d'origine `CONGE_ABSENCE` :

```
salaireJournalier = ContratTravail.salaireBase / JOURS_OUVRES_MOIS_DEFAUT (placeholder: 22)
montant = salaireJournalier × nombreJours × (1 − tauxMaintien / 100)
```

où `tauxMaintien` vient de `ParametrePaieRh.code = MAINTIEN_<TYPE_CONGE>` (regimeCode du
contrat, avec repli sur `TOUS`). Les lignes `CONGE_ABSENCE` sont **entièrement
régénérées** à chaque appel (idempotent) ; les lignes saisies manuellement sont
préservées. **Vérifié par test réel** (voir section Tests) : un congé MALADIE de 5 jours
avec `MAINTIEN_MALADIE = 90` (placeholder) sur un salaire de 2000€/22 jours ouvrés a
produit une déduction de 45,45€, cohérente avec la formule.

### Acomptes (MVP2, `VariablesPaieRhService.synchroniserAcomptes`)

Les acomptes `VALIDE` **et** `DEDUIT` de la période sont injectés comme lignes
`retenuesDiverses` d'origine `ACOMPTE`. Le statut `DEDUIT` est aussi inclus (pas
seulement `VALIDE`) pour qu'un recalcul ultérieur de la même période (ex: une
régularisation) continue de refléter l'acompte déjà déduit — **bug réel trouvé et
corrigé pendant le test end-to-end** (voir section Tests) : sans cela, régénérer un
bulletin déjà payé faisait disparaître silencieusement la retenue d'acompte du calcul.
Seul un acompte `ANNULE` n'impacte plus la paie. Le passage `VALIDE → DEDUIT` se fait
uniquement à la génération effective du bulletin (`BulletinsSalarieService.generer`),
pas lors d'un simple aperçu.

## Cycle mensuel (`backend/src/paie-rh/cycles-paie-rh.service.ts`)

`ouvrir(mois, annee)` → `listerSalariesATraiter` (tous les contrats ACTIF, avec statut
de leur bulletin) → `calculerTout` (génère en masse les bulletins manquants, agrège les
totaux) → `valider` (bloque si tous les salariés n'ont pas de bulletin) → `cloturer`
(verrouille — toute tentative de régénérer un bulletin sur une période clôturée est
refusée avec un message explicite). **Vérifié par test réel** de bout en bout : ouverture
→ liste → calcul → validation → clôture → tentative de régénération refusée (HTTP 400).

⚠️ **Limitation connue** : la vérification d'immutabilité au niveau du **contrat**
(`ContratsTravailService.assertPeriodeModifiable`) est un filet de sécurité best-effort
(elle ne bloque que la modification d'un contrat ROMPU antérieur à la dernière période
clôturée), pas une garantie exhaustive sur tous les chemins de mutation possibles — à
renforcer si ce module doit vraiment aller en production.

## MVP1 — livré

- Contrat de travail par salarié (`ContratTravail`), rattaché à `User`.
- Rubriques de paie paramétrables, rattachées à un régime (pôle/pays) via
  `regimePaieCode` — aucune règle Réunion/Madagascar codée en dur.
- Moteur de calcul : brut, cotisations salariales/patronales, net imposable, net à
  payer, coût employeur.
- Génération du bulletin de paie en PDF via `pdfmake` (déjà présent en dépendance
  backend, utilisé par `backend/src/export/export.service.ts` — aucune nouvelle
  dépendance ajoutée), avec numéro de bulletin, mentions employeur/salarié, détail des
  rubriques, cumuls, net à payer, avertissement placeholder, mention légale générique.
- Cycle mensuel : liste des salariés à traiter, statuts OUVERT/CALCULE/VALIDE/CLOTURE.

## MVP2 — livré

- Intégration réelle avec `CongeAbsence` (statut APPROUVEE) : synchronisation
  automatique des absences validées en variable de paie, avec maintien de salaire
  paramétrable par type de congé.
- Variables de paie manuelles complémentaires (primes, heures sup, retenues diverses,
  avantages en nature) — API `paie-rh/variables`.
- Acomptes : demande, validation, déduction automatique du bulletin du mois concerné.
- Enregistrement du paiement (date, mode VIREMENT/ESPECES/CHEQUE, référence) — donnée
  **purement informative**, aucune intégration bancaire/SEPA réelle.
- Export CSV des écritures comptables agrégées (voir V1 ci-dessous — au final livré
  ensemble avec le reste des écrans V1 par manque de découpage utile entre les deux).

## V1 — livré en best-effort (pas bâclé, mais moins profond que MVP1/MVP2)

- **Déclarations** (`DeclarationsPaieRhService.recapPeriode`) : récapitulatif agrégé par
  rubrique pour une période (base, part salariale, part patronale). **Ne génère AUCUN
  fichier de déclaration officiel** (pas de DSN, pas de format CNaPS/OSTIE/FMFP/IRSA réel)
  — avertissement explicite affiché dans l'UI et dans la réponse API.
- **Comptabilité** (`ComptabilitePaieRhService.exportEcrituresCsv`) : export CSV simple
  des montants agrégés par rubrique, avec un compte comptable "A_DEFINIR" tant que
  `RubriquePaieRh.compteComptable` n'a pas été renseigné. Pas d'intégration comptable
  réelle (pas de format d'import standard, pas de connecteur logiciel).
- **Portail salarié** : `GET /paie-rh/mes-bulletins` et `GET
  /paie-rh/mes-bulletins/:id/pdf` — un collaborateur connecté (JWT, sans restriction de
  rôle) ne peut consulter/télécharger que **ses propres** bulletins (vérifié par test
  réel : un autre utilisateur reçoit un 404 en tentant d'accéder au bulletin d'un
  collègue). Aucun espace personnel dédié n'existait déjà dans le repo — nouvelle page
  `frontend/src/app/features/paie-rh/mes-bulletins.component.ts`, routée en `/rh/mes-bulletins`.
- **Duplicata** (BUL-007) et **régularisation** (BUL-008) : endpoints fonctionnels
  (`POST /paie-rh/bulletins/:id/dupliquer` et `/regularisation`), qui créent un nouveau
  bulletin sans écraser l'original. La régularisation recalcule intégralement le mois
  demandé (pas de delta ligne à ligne automatique) — à comparer manuellement à
  l'original si besoin d'un delta précis.
- **Gestion documentaire** : les bulletins/contrats d'un salarié sont listables/
  téléchargeables directement depuis l'onglet "Contrat & Paie" de sa fiche (pas de coffre
  documentaire séparé ; les PDF sont générés à la demande, pas stockés dans
  `StorageModule`/MinIO — cohérent avec l'approche du module paie clients qui ne
  persiste pas non plus les PDF générés).

## Emplacement dans l'interface

Après exploration de l'existant :

- `/rh/salaries/:id` → nouvel onglet **"Contrat & Paie"** sur la fiche salarié
  (`frontend/src/app/features/salaries/salaries-detail.component.ts`), distinct du
  sous-onglet "Paie" déjà existant sous "Fiche salarié" (qui n'affichait que les champs
  bruts de `User` en lecture seule — non modifié). Choix : un onglet de **premier
  niveau** plutôt qu'un sous-onglet, car le module Paie RH est un espace de travail
  complet (contrat + bulletins + acomptes), pas juste un champ de plus.
- `/rh/paie` → nouveau **hub d'administration** (`paie-rh-hub.component.ts`) : cycle
  mensuel, rubriques, paramètres, déclarations (V1), comptabilité (V1). Ajouté comme
  nouvel item du menu de navigation `/rh` (`rh.component.ts`), au même niveau que
  "Collaborateurs"/"Congés & Absences"/"Agenda" — cohérent avec la structure existante
  (shell RH avec sidebar + `router-outlet`, pas de nouvel item dans la sidebar
  principale de l'application puisque `/rh` est déjà une route plein écran séparée).
- `/rh/mes-bulletins` → portail salarié en libre-service, même niveau de navigation.

## Ce qui reste à valider avec la direction / un expert paie

1. **Le périmètre réel du besoin** (voir "Correction importante" ci-dessus) : TACHE-11
   de `TACHES_V2.md` indique une décision de la direction (Alvin) **encore en attente**,
   avec deux options bien plus légères qu'un moteur de paie complet (export CSV, ou
   rapport formaté). Ce module va au-delà de ces deux options — à valider que c'est
   bien ce qui est souhaité avant tout usage réel.
2. Les taux réels de cotisations sociales Réunion (régime général / DSN) — actuellement
   des placeholders génériques de type « régime français métropolitain » (mêmes valeurs
   que le module paie clients, par cohérence).
3. Les taux réels de cotisations sociales Madagascar (CNaPS, OSTIE, FMFP) — **aucune
   valeur n'a été insérée pour un régime `MADAGASCAR` distinct** ; les collaborateurs
   Madagascar utilisent aujourd'hui les mêmes rubriques `TOUS` que la Réunion.
4. Les taux de **maintien de salaire par type d'absence** (`MAINTIEN_CONGES_PAYES`,
   `MAINTIEN_MALADIE`, etc.) — valeurs de départ arbitraires (100% par défaut, 90% pour
   maladie, 0% pour sans solde), à valider juridiquement.
5. Le nombre de jours ouvrés/mois utilisé pour valoriser une journée d'absence
   (`JOURS_OUVRES_MOIS_DEFAUT = 22`, placeholder).
6. Le circuit de validation des variables de paie et des cycles (qui saisit, qui valide,
   avant génération/clôture) — modélisé uniquement via des rôles (ADMIN/
   EXPERT_COMPTABLE/CHEF_ANTENNE/CHEF_MISSION), sans workflow d'approbation à plusieurs
   niveaux.
7. Les mentions légales exactes à faire figurer sur un bulletin de salaire réel (mention
   générique de conservation présente dans le PDF, à faire valider par un juriste/expert
   paie).
8. La robustesse de l'immutabilité de contrat après clôture (voir "Limitation connue"
   ci-dessus, section Cycle mensuel).
9. L'historisation des contrats (JSON `historique` sur la même ligne plutôt que des
   avenants versionnés séparés) — suffisant pour une v1 mais pas aussi rigoureux que ce
   que demande le CDC Sage en toute rigueur (§6.2/§7).

## Choix techniques

- **PDF** : génération via `pdfmake`, déjà présent en dépendance backend — même
  bibliothèque et même style de `docDefinition` que le module Paie clients, aucune
  nouvelle dépendance ajoutée.
- **CSV** : génération manuelle avec BOM UTF-8 (`﻿`) et séparateur `;`, cohérente
  avec le seul autre export CSV du repo (`pointage.component.ts`, frontend) — aucune
  bibliothèque CSV ajoutée côté backend (aucune n'existait déjà).
- **Multi-tenant** : toutes les nouvelles entités portent un champ `tenantId` filtré
  explicitement dans chaque requête de service, à l'identique du reste du code
  (`CongeAbsence`, `RubriquePaie`, etc.).
- **Guards** : `JwtAuthGuard` + `RolesGuard` sur tous les contrôleurs administratifs ;
  les mutations sensibles (rubriques, paramètres, contrats, génération de bulletin,
  clôture de cycle) sont réservées aux rôles ADMIN/EXPERT_COMPTABLE (+ CHEF_ANTENNE/
  CHEF_MISSION pour les opérations courantes), à l'identique du pattern du module paie
  clients. Le portail salarié (`/paie-rh/mes-bulletins`) n'a que `JwtAuthGuard` (tout
  utilisateur authentifié peut voir SES PROPRES bulletins) — **vérifié par test réel**
  (403 pour un COLLABORATEUR tentant de créer une rubrique ; 404 pour un salarié tentant
  d'accéder au bulletin d'un collègue).
- **TypeORM / colonnes nullable** : un bug réel a été rencontré et corrigé pendant le
  développement — TypeScript émet `Object` comme métadonnée de type pour toute colonne
  déclarée `champ: string | null` (ou `number | null`) **sans** `type:` explicite dans
  le décorateur `@Column`, ce que TypeORM refuse ("Data type Object... not supported").
  Toutes les colonnes nullable de ce module précisent donc explicitement leur `type`
  (`varchar`, `int`, `text`, `date`, `timestamp`...).

## Fichiers créés

Backend :
- `backend/src/entities/contrat-travail.entity.ts`
- `backend/src/entities/rubrique-paie-rh.entity.ts`
- `backend/src/entities/parametre-paie-rh.entity.ts`
- `backend/src/entities/variable-paie-rh.entity.ts`
- `backend/src/entities/bulletin-salarie.entity.ts`
- `backend/src/entities/cycle-paie-rh.entity.ts`
- `backend/src/entities/acompte-salarie.entity.ts`
- `backend/src/paie-rh/` (module complet : `paie-rh.module.ts`, 10 controllers, 9
  services incluant le moteur de calcul, `dto/`)
- `backend/src/app.module.ts` (modifié : enregistrement de `PaieRhModule`)

Frontend :
- `frontend/src/app/core/services/paie-rh.service.ts`
- `frontend/src/app/features/paie-rh/paie-rh-salarie-tab.component.ts` (onglet fiche
  salarié)
- `frontend/src/app/features/paie-rh/paie-rh-hub.component.ts` (hub admin `/rh/paie`)
- `frontend/src/app/features/paie-rh/mes-bulletins.component.ts` (portail salarié
  `/rh/mes-bulletins`)
- `frontend/src/app/features/salaries/salaries-detail.component.ts` (modifié : nouvel
  onglet "Contrat & Paie")
- `frontend/src/app/features/rh/rh.component.ts` (modifié : deux nouvelles entrées de
  navigation)
- `frontend/src/app/app.routes.ts` (modifié : routes `/rh/paie` et `/rh/mes-bulletins`)
- `frontend/e2e/paie-rh-module.spec.ts` (test e2e Playwright — voir "Tests" ci-dessous
  pour ce qui a réellement été exécuté)

Documentation :
- `Doc/MODULE_PAIE_RH_NOTES.md` (ce fichier)

## Tests — état réel, sans rien inventer

### Ce qui a été réellement exécuté et observé

Un environnement de test **isolé** a été monté spécifiquement pour cette vérification,
pour ne surtout pas interférer avec la session de développement déjà active de
l'utilisateur (backend réel tournant sur le port 3000, frontend sur le port 4200,
PostgreSQL partagé sur le port 5432 — tous laissés totalement intacts) :

- Conteneur PostgreSQL isolé dédié (port 5433, base `paie_rh_test`), backend démarré en
  local sur le port 3001 avec `DB_SYNC=true` contre cette base isolée.
- `npx tsc --noEmit` (backend) : **0 erreur** liée à ce module (quelques erreurs
  préexistantes non liées, dans des fichiers `*.spec.ts` et `app.e2e-spec.ts` déjà
  cassés avant cette tâche, non touchés).
- `npx nest build` : **succès**.
- `npx tsc --noEmit` (frontend, `tsconfig.json` et implicitement via `ng build`) :
  **0 erreur**.
- `npx ng build --configuration=production` (frontend) : **succès** (avertissements
  `NG8xxx` préexistants dans d'autres fichiers non liés à ce module, non introduits par
  cette tâche).
- **Parcours API réel de bout en bout** (via `curl`, contre le backend + PostgreSQL
  isolés décrits ci-dessus, avec un vrai tenant/admin créés via `/setup`) :
  1. Création d'un contrat de travail → `regimePaieCode` correctement hérité de
     `user.site`.
  2. Auto-seed des rubriques/paramètres placeholder au premier accès.
  3. Calcul d'aperçu et génération de bulletin (salaire 2000€ brut) →
     `totalCotisationsSalariales = 420`, `netAPayer = netImposable = 1580`,
     `coutEmployeur = 2486.40` — **arithmétique vérifiée manuellement, cohérente**.
  4. Téléchargement du PDF généré → fichier PDF 1.3 valide, relu intégralement,
     contenu conforme (tableau des rubriques, totaux, avertissement placeholder).
  5. Création d'un congé MALADIE de 5 jours, approbation, synchronisation automatique
     en variable de paie → déduction de 45,45€ cohérente avec la formule
     (salaire/22 jours × 5 j × 10% de non-maintien).
  6. Création et validation d'un acompte de 100€ → reflété automatiquement dans le
     bulletin généré (`netAPayer` réduit exactement de 100€), acompte passé au statut
     DEDUIT après génération.
  7. **Bug réel trouvé et corrigé pendant ce test** : un acompte DEDUIT disparaissait du
     recalcul lors d'une régularisation (car seul le statut VALIDE était pris en
     compte) — corrigé dans `variables-paie-rh.service.ts` (VALIDE et DEDUIT comptent
     tous les deux, seul ANNULE est exclu), **revérifié après correction, confirmé
     correct**.
  8. Cycle mensuel complet : ouverture → liste des salariés à traiter → calcul en
     masse → validation → **clôture** → tentative de régénération du bulletin sur la
     période clôturée **correctement refusée** (HTTP 400, immutabilité).
  9. Duplicata (nouveau bulletin, `version` incrémentée) et régularisation (nouveau
     bulletin lié à l'original via `bulletinOrigineId`, sans écraser celui-ci) —
     fonctionnels.
  10. Récapitulatif de déclarations et export CSV comptable — données agrégées
      cohérentes avec les bulletins générés.
  11. Portail salarié : un utilisateur ne voit que ses propres bulletins ; tentative
      d'accès au bulletin d'un collègue → 404 (pas de fuite d'information).
  12. RBAC : un utilisateur `COLLABORATEUR` tentant de créer une rubrique de paie reçoit
      bien un `403 Forbidden`.
- Nettoyage complet effectué après test : processus backend isolé arrêté, conteneur
  PostgreSQL isolé arrêté (`docker stop`), fichier `backend/.env` (créé uniquement pour
  ce test, avec des identifiants factices pointant vers la base isolée) supprimé.
  Aucun fichier de configuration partagé n'a été laissé modifié.

### Ce qui n'a PAS été exécuté — dit honnêtement

- Le fichier `frontend/e2e/paie-rh-module.spec.ts` a été écrit selon les conventions
  réelles du repo (`loginViaApi`/`TEST_TENANT` de `frontend/e2e/helpers/auth.ts`,
  vérifié par `npx playwright test --list` qui confirme qu'il est syntaxiquement valide
  et que les 2 tests sont bien détectés) mais **n'a pas été exécuté dans un navigateur
  réel**. Le lancer suppose un environnement de dev complet démarré sur les ports 3000/
  4200 avec le tenant `test-e2e` déjà provisionné (comme tous les autres specs e2e du
  repo) — lancer un second frontend/backend sur ces ports précis aurait nécessité soit
  de couper la session de développement déjà active de l'utilisateur, soit de dupliquer
  toute la stack sur d'autres ports avec un tenant de test dédié, ce qui dépassait le
  temps raisonnable à consacrer à ce module par rapport au reste du périmètre demandé.
  **Le comportement UI n'a donc pas été vérifié visuellement** — seule la logique
  métier sous-jacente (API) l'a été, de façon approfondie.

---

# Refonte rubriques/constantes (~Sage 100 Paie & RH) — session ultérieure

Cette section documente une **refonte** de l'écran "Rubriques de paie" décrit ci-dessus,
demandée après retour utilisateur ("trop simpliste : juste un taux ou un montant fixe").
Elle s'appuie sur un rapport d'analyse d'une vidéo de démo Sage 100 Paie & RH (fourni
comme référence FONCTIONNELLE, pas comme cahier des charges — la consigne explicite était
d'adapter la LOGIQUE, pas de cloner Sage pixel pour pixel, et de neutraliser ce qui est
trop franco-français). Tout ce qui précède dans ce document reste valable et n'a **pas**
été supprimé ; cette section décrit uniquement ce qui a changé et pourquoi.

## Les 3 points livrés

### 1. Calcul guidé (Nombre/Base/Taux, Part salariale/patronale, flags R/I/S)

`RubriquePaieRh` (`backend/src/entities/rubrique-paie-rh.entity.ts`) remplace l'ancien
modèle `baseCalcul` (BRUT/SALAIRE_BASE/FIXE) + `tauxSalarial`/`tauxPatronal`/`montantFixe`
par :

- `typeCalcul` — **enum fermé** `TypeCalculRubriqueRh` : `MONTANT_FIXE`, `NOMBRE_X_BASE`,
  `NOMBRE_X_BASE_X_TAUX`, `NOMBRE_X_TAUX`, `BASE_X_TAUX`, `BASE_DIV_NOMBRE`,
  `NOMBRE_DIV_TAUX`, `BASE_DIV_TAUX`, `TOTALISATION` — exactement la liste minimale
  demandée. Jamais une chaîne libre.
- `elementSalarial` / `elementPatronal` (JSON, type `ElementCalculPartRubriqueRh`) — une
  "part" = 3 opérandes `{ nombre, base, taux }`, chacun `{ source, valeur, constanteCode }`
  où `source` ∈ `VALEUR` (saisie directe) / `CONSTANTE` (référence `ConstantePaieRh`,
  ouvre le "picker" côté front) / `BRUT` / `SALAIRE_BASE` (grandeurs déjà calculées). Le
  Montant n'est **jamais stocké** : toujours recalculé par le moteur ("(Calculé)" côté UI,
  comme dans Sage). `elementPatronal` n'existe (non `null`) que pour une rubrique
  `imputation = COTISATION`.
- `assietteRubriqueCode` + `reportAssiette` — "Assiette de calcul des bases de
  cotisation" Sage : référence une AUTRE rubrique (ou pseudo-code `BRUT`/`SALAIRE_BASE`)
  dont le montant déjà calculé sert de Base commune aux deux parts.
- Flags **R/I/S** (`reportApresCloture`/`impressionBulletin`/`saisieAutorisee`) — un jeu de
  3 par PART (6 au total pour une cotisation), voir "Simplifications assumées" ci-dessous.

### 2. Constantes composables (`ConstantePaieRh`)

Nouvelle entité `backend/src/entities/constante-paie-rh.entity.ts` (`paie_rh_constantes`)
— objet séparé référencé depuis les rubriques au lieu d'une valeur en dur :

- `typeConstante = VALEUR` : une valeur directe (`valeur`).
- `typeConstante = CALCUL` : composée d'une grille `operandes` (`OperandeConstantePaieRh[]`
  — `{ operateur: '+'|'-'|'*'|'/', source: 'CONSTANTE'|'VALEUR', constanteCode, valeur }`),
  jamais de formule en texte libre — reproduit la grille Sage "op / Code / Intitulé" avec
  les boutons "Insérer constante(s)"/"Insérer valeur". Résolution en réduction
  gauche-à-droite (le 1er opérande fixe la valeur de départ) avec protection contre les
  références circulaires — voir `backend/src/paie-rh/constante-resolution.util.ts`
  (`resoudreConstante()`, fonction pure, réutilisée à la fois par le moteur de calcul et
  par l'endpoint de prévisualisation `GET /paie-rh/constantes/resoudre/:code`).
- **Historisation par date d'effet** (`dateEffet`) : plusieurs lignes peuvent partager le
  même `code` — `ConstantesPaieRhService.findByRegime()` résout la ligne la plus
  spécifique (régime propre > `TOUS`) puis la plus récente (`dateEffet` ≤ date de
  référence) ; un recalcul de bulletin utilise la **fin de la période concernée** comme
  date de référence (pas la date du jour), pour qu'un recalcul d'un mois passé reste
  cohérent avec les valeurs en vigueur à cette période-là.
- `arrondi` (`AUCUN`/`PLUS_PROCHE`) et `visible` (case Sage "Visible") sont supportés.

### 3. Arborescence par nature de l'écran "Liste des rubriques"

`frontend/src/app/features/paie-rh/rubriques/rubriques-paie-rh.component.ts` : panneau
arborescence à gauche ("Toutes les rubriques" > "De brut"/"De cotisation"/"Non soumises")
+ liste plate filtrée à droite (recherche libre, colonnes Code/Libellé/Type de
calcul/Imputation/Régime). **Choix important** : la nature n'est **pas** une colonne
stockée en base — `deriverNatureRubriqueRh(imputation)` (dupliquée en pure fonction
identique côté backend `rubrique-paie-rh.entity.ts` et côté frontend
`paie-rh.service.ts`) la dérive de `ImputationRubriqueRh` (`COTISATION` → De cotisation,
`PRIME`/`AVANTAGE` → De brut, `RETENUE`/`INFORMATION` → Non soumises), pour ne jamais avoir
deux champs qui peuvent se désynchroniser.

## Simplifications assumées par rapport à l'analyse vidéo — et pourquoi

- **Terminologie franco-française retirée** : pas de "Anciennes informations DADS-U", pas
  de "Code DUCS", pas de "Code Commune" — ces champs sont spécifiques au régime légal
  français et n'ont pas de sens pour un régime Réunion/Madagascar générique paramétrable
  (`regimePaieCode`, déjà existant). Le concept de "Caisse" (organisme collecteur) observé
  pour les rubriques de cotisation Sage n'a pas non plus été repris comme champ dédié — il
  peut être noté dans `notes` si besoin, plutôt que d'ajouter un champ figé à un format
  d'organisme qui n'a pas été fourni par une source du dossier.
- **Types de calcul** : Sage distingue aussi des variantes symétriques (`Taux/Base`,
  `Nombre/Base`, `Taux×Nombre/Base`) jugées redondantes pour notre moteur — soit
  équivalentes à une combinaison déjà couverte en inversant Nombre/Base au niveau de la
  configuration de la rubrique, soit sans cas d'usage identifié dans le périmètre AFYM.
  Liste retenue : exactement les 9 valeurs minimales demandées dans le brief.
- **Flags R/I/S "par ligne" plutôt que "par colonne"** : Sage a 3 cases par COLONNE
  (Nombre/Base/Taux/Montant), soit 9 cases par part. Nos opérandes Nombre/Base/Taux sont
  des objets structurés (`{source, valeur, constanteCode}`) choisis via un menu, pas des
  cellules de saisie libre indépendantes — le niveau "par colonne" n'apporte donc pas de
  valeur réelle pour notre moteur. Nous avons gardé un seul jeu de 3 cases **par part**
  (salariale/patronale), soit 6 au total pour une cotisation — la simplification
  explicitement autorisée par le brief.
  - **R (report après clôture)** et **S (saisie autorisée)** sont **stockés mais NON
    câblés** dans le moteur v1 — un report inter-période ou une saisie de dérogation ligne
    à ligne à la génération du bulletin sont hors périmètre de cette refonte. Ce sont des
    limitations documentées, pas des fonctionnalités inventées : les champs existent pour
    ne pas fermer la porte à une implémentation future.
  - **I (impression bulletin)** est **câblé réellement** : `LigneBulletinRh.imprimable`
    (vrai si au moins une des deux parts a `impressionBulletin = true`) est consommé à la
    fois par la génération PDF (`BulletinsSalarieService.construirePdf`, filtre les lignes
    non imprimables avant de construire le tableau) et peut l'être côté front.
- **TOTALISATION simplifiée** : notre moteur ne totalise QUE le Brut global déjà calculé
  (`totalBrut`), pas une sélection arbitraire de plusieurs rubriques par nature/filtre —
  une rubrique `TOTALISATION` sert essentiellement à matérialiser une ligne "Total brut"
  utilisable ensuite comme `assietteRubriqueCode` par d'autres rubriques (voir
  `RUBRIQUES_PLACEHOLDER` dans `rubriques-paie-rh.service.ts`, rubrique
  `TOTAL_BRUT_MENSUEL`).
- **Assiette de cotisation simplifiée** : une assiette référence le montant **total**
  (calculé) d'une autre rubrique, appliqué **identiquement aux deux parts** — pas de
  sélection arbitraire de plusieurs rubriques ni de filtre par nature/colonne comme
  pourrait le permettre Sage en toute généralité.
- **"Report de l'assiette"** (case Sage) : stockée (`reportAssiette`) mais **non câblée** —
  même limitation documentée que R/S ci-dessus (report inter-période hors périmètre).
- **Picker de constante simplifié** : au lieu d'une fenêtre modale dédiée façon Sage
  ("Liste des constantes" en popup), le "picker" est un menu déroulant (`mat-select`)
  listant les constantes disponibles directement dans le champ Nombre/Base/Taux concerné
  — fonctionnellement équivalent (on ne tape jamais le code à la main), plus simple à
  intégrer dans le formulaire existant.
- **Onglets "Calcul"/"Spécificités"** (sous-onglets Sage pour les cotisations) : non
  répliqués comme sous-onglets séparés — tous les champs pertinents (assiette, report
  d'assiette, grille Nombre/Base/Taux) sont regroupés dans une seule section "Éléments
  constitutifs" du formulaire, jugée suffisamment lisible pour notre périmètre.

## Comment le moteur de calcul existant a été ADAPTÉ (pas réécrit)

`backend/src/paie-rh/moteur-calcul-paie-rh.service.ts` conserve **exactement** son
architecture globale précédente : `calculer()` a la même signature (avec un paramètre
`constantes` ajouté en fin de liste, valeur par défaut `[]` pour rester compatible), le
même calcul du Brut (heures sup, primes/absences/avantages variables), la même boucle sur
les rubriques actives triées par `ordreAffichage`, les mêmes totaux
(cotisations/net imposable/net à payer/coût employeur) et le même type de retour
`ResultatCalculPaieRh`. **Seule** la façon de calculer le montant d'UNE rubrique a changé :
l'ancien `switch` sur `baseCalcul` + `montantFixe ?? (base × tauxSalarial / 100)` a été
remplacé par `calculerPart()`, qui résout les opérandes (littéral / constante / Brut /
Salaire de base) puis applique le `typeCalcul`. Tout le reste (intégration congés/absences
via `VariablesPaieRhService`, acomptes, cycle mensuel, immutabilité après clôture) est
**inchangé** — ces services ne connaissent pas la structure interne d'une rubrique, ils
consomment uniquement le résultat de `calculer()`.

`BulletinsSalarieService.chargerContexte()` a été étendu pour charger aussi les constantes
du régime (`ConstantesPaieRhService.findByRegime`, avec la fin de la période comme date de
référence) et les passer au moteur ; `estPlaceholder` du bulletin tient désormais compte
aussi des constantes placeholder. La génération PDF (`construirePdf`) est inchangée à part
le filtre `imprimable` ajouté sur les lignes affichées.

## Migration des données

Refonte de schéma directe (colonnes `baseCalcul`/`tauxSalarial`/`tauxPatronal`/
`montantFixe` supprimées, remplacées par `typeCalcul`/`elementSalarial`/`elementPatronal`/
`assietteRubriqueCode`/`reportAssiette`) — acceptable car rien n'était commité et les
données de dev sont du placeholder. Le re-seed automatique (`estPlaceholder`) a été
entièrement réécrit pour le nouveau modèle et **vérifié par exécution réelle** (voir
Tests) : `TOTAL_BRUT_MENSUEL` (TOTALISATION), `SECU_MALADIE` (cotisation avec assiette
explicite), `RETRAITE_COMPL` (taux référençant des constantes), `CHOMAGE`, `CSG_CRDS`,
`INDEMNITE_TRANSPORT` (MONTANT_FIXE dont la Base référence une constante composée — comme
l'exemple Sage "rubrique 115"), `MUTUELLE`. Les constantes placeholder associées
(`ConstantesPaieRhService`) : `TAUX_RETRAITE_COMPL_SALARIAL`/`_PATRONAL`,
`INDEMNITE_TRANSPORT_FORFAIT`, et `INDEMNITE_TRANSPORT_MAJOREE` (constante `CALCUL` de
démonstration : `INDEMNITE_TRANSPORT_FORFAIT + 5`).

## Frontend livré

- `frontend/src/app/features/paie-rh/rubriques/rubriques-paie-rh.component.ts` — écran
  "Liste des rubriques" complet (arborescence + liste + formulaire création/édition avec
  la grille Nombre/Base/Taux par part, sélection du type de calcul, picker de constante).
- `frontend/src/app/features/paie-rh/constantes/constantes-paie-rh.component.ts` — écran
  "Liste des constantes" (liste + formulaire, composeur d'opérandes avec boutons "Insérer
  constante(s)"/"Insérer valeur", bouton "Prévisualiser" pour voir la valeur résolue d'une
  composition avant enregistrement, historisation via l'action "Nouvelle date d'effet").
- `frontend/src/app/features/paie-rh/paie-rh-hub.component.ts` (modifié) : les deux
  composants ci-dessus remplacent l'ancien tableau "Rubriques" (édition par `prompt()`
  du taux salarial/patronal uniquement) ; nouvel onglet "Constantes".
- `frontend/src/app/core/services/paie-rh.service.ts` (modifié) : types
  `RubriquePaieRh`/`LigneBulletinRh` alignés sur le nouveau schéma, nouveaux types
  `ConstantePaieRh`/`OperandeConstantePaieRh`/`ElementCalculPartRubriqueRh`/etc., nouvelles
  méthodes `findConstantes`/`createConstante`/`updateConstante`/`removeConstante`/
  `resoudreConstante`.

## Fichiers créés/modifiés pour cette refonte

Backend :
- `backend/src/entities/constante-paie-rh.entity.ts` (nouveau)
- `backend/src/entities/rubrique-paie-rh.entity.ts` (réécrit)
- `backend/src/entities/bulletin-salarie.entity.ts` (modifié : `LigneBulletinRh` +
  `imprimable`/`typeCalcul`)
- `backend/src/paie-rh/constante-resolution.util.ts` (nouveau)
- `backend/src/paie-rh/constantes-paie-rh.service.ts` (nouveau)
- `backend/src/paie-rh/constantes-paie-rh.controller.ts` (nouveau)
- `backend/src/paie-rh/dto/constante-paie-rh.dto.ts` (nouveau)
- `backend/src/paie-rh/dto/rubrique-paie-rh.dto.ts` (réécrit)
- `backend/src/paie-rh/rubriques-paie-rh.service.ts` (réécrit : placeholders du nouveau modèle)
- `backend/src/paie-rh/moteur-calcul-paie-rh.service.ts` (adapté, voir ci-dessus)
- `backend/src/paie-rh/bulletins-salarie.service.ts` (modifié : charge les constantes,
  filtre `imprimable` dans le PDF)
- `backend/src/paie-rh/paie-rh.module.ts` (modifié : enregistrement `ConstantePaieRh` +
  service/contrôleur)

Frontend : voir "Frontend livré" ci-dessus, + `frontend/e2e/paie-rh-module.spec.ts`
(étendu, voir Tests).

## Tests — état réel de CETTE refonte, sans rien inventer

Contexte d'exécution différent de la session précédente : cette refonte a été développée
par un agent isolé dans un **worktree git dédié**, sans accès au dépôt de travail principal
ni à ses dépendances installées (`node_modules` liés par symlink vers le dépôt principal,
faute d'espace disque pour une installation dédiée — 4,2 Go libres au moment de la tâche).
Les ports 3000 (backend)/4200 (frontend)/5432 (PostgreSQL) étaient déjà occupés par la
session de développement active de l'utilisateur — **volontairement non touchés**, pour ne
pas interférer.

### Ce qui a été réellement exécuté et observé

- **Moteur de calcul + résolution de constantes, exécutés réellement** (pas juste relus) :
  script Node (`verify-moteur.js`, exécuté contre le `dist/` compilé du backend) couvrant :
  composition de constante (`FORFAIT + 5 = 25`), détection de référence circulaire (lève
  une erreur explicite), et un scénario de bulletin complet reproduisant le cas placeholder
  (salaire 2000) avec les 3 mécanismes nouveaux combinés — assiette explicite
  (`SECU_MALADIE` référençant `TOTAL_BRUT_MENSUEL`), taux résolu depuis une constante
  (`RETRAITE_COMPL` : 3,15 %/4,72 %) et Base résolue depuis une constante composée
  (`IND_TRANSPORT` : 25). **Les 15 assertions arithmétiques sont toutes passées** (totaux
  cotisations salariales 63, patronales 234,40, net imposable 1937, net à payer 1962, coût
  employeur 2234,40 — vérifiés manuellement cohérents avec les formules).
- `npx tsc --noEmit` (backend) : **0 erreur** attribuable à cette refonte (baseline établie
  avant modification : mêmes erreurs préexistantes non liées, dans des `*.spec.ts`/
  `app.e2e-spec.ts` déjà cassés avant cette tâche — vérifié par comparaison ligne à ligne).
- `npx nest build` (backend) : **succès**.
- `npx ng build --configuration=production` (frontend) : **succès** (mêmes avertissements
  `NG8xxx` préexistants dans d'autres fichiers non liés à cette tâche, budgets de taille
  CSS préexistants dépassés ailleurs dans le repo — rien de nouveau introduit par cette
  refonte).
- `npx playwright test --list frontend/e2e/paie-rh-module.spec.ts` : **4 tests détectés**,
  fichier syntaxiquement valide (`PAIE-RH-1` mis à jour pour les nouveaux sélecteurs,
  `PAIE-RH-3`/`PAIE-RH-4` nouveaux pour constante/rubrique, `PAIE-RH-5` = ancien
  `PAIE-RH-2` renommé, logique inchangée).

### Ce qui n'a PAS été exécuté — dit honnêtement

- **Aucun test e2e Playwright n'a été exécuté dans un navigateur réel** pour cette
  refonte — mêmes raisons que la session précédente (pas d'environnement dédié tenant
  `test-e2e` sans toucher aux ports 3000/4200/5432 déjà occupés par la session active de
  l'utilisateur), auxquelles s'ajoute cette fois l'absence de budget disque pour monter un
  PostgreSQL isolé (4,2 Go libres). **Le comportement UI (arborescence, formulaire,
  picker de constante, composeur d'opérandes) n'a donc pas été vérifié visuellement** — le
  build de production Angular confirme seulement l'absence d'erreur de compilation/type
  dans les templates, pas le rendu ni le comportement runtime réels.
- Aucune vérification via une vraie base PostgreSQL (migrations TypeORM `synchronize`,
  contraintes JSON, requêtes `findByRegime` avec historisation réelle en base) — la
  logique de `ConstantesPaieRhService.findByRegime()` (priorité régime spécifique > TOUS,
  puis date d'effet la plus récente) a été relue attentivement mais **pas exécutée contre
  une vraie base de données** dans cette session.

---

# Dialogue "Bulletin du salarié" (~Sage 100 Paie & RH, écran individuel du bulletin) — session ultérieure

Cette section documente une nouvelle fonctionnalité demandée après analyse d'une vidéo de
formation Sage 100 Paie & RH portant sur l'écran individuel du bulletin d'un salarié (un
dialogue riche à 6 onglets, recalcul en direct, cumul annuel, navigation Préc./Suiv. dans
le cycle mensuel). Tout ce qui précède dans ce document reste valable et n'a **pas** été
modifié ; cette section décrit uniquement ce qui a été ajouté et pourquoi.

⚠️ **Contexte d'exécution** : cette tâche a été développée dans un **worktree git isolé**
qui, au moment de démarrer, ne contenait **pas du tout** le module `paie-rh` (backend
`backend/src/paie-rh/`, frontend `frontend/src/app/features/paie-rh/`) — ce module existe
uniquement comme travail **non commité** dans la copie de travail principale du dépôt
(`/datas/Projets/Aro`, la session de développement active de l'utilisateur, ports 3000/
4200 occupés). La première étape de cette tâche a donc été de **reproduire** ce module
(fichiers backend + frontend + intégration `app.module.ts`/`app.routes.ts`/navigation RH/
onglet fiche salarié) dans ce worktree, en copiant les fichiers depuis la copie principale
et en symlinkant `node_modules` (même contrainte d'espace disque que documentée plus haut
dans ce fichier — ~4 Go libres), **sans jamais modifier ni interroger** la copie principale
au-delà d'une lecture seule. Ceci explique pourquoi le diff de cette tâche inclut des
fichiers du module `paie-rh` "de base" en plus du nouveau dialogue lui-même.

## Le dialogue, onglet par onglet

Nouveau composant `frontend/src/app/features/paie-rh/bulletin-salarie-dialog/bulletin-salarie-dialog.component.ts`
(`app-bulletin-salarie-dialog`), ouvert en grand modal (`MatDialog`, `panelClass:
['rounded-dialog','no-pad-dialog']`, mêmes classes CSS que le seul autre gros dialogue du
projet — `create-client-wizard.component.ts` —, réutilisées plutôt que dupliquées ; 1300px/
92vh). Convention de tabs : **pas** de `MatTabsModule` (jamais utilisé nulle part ailleurs
dans le projet) mais le même pattern "barre de boutons + `[class.active]`" que
`paie-rh-hub.component.ts`/`rubriques-paie-rh.component.ts`, pour rester cohérent avec
l'existant plutôt que d'introduire un nouveau système d'onglets.

1. **Rubriques** : liste les `RubriquePaieRh` actives du régime du contrat, avec pour
   chacune Code/Libellé/Nombre/Base/Taux salarial/Montant salarial/Taux patronal/Montant
   patronal — valeurs lues dans le dernier résultat de calcul (`apercu().detailRubriques`,
   voir "Recalcul en direct" ci-dessous). Une ligne dont la part (salariale ou patronale) a
   `saisieAutorisee = true` affiche un bouton "Surcharger ce mois-ci" qui ouvre un mini-
   formulaire Nombre/Base/Taux ; la valeur saisie **ne modifie jamais** la `RubriquePaieRh`
   elle-même — voir "Surcharge ponctuelle par bulletin" ci-dessous pour le mécanisme complet.
2. **Congés/absences** : simplifié en **une seule liste** (pas de 3 sous-onglets
   Détail/Congés/Repos-RTT comme Sage — voir "Simplifications" ci-dessous) des
   `CongeAbsence` du salarié qui chevauchent la période sélectionnée, plus un bouton
   "Resynchroniser depuis les congés validés" (`VariablesPaieRhService.synchroniserAbsences`,
   déjà existant, réutilisé tel quel), plus les lignes de déduction déjà synchronisées
   (lecture seule) et un éditeur de lignes "Absences saisies manuellement" pour le cas
   d'une absence sans demande de congé formelle dans le circuit `CongeAbsence`.
3. **Heures de travail/HS** : les DEUX champs déjà existants de `VariablePaieRh`
   (`heuresSupplementaires`, `tauxMajorationHeuresSup`) — pas de grille par code d'heure
   ("HS JOUR 130%" etc.) — voir "Simplifications" ci-dessous.
4. **Autres variables** : éditeurs de lignes libres (`{libelle, montant}`) pour Primes,
   Avantages en nature, et Retenues diverses (saisies manuellement) — tous des champs déjà
   existants de `VariablePaieRh`, simplement exposés dans ce nouvel écran plutôt que
   dupliqués dans une nouvelle entité (exactement l'inspection demandée dans le brief).
   Les retenues d'origine `ACOMPTE` (synchronisées automatiquement) sont affichées à part,
   en lecture seule.
5. **Valeurs de base** : lecture seule des champs du `ContratTravail` (type, dates,
   quotité, salaire de base, régime) — modifiables uniquement depuis l'onglet "Contrat &
   Paie" existant de la fiche salarié (pas dupliqué ici).
6. **Bulletin calculé** : Période et Cumul annuel **côte à côte** (`display: grid;
   grid-template-columns: 1fr 1fr`), plus le détail des rubriques de la période, plus un
   bouton "Générer (persister) le bulletin" (réutilise `POST /paie-rh/bulletins/generer`
   existant, même bouton/logique que `paie-rh-salarie-tab.component.ts` — **limitation
   déjà existante et non corrigée ici** : cet endpoint ne vérifie pas qu'un bulletin existe
   déjà pour la période avant d'en créer un nouveau ; un clic répété crée plusieurs lignes
   `BulletinSalarie` pour le même mois — comportement pré-existant, hors périmètre de cette
   tâche, signalé ici plutôt que silencieusement aggravé).

## Recalcul en direct

Le bouton "Recalculer" (toujours visible en pied de dialogue) et le changement d'onglet
vers "Bulletin calculé" (si des modifications non enregistrées existent) déclenchent la
même séquence :

1. `POST /paie-rh/variables` (endpoint **déjà existant**, `VariablesPaieRhService.upsert`,
   inchangé) avec l'état courant des champs édités dans TOUS les onglets (heures sup,
   primes, absences manuelles, avantages, retenues manuelles, surcharges de rubriques).
2. `GET /paie-rh/bulletins/calculer` (endpoint **déjà existant**, signature **inchangée**)
   — qui recharge la variable fraîchement enregistrée via `chargerContexte()` (lequel
   resynchronise aussi automatiquement absences/acomptes avant de calculer, comportement
   pré-existant conservé).
3. `GET /paie-rh/bulletins/cumul-annuel` (**nouvel** endpoint, voir ci-dessous).

**Aucune extension de signature n'a été nécessaire pour `GET /paie-rh/bulletins/calculer`** :
la vérification demandée dans le brief a été faite et la conclusion est que ce n'était pas
utile — les surcharges de rubriques sont stockées sur `VariablePaieRh` (voir ci-dessous),
que `calculer()` charge déjà et transmet déjà en entier au moteur de calcul ; il suffisait
donc d'apprendre au moteur à les lire, pas de changer l'API. Ce choix reproduit exactement
le comportement Sage décrit dans le brief ("une saisie... se répercute automatiquement...
dès qu'on relance le calcul") sans dupliquer aucun mécanisme existant.

## Cumul annuel (nouvelle capacité backend)

`BulletinsSalarieService.cumulAnnuel(salarieId, mois, annee, tenantId)` (nouveau, dans
`bulletins-salarie.service.ts`) + `GET /paie-rh/bulletins/cumul-annuel` (nouveau endpoint,
mêmes guards que `calculer` — authentifié, sans restriction de rôle, cohérent avec le
caractère "aperçu en lecture" de l'opération) : somme, pour un salarié et une période
donnés, les totaux (`totalBrut`, cotisations salariales/patronales, net imposable, net à
payer, coût employeur) de tous les `BulletinSalarie` déjà **générés** (persistés) dans
l'année civile, de janvier à la période incluse.

**Dédoublonnage assumé** (simplification documentée) : un même mois peut porter plusieurs
lignes `BulletinSalarie` (duplicata BUL-007, régularisation BUL-008, mécanismes déjà
existants et non modifiés). Une seule ligne par mois est retenue pour ne jamais compter un
mois deux fois : une régularisation représente le mois si elle existe (censée corriger
l'original), sinon la version la plus élevée est retenue (un duplicata porte les mêmes
montants que l'original, donc lequel des deux est choisi est sans impact numérique). Ceci
ne calcule **aucun delta ligne à ligne** entre original et régularisation — cohérent avec
`genererRegularisation()` qui recalcule intégralement plutôt qu'un delta (comportement déjà
existant, documenté plus haut dans ce fichier).

**Vérifié par test réel** (voir section Tests ci-dessous) : bulletin de janvier
(1621 net à payer) + bulletin de février (1681) → cumul à fin février = 3302, exact ; un
duplicata du bulletin de janvier créé ensuite ne fait PAS varier ce total (3302 inchangé),
confirmant l'absence de double comptage.

## Surcharge ponctuelle par bulletin (mécanisme ajouté)

Le brief demandait de vérifier si un mécanisme de "surcharge ponctuelle par bulletin"
existait déjà pour le flag `saisieAutorisee` (S) de `ElementCalculPartRubriqueRh` — la
réponse, après lecture du code (voir plus haut dans ce document, section "Flags R/I/S") :
**non**, le flag était stocké mais jamais consommé par le moteur ("NON câblée dans le
moteur v1"). Ce mécanisme a donc été **ajouté** :

- **`VariablePaieRh.surchargesRubriques`** (nouvelle colonne JSON, nullable — entité
  `variable-paie-rh.entity.ts`) : liste de `{ rubriqueCode, part: 'SALARIALE'|'PATRONALE',
  champ: 'nombre'|'base'|'taux', valeur }`. Stockée sur `VariablePaieRh` (le conteneur
  mensuel par salarié déjà existant) plutôt que dans une nouvelle entité dédiée — même
  raisonnement que pour les autres variables mensuelles, et bénéfice direct : rechargée et
  appliquée automatiquement par tout calcul (aperçu ET génération) sans toucher à
  `BulletinsSalarieService.calculer()`/`generer()`.
- **`PartRubriqueRh`/`ChampCalculRubriqueRh`** (nouveaux enums, `rubrique-paie-rh.entity.ts`)
  — listes fermées, jamais une chaîne libre, validées côté DTO (`class-validator`
  `@IsEnum`) : une valeur hors énumération est rejetée en 400 (**vérifié par test réel**).
- **`MoteurCalculPaieRhService.calculerPart()`** (modifié) : résout chaque opérande
  Nombre/Base/Taux en vérifiant d'abord s'il existe une surcharge pour
  `rubrique.code|part|champ` **ET** que la part concernée a `element.saisieAutorisee ===
  true` — **revalidation serveur systématique**, jamais une confiance aveugle dans ce
  qu'envoie le client. **Vérifié par test réel** (voir Tests) : une surcharge envoyée pour
  une part SANS `saisieAutorisee` est silencieusement ignorée (le calcul reste conforme au
  paramétrage réel de la rubrique), une rubrique inexistante référencée est également
  ignorée sans planter le calcul.
- `LigneBulletinRh` (entité + service + front) gagne deux champs optionnels
  `nombreSalarial`/`nombrePatronal` (résolus par le moteur, `null` si le type de calcul n'a
  pas de "Nombre" pertinent — ex. `MONTANT_FIXE`, `BASE_X_TAUX` — même logique de gating
  que le `tauxSalarial`/`tauxPatronal` déjà existant) pour que l'onglet "Rubriques" du
  dialogue puisse afficher la colonne "Nombre" demandée par le brief, absente jusqu'ici du
  résultat de calcul. Champs optionnels (`?:`) pour ne rien casser sur les bulletins déjà
  générés avant cet ajout (leur JSON `detailRubriques` n'a simplement pas ces clés,
  affichées "-" côté front).

## Navigation Précédent/Suivant

Le dialogue charge, pour son mois/année courants, la liste `GET
/paie-rh/cycles/:mois/:annee/salaries` (endpoint **déjà existant**, `listerSalariesATraiter`
— celui déjà utilisé par l'onglet "Cycle mensuel" du hub) et navigue dedans (Préc./Suiv.)
en rechargeant tout le contexte (contrat, variables, rubriques, congés, calcul) pour le
salarié ciblé, sans fermer le dialogue. Fonctionne identiquement quel que soit le point
d'entrée (hub `/rh/paie` OU onglet "Contrat & Paie" de la fiche salarié) — le dialogue
récupère toujours lui-même cette liste plutôt que de dépendre d'un contexte transmis par
l'appelant, pour rester autonome. Une confirmation est demandée si des modifications non
enregistrées existent avant de changer de salarié/période/fermer le dialogue.

**Vérifié par test réel** (voir Tests) : avec deux salariés actifs sur la période, le
bouton "Suiv." fait bien passer le titre du dialogue de "Jean Dupont" à "Marie Martin", et
"Préc." revient correctement en arrière.

## Point d'entrée

- **Hub `/rh/paie`, onglet "Cycle mensuel"** : chaque ligne de salarié à traiter garde sa
  navigation existante vers la fiche salarié (clic sur la ligne), **et** gagne un nouveau
  bouton icône dédié "Ouvrir le bulletin détaillé" (`mat-icon-button`, `aria-label`
  explicite) qui ouvre ce dialogue directement — choix "en plus de" plutôt que "à la
  place de" l'existant (mentionné comme option dans le brief), pour ne retirer aucune
  fonctionnalité déjà utile.
- **Onglet "Contrat & Paie" de la fiche salarié** (`paie-rh-salarie-tab.component.ts`) :
  nouveau bouton "Bulletin détaillé (6 onglets)" à côté de "Aperçu du calcul"/"Générer le
  bulletin" existants (conservés tels quels — ce nouveau dialogue les complète, ne les
  remplace pas, pour ne pas casser l'écran simple déjà fonctionnel pour un usage rapide).

## Simplifications assumées par rapport à l'analyse vidéo — et pourquoi

- **Congés/absences : 1 liste au lieu de 3 sous-onglets** (Détail/Congés/Repos-RTT Sage) —
  notre modèle n'a qu'un seul enum `TypeConge` (avec `RECUPERATION` comme équivalent le
  plus proche d'un "repos compensateur", pas un concept "RTT" distinct) et un seul circuit
  d'approbation ; recréer 3 sous-onglets aurait dupliqué la même liste filtrée différemment
  sans ajouter de valeur réelle pour notre périmètre.
- **Heures de travail/HS : 2 champs agrégés au lieu d'une grille par code d'heure** ("HS
  JOUR 130%", "HS NUIT 150%"...) — `VariablePaieRh.heuresSupplementaires` est un total
  mensuel unique avec un seul taux de majoration (éventuellement surchargé), pas une liste
  de lignes typées par code. Reproduire la grille Sage aurait nécessité une refonte du
  modèle de données `VariablePaieRh` elle-même (nouvelle entité ou nouveau champ JSON de
  lignes typées) — jugé hors périmètre de cette tâche (le brief demandait explicitement
  d'exposer l'existant "par onglets plutôt qu'à dupliquer une nouvelle entité").
- **Onglet "Rubriques" : une seule grille, pas de picker de constante inline** — l'onglet
  affiche les valeurs **résolues** (déjà calculées) et permet une surcharge ponctuelle en
  Nombre/Base/Taux bruts (valeurs littérales), sans reproduire le picker de constante de
  l'écran d'admin "Rubriques" (`rubriques-paie-rh.component.ts`) : une surcharge "pour ce
  bulletin" est par nature une exception ponctuelle en valeur, pas une nouvelle règle
  générale qui mériterait de référencer une constante partagée.
- **"Générer le bulletin" depuis ce dialogue réutilise l'endpoint existant sans le
  renforcer** — la limitation déjà documentée plus haut dans ce fichier (pas de garde
  d'idempotence empêchant de générer plusieurs bulletins pour le même mois) n'a pas été
  corrigée : corriger ce point aurait dépassé le périmètre de cette tâche (ajouter un
  dialogue, pas durcir un endpoint existant) — signalé explicitement ici plutôt que
  silencieusement laissé de côté.

## Bug réel trouvé et corrigé pendant le test dans un vrai navigateur

**Locale française absente dans ce worktree** : `frontend/src/app/app.config.ts`, dans ce
worktree isolé (voir "Contexte d'exécution" ci-dessus), ne portait ni
`registerLocaleData(localeFr)` ni `{ provide: LOCALE_ID, useValue: 'fr-FR' }` — présents
dans la copie de travail principale du dépôt mais ajoutés APRÈS le point de branchement de
ce worktree, donc absents ici. Conséquence concrète observée dans le vrai navigateur :
tous les montants du dialogue s'affichaient en format anglo-saxon ("1,679.62 €" au lieu de
"1 679,62 €"), alors même que le code utilise partout le pipe standard `number:'1.2-2'`
(jamais de formatage manuel) — la cause n'était donc pas un bug du nouveau code, mais une
configuration globale manquante dans ce worktree précis. **Corrigé** en reportant le même
diff que la copie principale dans `app.config.ts` de ce worktree (import
`registerLocaleData`/`localeFr`, appel `registerLocaleData(localeFr)`, provider
`LOCALE_ID: 'fr-FR'`) — **revérifié après correction** : les montants s'affichent
correctement en format français ("2 000,00 €", "1 679,62 €"...).

## Tests — état réel de cette fonctionnalité, sans rien inventer

### Ce qui a été réellement exécuté et observé

Un environnement isolé dédié a été monté spécifiquement pour cette vérification, **sans
jamais toucher** aux ports 3000 (backend)/4200 (frontend)/5432 (PostgreSQL) de la session
de développement active de l'utilisateur (vérifiés strictement intacts avant et après —
`curl http://localhost:3000/api` répondait 200 avant le test, toujours 200 après ; les
conteneurs Docker `passidoc-*`/`supervision-*` de l'utilisateur n'ont pas été touchés) :

- Conteneur PostgreSQL isolé dédié (`docker run postgres:16-alpine`, image déjà en cache
  local — aucun téléchargement —, port 5433, base `passidoc_test`, **détruit après usage**
  — `docker stop`/`docker rm`).
- Backend NestJS compilé (`nest build`) et lancé en local sur le port 3011, avec un fichier
  `backend/.env` créé uniquement pour ce test (jamais commité, `.env` déjà dans
  `.gitignore`) pointant vers cette base isolée, `DB_SYNC=true` — **supprimé après usage**.
- Frontend Angular buildé (`ng build --configuration=development`, pour utiliser
  `environment.ts` brut plutôt que `environment.prod.ts` — la configuration `production`
  est la configuration PAR DÉFAUT de la commande `ng build` dans ce projet, comme découvert
  pendant cette vérification) avec `environment.ts` temporairement pointé vers
  `http://localhost:3011/api`, servi statiquement (petit serveur Node HTTP avec fallback
  SPA écrit ad hoc, aucune dépendance ajoutée, supprimé après usage) sur le port 4212.
  `environment.ts` **remis exactement à sa valeur d'origine** (`http://localhost:3000/api`)
  avant la fin de la tâche — revérifié par un dernier `ng build --configuration=production`
  qui confirme la valeur de production correcte dans le bundle final.
- Tenant + admin provisionnés via `POST /setup` (comme le module MVP1 l'avait déjà fait),
  deux collaborateurs de test créés avec un contrat de travail actif chacun (salaire 2000€
  et 1800€), une rubrique (`SECU_MALADIE`, part salariale) marquée `saisieAutorisee: true`
  via `PATCH /paie-rh/rubriques/:id` pour pouvoir tester le mécanisme de surcharge.
- **Backend, vérifié via `curl` réel contre la base isolée** :
  1. Surcharge d'un taux salarial (5% → 8%) via `POST /paie-rh/variables` puis
     `GET /paie-rh/bulletins/calculer` → montant recalculé exactement 100€ → 160€,
     cotisations salariales totales 319€ → 379€, net à payer 1681€ → 1621€ — arithmétique
     vérifiée manuellement, cohérente.
  2. Tentative de surcharge de la part PATRONALE de la même rubrique (`saisieAutorisee =
     false` pour cette part) → **ignorée**, taux/montant patronal inchangés (7%/140€) —
     confirme la revalidation serveur.
  3. `POST /paie-rh/variables` avec une valeur d'enum invalide pour `part` → `400 Bad
     Request` avec message explicite (validation DTO fonctionnelle).
  4. `POST /paie-rh/variables` avec un `rubriqueCode` inexistant → accepté (201), le calcul
     suivant réussit normalement (ignoré sans planter).
  5. Génération de bulletins janvier (1621€ net) et février (1681€ net) →
     `GET /paie-rh/bulletins/cumul-annuel?...&mois=2` → total 3302€ exact ; duplicata
     (BUL-007) du bulletin de janvier créé ensuite → cumul recalculé **toujours 3302€**
     (pas de double comptage, dédoublonnage confirmé).
- **Frontend, vérifié dans un vrai navigateur Chromium (Playwright) contre cet
  environnement isolé** (script de vérification temporaire, supprimé après usage — non
  présent dans le diff final) :
  1. Ouverture du dialogue depuis le hub `/rh/paie` (bouton dédié sur une ligne du cycle) —
     titre affiché correctement ("Bulletin du salarié — Jean Dupont").
  2. Les 6 onglets cliquables sans erreur console/JS.
  3. Ajout d'une ligne de prime manuelle (75€) dans "Autres variables", clic "Recalculer" →
     l'onglet "Bulletin calculé" reflète bien le brut/net mis à jour (2075€ de brut avec la
     prime, contre 2000€ de salaire de base), colonnes Période et Cumul annuel affichées
     côte à côte avec les bonnes valeurs.
  4. Onglet "Rubriques" : la ligne `SECU_MALADIE` affiche bien "Nombre: -" (type de calcul
     `BASE_X_TAUX`, sans "Nombre" pertinent — gating correct), le bouton "Surcharger la
     part salariale" ouvre bien le mini-formulaire d'override.
  5. **Navigation Suiv./Préc. avec 2 salariés dans le cycle** : clic "Suiv." fait passer le
     titre de "Jean Dupont" à "Marie Martin", "Préc." revient à "Jean Dupont" — vérifié par
     comparaison de texte avant/après, pas juste par présence des boutons.
  6. Scan automatique de tous les `button[mat-icon-button]` du dialogue → 0 sans
     `aria-label` (3 puis 4 boutons scannés selon l'état, tous corrects).
  7. Fermeture du dialogue (bouton X) sans erreur, pas de fuite d'état bloquant la
     navigation suivante.
  8. Ouverture du même dialogue depuis le second point d'entrée (onglet "Contrat & Paie"
     de la fiche salarié) — fonctionne également.
- `npx tsc --noEmit` (backend, frontend) et `npx nest build` / `npx ng build
  --configuration=production` (dernière exécution, état final propre) : **0 erreur**
  attribuable à cette fonctionnalité (mêmes avertissements préexistants non liés,
  documentés plus haut dans ce fichier).
- `npx playwright test --list frontend/e2e/paie-rh-module.spec.ts` : **6 tests détectés**
  (5 précédents + `PAIE-RH-6`, nouveau, syntaxiquement valide).

### Ce qui n'a PAS été exécuté — dit honnêtement

- Le fichier **permanent** `frontend/e2e/paie-rh-module.spec.ts` (avec le nouveau test
  `PAIE-RH-6`, écrit selon les conventions du dépôt — `loginViaApi`/`TEST_TENANT`, ports
  3000/4200) n'a **pas** été exécuté tel quel dans cette session — il suppose le tenant
  `test-e2e` déjà provisionné sur l'environnement de dev habituel (ports 3000/4200), que
  cette session n'a délibérément pas touché. C'est un environnement **différent** (ports
  3011/4212/5433, tenant `test-bulletin` créé ad hoc) qui a servi à la vérification
  réelle décrite ci-dessus — le comportement UI vérifié est donc bien réel, mais via un
  script de vérification temporaire équivalent plutôt que via ce fichier précis. Seul
  `npx playwright test --list` confirme que `PAIE-RH-6` est syntaxiquement valide et
  détecté.
- Aucune vérification de la génération PDF avec les nouvelles données (`nombreSalarial`/
  `nombrePatronal`) — le PDF n'affiche de toute façon pas de colonne "Nombre"
  (`construirePdf()` non modifié par cette tâche), donc sans impact, mais non testé
  explicitement.
- Le comportement du dialogue en cas de perte de connexion réseau pendant un recalcul, ou
  de conflit de concurrence (deux utilisateurs éditant le même bulletin simultanément) —
  non testé, non traité spécifiquement (dernier "recalculer" gagnant, comme le reste du
  module).

## Refonte PDF ~Sage + "Visualiser"/"Imprimer" (tâche suivante)

### ⚠️ Incident d'environnement rencontré en tout début de tâche

Le briefing de cette tâche affirmait que le module Paie RH interne existait déjà dans le
worktree assigné à cet agent. **C'était faux** : ce worktree (`agent-a3cfb28cb57be0c49`)
avait été créé depuis un point de l'historique **antérieur** à l'introduction du module
(branche `worktree-agent-a3cfb28cb57be0c49`, pointant sur `main`/2f95406, qui ne contient
ni `backend/src/paie-rh/`, ni les entités associées, ni `frontend/.../paie-rh/`) — tout ce
module n'existe, à ce jour, que comme fichiers **non commités** dans le checkout partagé
`/datas/Projets/Aro` (branche `feature/v2-retours-client`). Un `git log` ciblé confirme
qu'aucun commit, sur aucune branche accessible, n'a jamais introduit `backend/src/paie-rh`.

**Correctif appliqué (avant tout travail de la tâche elle-même)** : le module complet
(backend `paie-rh/` + 8 entités dépendantes + frontend `features/paie-rh/` +
`core/services/paie-rh.service.ts`) a été **copié** (`cp -r`, pas un merge/rebase git —
les opérations git ciblant le checkout partagé sont bloquées pour un agent isolé dans un
worktree) depuis le checkout partagé vers ce worktree, puis câblé : `app.module.ts`
(import + enregistrement `PaieRhModule`), `app.routes.ts` (routes `rh/paie` et
`rh/mes-bulletins`), `salaries-detail.component.ts` (onglet "Contrat & Paie", 5 points
d'insertion identifiés par diff ciblé pour ne PAS ramener les autres changements non liés
du checkout partagé — ex: onglets "Galerie"/"Tâches récurrentes", module Travail/Saisie
temps, qui restent hors périmètre). `node_modules` (backend et frontend) ont été
**symlinkés** depuis le checkout partagé plutôt que réinstallés (`package.json`/
`package-lock.json` strictement identiques entre les deux, disque contraint à ~3,9 Go
libres) — sans impact sur le résultat, aucune écriture n'est faite dans ces répertoires.
`Doc/MODULE_PAIE_RH_NOTES.md` et `frontend/e2e/paie-rh-module.spec.ts` (déjà existants
dans le checkout partagé) ont été copiés à l'identique avant d'être complétés par cette
tâche. **Aucune autre différence entre le worktree et le checkout partagé n'a été
importée** (vérifié fichier par fichier avant copie).

### 1. Nouveaux champs `TenantConfig` (mentions légales employeur)

Ajoutés à `backend/src/entities/tenant-config.entity.ts`, tous **nullable, vides par
défaut, aucune valeur inventée pour AFYM** :

| Colonne | Origine / équivalent Sage | Modifiable via |
|---|---|---|
| `adresse` | Adresse de l'établissement (bloc "FICHE DE PAIE") | `PATCH /tenant/config` (déjà générique, `dto: any` — aucun changement de contrôleur nécessaire) |
| `telephone` | "N° Tél" | idem |
| `numeroImmatriculationEmployeur` | "N° Cnaps" (Madagascar) — **nom générique volontaire** puisque l'organisme change selon le régime (Réunion/Madagascar) | idem |
| `numeroRegistreCommerce` | "N° RCS" | idem |
| `numeroIdentifiantFiscal` | "N° NIF" | idem |

Aucune UI d'administration dédiée n'a été créée pour ces champs : en cohérence avec
l'existant, `ville`/`pays`/`couleurPrimaire` (déjà sur `TenantConfig`) n'ont eux non plus
aucun formulaire dédié — seul l'assistant de setup initial (`setup-wizard.component.ts`)
édite `nomSociete`/`slogan`/`logoUrl`/`poleLabel1-2`/`poleFlag1-2`. **Recommandation** :
créer un écran "Paramètres du cabinet" pour que la direction renseigne ces 5 champs (et
les autres champs `TenantConfig` déjà orphelins d'UI) — hors périmètre de cette tâche.
Tant qu'un champ est vide, le PDF affiche `à renseigner` (fonction `aRenseigner()`,
`bulletins-salarie.service.ts`) plutôt qu'un blanc silencieux.

`frontend/src/app/core/models/tenant.model.ts` a été complété avec ces 5 champs
(optionnels) pour le typage, sans changement de comportement.

### 2. Champs affichés sur le nouveau PDF — origine exacte de chacun

| Zone du PDF | Champ affiché | Origine (entité.champ) | Note |
|---|---|---|---|
| En-tête gauche | Nom société, adresse, tél., n° immat. employeur, RCS, NIF | `TenantConfig.nomSociete/adresse/telephone/numeroImmatriculationEmployeur/numeroRegistreCommerce/numeroIdentifiantFiscal` | "à renseigner" si vide |
| En-tête droite | Période du ... au ... | Calculé depuis `BulletinSalarie.mois/annee` (1er et dernier jour du mois) | — |
| Matricule | `User.matricule` | déjà existant | |
| Niveau / Statut | `User.statut` (CADRE/NON_CADRE/EMPLOYE/AGENT_MAITRISE) | **Champ le plus proche existant**, PAS un nouveau concept "niveau" — voir consigne de la tâche | Libellé "Niveau / Statut" pour ne pas prétendre à un concept plus précis que ce qui existe réellement |
| Ancienneté | `max(ContratTravail.dateDebut, User.dateEntree)` en fait `min(...)` le plus ancien | Calculé, PAS de champ statique ajouté | contrat lié au bulletin (`contratTravailId`) si connu, sinon contrat actif du salarié (repli pour anciens bulletins) |
| N° immatriculation sociale | `User.numeroSS` | déjà existant | Libellé générique (pas "N° CNaPS", spécifique Madagascar) |
| Horaire | `ParametrePaieRh` code `HEURES_LEGALES_MOIS` (régime du bulletin) | **même paramètre que le moteur de calcul**, pas redéfini | |
| Emploi occupé | `User.poste` | déjà existant | |
| Salaire (devise) | `BulletinSalarie.salaireBase`, devise = `User.devise` | | |
| Service | — | **Aucun champ équivalent existant** — laissé vide (case toujours affichée, contenu "-") ; ajouter un nouveau champ `User.service` a été jugé non trivial (introduirait un concept RH supplémentaire sans demande explicite ni champ analogue) — à la discrétion d'une décision produit ultérieure | |
| Département | `User.departement` | déjà existant | |
| Enfant(s) | `User.nbEnfantsCharge` | déjà existant | |
| Commentaire | — | Laissé vide (case affichée, "-") — `VariablePaieRh.commentaire` existe mais porte un commentaire de **saisie de variables mensuelles**, pas un commentaire de bulletin à proprement parler ; l'associer ici aurait pu induire en erreur (voir "rien n'est inventé sans le signaler") | |
| Congés — Acquis/Reste/Pris | `CongesAbsencesService.getSoldes(salarieId, annee)`, entrée `TypeConge.CONGES_PAYES` (type standard retenu, documenté) | `Reste = Acquis - Pris` (consigne explicite de la tâche — ignore volontairement `joursEnAttente`, à la différence du champ `solde` déjà calculé par `getSoldes()` qui le soustrait) | |
| 3 lignes "Congés : du ... au ..." | `CongesAbsencesService.findAll({userId, statut: APPROUVEE, annee})`, filtré sur le mois du bulletin, 3 premières | Si moins de 3 congés réels sur le mois, lignes restantes affichées en pointillés (comme l'exemplaire Sage vierge) | |
| Identité + adresse salarié | `User.sexe` (civilité M./Mme), `firstName`, `lastName`, `adresse`/`codePostal`/`ville`/`pays` | | |
| Devise (bandeau) | `User.devise` (EUR/MGA/USD) → libellé €/Ar/$ | **PAS forcé à "Ar"** comme l'exemplaire photographié | |
| Tableau RUBRIQUE | `code`, `libelle` = **ceux de la `RubriquePaieRh` réelle** (jamais "CNaPS"/"OSTIE"/"IGR" en dur) | 1ère ligne synthétique "Salaire de base" (pas une `RubriquePaieRh`) : NB = nombre de jours calendaires du mois (`dernierJour.getDate()`), faute d'un concept "jours travaillés" distinct dans le moteur | |
| PART SALARIALE / PART PATRONALE | `LigneBulletinRh.nombreSalarial/tauxSalarial/montantSalarial` et patronal équivalents | déjà produits par le moteur, seulement réarrangés en colonnes | |
| Cumuls (pied) | Sal.Br=`totalBrut`, Net.Imp=`netImposable`, Ch.Sal=`totalCotisationsSalariales`, Ch.Pat=`totalCotisationsPatronales`, Hrs trav.=même `HEURES_LEGALES_MOIS` qu'"Horaire" (pas de suivi distinct des heures réellement travaillées), Av.Nat.=recalculé **best-effort** depuis `VariablePaieRh.avantagesNature` via `bulletin.variablePaieRhId` (peut différer si la variable a été modifiée après génération — limitation documentée, pas un champ persisté sur le snapshot `BulletinSalarie`), NET=`netAPayer` | La ligne "Fmg" (double devise historique malgache) de l'exemplaire d'origine n'est **volontairement pas reproduite** (hors sujet, spécifique à une société) | |
| Mentions légales | "Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée." | Reprise telle quelle de l'exemplaire Sage : déjà générique, valable Réunion et Madagascar (pas franco-centrée) | Remplace l'ancienne mention plus longue et plus juridique (jugée moins fidèle à la référence fournie) |
| Signatures | Blocs "Employeur," / "Employé," avec espace | inchangé dans l'esprit (déjà prévu avant cette tâche, redessiné en 2 colonnes) | |

### 3. Formatage des montants (PDF, hors Angular)

`BulletinsSalarieService.formatMontant()` : séparateur de milliers **espace**, virgule
décimale, toujours 2 décimales (ex: `1 795 300,00`) — implémenté à la main (regex sur la
partie entière), le PDF étant généré **côté serveur** via `pdfmake`, hors du contexte
Angular/`LOCALE_ID` (qui reste utilisé tel quel côté Angular pour tout affichage écran,
inchangé par cette tâche).

### 4. Deux corrections trouvées en relisant un vrai PDF généré (pas seulement le code)

- **Colonne "N°" trop étroite** (30pt) : les codes de rubrique un peu longs
  (`TOTAL_BRUT_MENSUEL`, `INDEMNITE_TRANSPORT`...) s'empilaient caractère par caractère.
  Corrigé (58pt + taille de police du tableau réduite à 8pt).
- **Emoji ⚠️ dans le texte d'avertissement placeholder** : la police Helvetica standard
  embarquée par `pdfmake` n'a pas ce glyphe → rendu en caractères mojibake dans le PDF
  (`& þ` observé). Remplacé par le préfixe texte `ATTENTION —`. Ce problème existait déjà
  **avant** cette tâche sur cette même ligne (non détecté alors, faute d'avoir relu un
  vrai PDF) — corrigé à l'occasion.

### 5. Fonctionnalité "Visualiser" + "Imprimer"

Nouveau composant `frontend/src/app/features/paie-rh/bulletin-pdf-preview-dialog.component.ts`
(`BulletinPdfPreviewDialogComponent`) : dialogue Material (mêmes conventions que
`BulletinSalarieDialogComponent` — `rounded-dialog`/`no-pad-dialog`), reçoit un `Blob`
déjà téléchargé (`MAT_DIALOG_DATA`, **aucun appel réseau propre au dialogue** — le blob
vient du même endpoint que "Télécharger le PDF", `responseType: 'blob'`), l'affiche via
`URL.createObjectURL()` + `DomSanitizer.bypassSecurityTrustResourceUrl()` dans un
`<iframe>` (au lieu de créer un `<a download>` et de cliquer dessus). Le bouton
"Imprimer" appelle `iframe.contentWindow.print()` **après** l'évènement `(load)` de
l'iframe (bouton désactivé tant que le PDF n'est pas chargé, pour éviter un
`print()` sur un contenu vide). `URL.revokeObjectURL()` sur `ngOnDestroy`. Tous les
boutons icône ont un `aria-label` (règle déjà source de bugs signalée dans ce module).

Ajouté à **3 endroits**, à côté du bouton "Télécharger le PDF" existant (jamais retiré) :

1. `paie-rh-salarie-tab.component.ts` — bouton "Visualiser le bulletin" dans la table des
   bulletins de la fiche salarié.
2. `mes-bulletins.component.ts` — idem, portail self-service salarié.
3. `paie-rh-hub.component.ts` (écran Cycle mensuel) — **aucun bouton "Télécharger le PDF"
   n'existait déjà ici avant cette tâche** (vérifié par recherche exhaustive dans le
   code : seul un bouton "Ouvrir le bulletin détaillé", qui ouvre le dialogue à 6 onglets,
   existait sur la table des salariés du cycle). Un bouton "Visualiser" a néanmoins été
   ajouté (jugé utile : aperçu rapide sans ouvrir le dialogue complet), affiché **uniquement**
   quand `SalarieATraiter.bulletinId` est renseigné (bulletin déjà généré pour ce
   salarié/cette période) — pas de bouton "Télécharger" ajouté ici, la tâche demandant
   seulement d'évaluer la pertinence d'un bouton de visualisation à cet endroit.

### 6. Tests — état réel, sans rien inventer

- `npx tsc --noEmit` (backend et frontend) : **0 erreur** imputable à cette tâche (backend :
  0 erreur du tout hors fichiers `.spec.ts`/`test/app.e2e-spec.ts` préexistants, sans
  lien avec cette tâche — problèmes de typage Jest/Supertest déjà présents avant toute
  intervention ; frontend : 0 erreur, aucune sortie).
- `npx nest build` (backend) et `npx ng build --configuration=production` (frontend) :
  **les deux passent**, seuls des avertissements préexistants et sans rapport (budget de
  bundle, dépendances CommonJS de `canvg`/`jspdf`/`leaflet`, `NG8102`/`NG8113` sur
  d'autres composants).
- **PDF relu visuellement, à deux reprises, sur un vrai document généré** (pas seulement
  vérification de compilation) : environnement isolé monté ad hoc — PostgreSQL 16
  (Docker, conteneur `paie-rh-test-pg`, port **5434**, détruit après usage), backend NestJS
  sur le port **3011** (`.env` local au worktree, jamais commité, `DB_SYNC=true`), tenant
  `test-bulletin` créé via `/api/setup`, un salarié de test seedé avec des données proches
  de l'exemplaire photographié (matricule, n° immatriculation sociale, statut, devise MGA,
  adresse, date d'entrée, congés réels via le vrai circuit congés/absences). Deux
  bulletins générés (août puis septembre 2026) et téléchargés en PDF réel, lus avec l'outil
  de lecture PDF de cet agent : premier passage a révélé les 2 problèmes de rendu listés
  au point 4 ci-dessus, corrigés, puis **re-générés et re-relus** pour confirmer la
  correction. Aucun port/service de la session de développement de l'utilisateur
  (3000/4200/5432/9000) n'a été touché à aucun moment (vérifiés libres/occupés par
  l'utilisateur avant et après, jamais utilisés par cet agent).
- **Fonctionnalité "Visualiser"/"Imprimer" testée réellement dans un vrai navigateur
  Chromium (Playwright)**, contre ce même environnement isolé (backend :3011, PostgreSQL
  :5434, frontend Angular servi en mode dev sur le port **4212** — `environment.ts`
  temporairement pointé vers `:3011` le temps du test, puis **restauré** vers `:3000`
  avant la fin de la tâche ; CORS backend temporairement élargi à `:4212` via
  `FRONTEND_URL` dans le `.env` isolé, jamais dans un fichier commité) : les **3
  emplacements** ont été vérifiés avec un compte réel (admin pour la fiche salarié et le
  hub, le salarié de test lui-même — rôle COLLABORATEUR — pour `/rh/mes-bulletins`) :
  bouton "Visualiser" visible et cliquable à côté du bouton "Télécharger le PDF" existant
  (non retiré), ouverture du dialogue, `<iframe>` chargé avec une URL `blob:` (confirmé
  par lecture de l'attribut `src`, donc bien affiché et non téléchargé), bouton
  "Imprimer" désactivé puis activé après chargement, clic déclenchant réellement
  `iframe.contentWindow.print()` (vérifié par une sonde JS injectée sur `contentWindow.print`),
  aria-label présents, fermeture du dialogue fonctionnelle. Ces 3 vérifications ont été
  faites via des scripts Playwright **temporaires** (créés puis supprimés du dépôt en fin
  de tâche, jamais commités) — le fichier **permanent** `frontend/e2e/paie-rh-module.spec.ts`
  a été complété avec les tests `PAIE-RH-7/8/9` équivalents, selon les conventions du
  dépôt (ports 3000/4200, tenant `test-e2e`), mais **n'a pas été exécuté tel quel** dans
  cette session (même limitation que `PAIE-RH-6` documentée plus haut) — confirmé
  seulement syntaxiquement valide via `npx playwright test --list` (8 tests détectés :
  5 précédents + `PAIE-RH-6` déjà existant + `PAIE-RH-7`/`8`/`9` nouveaux).
- **Ce qui n'a PAS été vérifié** : le rendu du PDF avec un jeu de rubriques non-placeholder
  (validées par un expert paie) — sans objet tant qu'aucune n'existe ; le comportement
  d'impression réel (ouverture de la boîte de dialogue OS d'impression) — Playwright/
  Chromium ne peut pas piloter cette boîte de dialogue native, seule l'invocation de
  `window.print()` a pu être vérifiée (remplacée par une sonde pour le test automatisé) ;
  le rendu du PDF avec une devise EUR/USD (testé uniquement en MGA, comme l'exemplaire de
  référence) ; le comportement si `TenantConfig` est totalement vide (tous les champs à
  "à renseigner" simultanément) — testé uniquement avec `numeroImmatriculationEmployeur`
  vide, les 4 autres renseignés.
