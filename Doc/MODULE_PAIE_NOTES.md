# Module Paie — Employés des clients AFYM

## Objet et périmètre

Ce module ajoute la gestion de la paie pour les **employés des entreprises CLIENTES
d'AFYM** — le périmètre concerné est celui des clients dont la fiche identité indique
`cycleChargesPaie.gestionPaie = "Internalisée cabinet"` (cabinet gère la paie pour le
compte du client). Il va de la saisie des employés jusqu'à la génération d'un bulletin
de paie PDF.

**⚠️ À ne pas confondre avec le module RH interne existant** (`backend/src/entities/salarie.entity.ts`,
`frontend/src/app/features/salaries/`, `frontend/src/app/features/conges-absences/`), qui
gère les **collaborateurs internes AFYM** (congés, soldes de congés). Ce module-là n'a
pas été modifié — seulement consulté pour s'inspirer du style d'entités/composants.

Il ne faut pas non plus confondre avec TACHE-11 de `TACHES_V2.md` ("RH — Variables de
paie", statut EN ATTENTE — Validation Alvin), qui concerne l'export des absences
internes AFYM vers un prestataire de paie externe pour la paie DES COLLABORATEURS AFYM
eux-mêmes. Ce sujet est distinct, toujours en attente de décision de la direction, et
n'est pas traité ici.

## Aucune source officielle pour les barèmes réels

Le CDC officiel (`CDC AFYM - MEMOIRE ARO.pdf`) ne mentionne **aucun** module de paie —
il ne cite que « l'organigramme des salariés » dans la fiche d'identité (structure
humaine). `TACHES_V2.md` liste `gestionPaie` comme champ existant mais ne fournit aucun
barème. **Aucun taux de cotisation réel (URSSAF/DSN Réunion, CNaPS/OSTIE Madagascar)
n'a été trouvé dans le dossier** et aucun n'a été inventé comme s'il était exact.

Toutes les valeurs numériques insérées automatiquement dans ce module (taux de
cotisations, plafond sécu, diviseur horaire mensuel, taux de majoration heures sup)
sont des **valeurs d'exemple (placeholders)**, marquées `estPlaceholder: true` en base,
avec un avertissement visible dans l'UI et dans le PDF généré. **Elles doivent être
validées par un expert paie / la direction avant toute mise en production réelle.**

## Principe d'architecture : rien n'est codé en dur

Conformément à la demande explicite : le moteur de calcul ne contient **aucune règle
conditionnelle "if site === REUNION"**. Tout passe par deux tables de paramétrage,
sélectionnées via un champ `regimePaieCode` (string libre, initialisé depuis
`client.site` — `REUNION`/`MADAGASCAR` — mais éditable/étendable à tout autre code) :

- **`RubriquePaie`** (`paie_rubriques`) : lignes de bulletin paramétrables (nom, base de
  calcul BRUT/SALAIRE_BASE/FIXE, taux salarial/patronal ou montant fixe, plafond
  optionnel, imputation COTISATION/PRIME/RETENUE/AUTRE, ordre d'affichage). Éditable
  depuis l'API `paie/rubriques` (réservé ADMIN/EXPERT_COMPTABLE).
- **`ParametrePaie`** (`paie_parametres`) : constantes scalaires utilisées par le moteur
  (durée légale mensuelle, taux de majoration HS par défaut, plafond sécu indicatif).
  Éditable depuis `paie/parametres`.

Un tenant qui n'a encore aucune ligne dans ces deux tables se voit générer
automatiquement un jeu d'exemple au premier accès (`estPlaceholder: true`), uniquement
pour rendre le parcours démontrable de bout en bout sans configuration préalable. Dès
qu'au moins une ligne existe, l'auto-seed ne se redéclenche plus.

## Modèle de données

- `EmployeClient` (`paie_employes_clients`) : employé d'un client (matricule, nom,
  prénom, poste, dates d'entrée/sortie, type de contrat, salaire de base mensuel brut,
  quotité de travail en %, `regimePaieCode`).
- `VariablePaie` (`paie_variables_mensuelles`) : variables saisies par employé et par
  mois/année (heures sup + taux de majoration éventuellement surchargé, primes,
  absences, avantages en nature, retenues diverses — chacune une liste libre
  `{ libelle, montant }`, commentaire, statut).
- `RubriquePaie` / `ParametrePaie` : paramétrage (voir ci-dessus).
- `BulletinPaie` (`paie_bulletins`) : **snapshot figé** du calcul au moment de la
  génération (`detailRubriques` en JSON). Si les rubriques/paramètres sont modifiés
  ensuite, les bulletins déjà générés ne changent pas rétroactivement — traçabilité.

## Moteur de calcul (`backend/src/paie/moteur-calcul-paie.service.ts`)

Étapes, dans l'ordre :

1. `salaireBaseMensuel` = `EmployeClient.salaireBase` tel quel (voir limitation quotité
   ci-dessous).
2. `montantHeuresSupplementaires` = `(salaireBase / heuresLegalesMois) × (1 + tauxMajorationHS / 100) × heuresSupplementaires`.
3. `totalBrut` = `salaireBase − absences + heuresSup + primes(variables) + avantagesNature`.
4. Chaque `RubriquePaie` active pour le régime de l'employé calcule une base (BRUT,
   SALAIRE_BASE ou FIXE, plafonnée si `plafondMensuel` renseigné), puis
   `montantSalarial`/`montantPatronal` (taux % ou montant fixe).
5. `totalCotisationsSalariales` / `totalCotisationsPatronales` = somme des lignes
   `imputation = COTISATION`.
6. `netImposable` = `totalBrut − totalCotisationsSalariales`.
7. `netAPayer` = `netImposable − avantagesNature − retenuesDiverses(saisies) − retenues(rubriques) + primes/indemnités(rubriques)`.

### Hypothèses de simplification prises (à valider avec un expert paie)

- **CSG/CRDS** : traitée comme une cotisation salariale simple dans `netImposable`,
  sans distinguer la part déductible de la part non déductible fiscalement (en France
  réelle, une petite fraction de CSG/CRDS n'est pas déductible du revenu imposable).
- **Heures supplémentaires** : aucune exonération sociale/fiscale partielle n'est
  modélisée (en France, les HS bénéficient d'exonérations spécifiques sous plafond).
  Elles sont simplement ajoutées au brut avec majoration.
- **Quotité de travail** (`EmployeClient.quotiteTravail`) : champ informatif en v1. Le
  `salaireBase` saisi est supposé déjà refléter la quotité contractuelle — il n'y a pas
  de recalcul automatique proportionnel. Un changement de quotité en cours de mois
  n'est pas géré.
- **Absences** : modélisées comme un montant déduit directement du brut (saisi
  manuellement dans les variables du mois), pas de calcul automatique
  jours/heures × taux journalier.
- **Prorata d'entrée/sortie en cours de mois** : non géré en v1.
- **Diviseur horaire mensuel** (151,67 h) et **taux de majoration HS par défaut** (25 %)
  sont les valeurs usuelles françaises (35h/semaine) — utilisées par défaut pour TOUS
  les régimes tant qu'aucune valeur différente n'est fournie pour un régime donné (rien
  de spécifique à Madagascar n'a été trouvé dans le dossier).
- **Aucune déclaration sociale réelle** (DSN, télédéclaration) n'est produite — hors
  périmètre, comme demandé.
- **Aucune intégration bancaire/virement** — hors périmètre, comme demandé.

### Rubriques placeholders générées par défaut

Voir `backend/src/paie/rubriques-paie.service.ts` (`RUBRIQUES_PLACEHOLDER`) et
`backend/src/paie/parametres-paie.service.ts` (`PARAMETRES_PLACEHOLDER`) pour la liste
exacte et les valeurs (sécurité sociale maladie, retraite de base, retraite
complémentaire, assurance chômage, CSG/CRDS, mutuelle forfaitaire ; plafond sécu
indicatif non branché par défaut). **Ces taux ne proviennent d'aucune source officielle
du dossier — ce sont des ordres de grandeur à faire vérifier.**

## Ce qui reste à valider avec la direction / un expert paie

1. Les taux réels de cotisations sociales Réunion (régime général / DSN) — actuellement
   des placeholders génériques de type « régime français métropolitain ».
2. Les taux réels de cotisations sociales Madagascar (CNaPS, OSTIE) — **aucune valeur
   n'a été insérée pour un régime `MADAGASCAR` distinct** ; actuellement les employés
   Madagascar utilisent les mêmes rubriques `TOUS` par défaut, ce qui n'est
   probablement pas correct et doit être corrigé en créant des rubriques dédiées
   `regimePaieCode = 'MADAGASCAR'` une fois les taux connus.
3. Le traitement fiscal exact de la CSG/CRDS (part déductible/non déductible).
4. Les règles d'exonération des heures supplémentaires.
5. La gestion du prorata d'entrée/sortie en cours de mois et des changements de
   quotité de travail en cours de mois.
6. Le circuit de validation des variables de paie (qui saisit, qui valide, avant
   génération du bulletin) — non modélisé au-delà d'un statut `BROUILLON` /
   `VALIDEE` / `BULLETIN_GENERE` sur `VariablePaie`, sans workflow d'approbation.
7. Les mentions légales exactes à faire figurer sur un bulletin de paie réel (une
   mention générique de conservation est présente dans le PDF, à faire valider par un
   juriste/expert paie avant usage réel).

## Choix techniques

- **PDF** : génération via `pdfmake`, déjà présent en dépendance backend
  (`backend/src/export/export.service.ts` l'utilise déjà pour la note de passation) —
  aucune nouvelle dépendance ajoutée.
- **Multi-tenant** : toutes les nouvelles entités portent un champ `tenantId` filtré
  explicitement dans chaque requête de service, à l'identique du reste du code
  (`SaisieTemps`, `TacheRecurrente`, `Client`, etc.).
- **Guards** : `JwtAuthGuard` + `RolesGuard` sur tous les contrôleurs ; les mutations
  sensibles (rubriques, paramètres, création/suppression d'employé, génération de
  bulletin) sont réservées aux rôles ADMIN/EXPERT_COMPTABLE (+ CHEF_ANTENNE/CHEF_MISSION
  pour les opérations courantes sur employés/variables), à l'identique du pattern
  observé dans `tache-recurrente.controller.ts`.

## Fichiers créés

Backend :
- `backend/src/entities/employe-client.entity.ts`
- `backend/src/entities/rubrique-paie.entity.ts`
- `backend/src/entities/parametre-paie.entity.ts`
- `backend/src/entities/variable-paie.entity.ts`
- `backend/src/entities/bulletin-paie.entity.ts`
- `backend/src/paie/` (module complet : `paie.module.ts`, 5 controllers, 5 services,
  `moteur-calcul-paie.service.ts`, `dto/`)
- `backend/src/app.module.ts` (modifié : enregistrement de `PaieModule`)

Frontend :
- `frontend/src/app/core/services/paie.service.ts`
- `frontend/src/app/features/clients/client-detail/tabs/paie-tab/paie-tab.component.ts`
- `frontend/src/app/features/clients/client-detail/client-detail.component.ts` (modifié :
  nouvel onglet "Paie" dans un groupe "RH & Paie")
- `frontend/e2e/paie-module.spec.ts` (test e2e Playwright du parcours complet)

Documentation :
- `Doc/MODULE_PAIE_NOTES.md` (ce fichier)

## Tests effectués

- `npx tsc --noEmit` (backend et frontend) : OK, aucune erreur introduite.
- `npx nest build` (backend) et `npx ng build --configuration=production` (frontend) : OK.
- Test manuel de bout en bout via l'API réelle (backend + PostgreSQL de dev) : création
  d'un employé, saisie de variables (heures sup, prime, avantage en nature, retenue),
  calcul d'aperçu, génération du bulletin, téléchargement et relecture du PDF généré —
  cohérence arithmétique vérifiée manuellement.
- Test e2e Playwright (`frontend/e2e/paie-module.spec.ts`) exécuté avec succès contre
  une instance réelle de l'application (backend + frontend + PostgreSQL) : parcours
  complet UI (ouverture de l'onglet Paie → ajout d'un employé → saisie d'une prime →
  calcul d'aperçu → génération du bulletin → présence dans l'historique).
