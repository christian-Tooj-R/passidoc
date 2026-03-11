# TODO — Plateforme DPD AFYM
> Stack : Angular + NestJS + MySQL (TypeORM)

---

## PHASE 1 — Initialisation & Architecture (Semaine 1)

### Setup du projet
- [ ] Créer le monorepo (ex: Nx workspace ou deux dossiers `frontend/` `backend/`)
- [ ] Initialiser le projet NestJS (`nest new backend`)
- [ ] Initialiser le projet Angular (`ng new frontend`)
- [ ] Configurer ESLint + Prettier sur les deux projets
- [ ] Configurer les variables d'environnement (`.env`) NestJS
- [ ] Mettre en place le fichier `.gitignore` et initialiser le dépôt Git

### Base de données MySQL
- [ ] Installer et configurer MySQL en local
- [ ] Configurer TypeORM dans NestJS (`TypeOrmModule`)
- [ ] Définir les entités principales :
  - [ ] `User` (collaborateur / expert-comptable / admin)
  - [ ] `Client` (dossier client)
  - [ ] `FicheIdentite` (infos légales et humaines)
  - [ ] `FluxMensuel` (relevés, rapports de vente, règlements)
  - [ ] `Document` (fichiers stockés)
  - [ ] `Fournisseur` (annuaire)
  - [ ] `SyntheseCloture` (analyse financière)
  - [ ] `ConversationIA` (historique des échanges IA par dossier)
  - [ ] `Role` + `Permission`
- [ ] Générer et tester les premières migrations TypeORM

---

## PHASE 2 — Back-end NestJS (Semaines 2-4)

### Module Auth
- [ ] Installer `@nestjs/jwt`, `@nestjs/passport`, `bcrypt`
- [ ] Implémenter l'inscription / connexion avec JWT
- [ ] Implémenter le **2FA (TOTP)** avec `speakeasy` + QR code
- [ ] Créer les Guards : `JwtAuthGuard`, `RolesGuard`
- [ ] Créer le décorateur `@Roles('ADMIN', 'COLLABORATEUR', ...)`
- [ ] Tester les endpoints auth (Postman / Thunder Client)

### Module Users
- [ ] CRUD utilisateurs (admin seulement)
- [ ] Assignation des rôles
- [ ] Endpoint profil (`GET /users/me`)

### Module Clients (Dossiers)
- [ ] CRUD dossiers clients
- [ ] Endpoint liste des dossiers avec pagination et recherche
- [ ] Calcul du **score "Santé de Passation"** (% de complétion du dossier)
- [ ] Gestion multi-sites : champ `site` (`REUNION` | `MADAGASCAR`)

### Module Fiche d'Identité
- [ ] CRUD fiche identité (logo, SIREN/SIRET, surface commerciale)
- [ ] Gestion de la structure humaine (gérants, salariés)
- [ ] Upload du logo client

### Module Pilotage Opérationnel
- [ ] CRUD flux mensuels (relevés bancaires, rapports de vente, règlements)
- [ ] Système d'**alertes de dépôt** : détection fichier manquant ou en retard
- [ ] CRUD annuaire fournisseurs

### Module Analyse Financière
- [ ] CRUD synthèse de clôture (points IS, EBE, N-1)
- [ ] CRUD spécificités fiscales (ZFA, flux d'espèces, zones de risques)
- [ ] CRUD outils d'analyse (Business Model, stratégie de vente)

### Module Documents (Stockage)
- [ ] Configurer **MinIO** (ou stockage local sécurisé)
- [ ] Upload de fichiers (`Multer`)
- [ ] Chiffrement des fichiers au repos
- [ ] Download sécurisé avec contrôle d'accès
- [ ] Suppression de documents

### Module IA (Assistant Dossier)
- [ ] Intégrer l'**API Claude (Anthropic)**
- [ ] Créer un thread de conversation par dossier client
- [ ] Endpoint `POST /ia/:clientId/chat` (envoyer un message)
- [ ] Endpoint `GET /ia/:clientId/history` (récupérer l'historique)
- [ ] Injecter le contexte du dossier dans le prompt système de l'IA
- [ ] Endpoint **résumé de passation** (`GET /ia/:clientId/summary`)

### Module Export PDF
- [ ] Installer `pdfmake` ou `puppeteer`
- [ ] Générer une **"Note de Passation" PDF** par dossier
- [ ] Endpoint `GET /clients/:id/export-pdf`

---

## PHASE 3 — Front-end Angular (Semaines 3-5)

### Setup Angular
- [ ] Installer Angular Material (`ng add @angular/material`)
- [ ] Configurer le routing principal (lazy loading par module)
- [ ] Configurer `HttpClient` + intercepteur JWT (ajout du token dans les headers)
- [ ] Intercepteur de gestion des erreurs HTTP (401, 403, 500)
- [ ] Service d'authentification (`AuthService`)
- [ ] Guard Angular (`AuthGuard`, `RoleGuard`)

### Pages Auth
- [ ] Page Login (email + mot de passe)
- [ ] Page configuration 2FA (QR code + code TOTP)
- [ ] Page vérification 2FA (à chaque connexion)

### Layout général
- [ ] Sidebar de navigation (rôle-dépendante)
- [ ] Header (profil utilisateur, site actif, déconnexion)
- [ ] Page 404

### Dashboard principal
- [ ] Liste des dossiers clients (cards avec score de passation)
- [ ] Barre de recherche et filtres (site, score, statut)
- [ ] Indicateur visuel du score "Santé de Passation" (barre de progression colorée)
- [ ] Alertes globales (fichiers manquants sur tous les dossiers)

### Page Dossier Client
- [ ] Onglet **Fiche d'Identité** (formulaire Reactive Forms)
- [ ] Onglet **Pilotage Opérationnel**
  - [ ] Tableau des flux mensuels avec indicateurs de couleur
  - [ ] Annuaire fournisseurs (CRUD)
- [ ] Onglet **Analyse Financière**
  - [ ] Formulaire synthèse de clôture
  - [ ] Spécificités fiscales
- [ ] Onglet **Documents** (upload, liste, téléchargement, suppression)
- [ ] Onglet **Assistant IA** (interface chat)
- [ ] Bouton **Exporter Note de Passation PDF**

### Page Administration (Admin uniquement)
- [ ] CRUD utilisateurs
- [ ] Assignation des rôles
- [ ] Vue globale multi-sites (La Réunion / Madagascar)

---

## PHASE 4 — Sécurité & Tests (Semaine 6)

### Sécurité
- [ ] Activer CORS correctement (whitelist domaines)
- [ ] Helmet.js (headers HTTP sécurisés)
- [ ] Rate limiting (`@nestjs/throttler`) sur les endpoints sensibles
- [ ] Validation des inputs (`class-validator`, `class-transformer`)
- [ ] Vérifier les droits d'accès sur chaque endpoint (tests manuels par rôle)
- [ ] Chiffrement des documents MinIO

### Tests
- [ ] Tests unitaires NestJS (services critiques : Auth, IA, Export PDF)
- [ ] Tests e2e NestJS (flux principaux)
- [ ] Tests de montée en charge (wrk ou Artillery)
- [ ] Tests manuels multi-rôles (collaborateur, expert-comptable, admin)

---

## PHASE 5 — Déploiement (Semaine 7)

- [ ] Créer les `Dockerfile` pour Angular et NestJS
- [ ] Créer le `docker-compose.yml` (Angular, NestJS, MySQL, MinIO)
- [ ] Configurer les variables d'environnement de production
- [ ] Configurer un reverse proxy (Nginx)
- [ ] Configurer les certificats SSL (Let's Encrypt)
- [ ] Déploiement sur serveur (VPS ou serveur interne AFYM)
- [ ] Tester le déploiement complet

---

## PHASE 6 — Livrables Mémoire M2

- [ ] Rédiger l'architecture technique (schéma BDD, diagrammes)
- [ ] Documenter l'API (Swagger avec `@nestjs/swagger`)
- [ ] Rédiger le guide utilisateur
- [ ] Rédiger la documentation sécurité (2FA, chiffrement, droits)
- [ ] Préparer la démo pour le jury

---

## Suggestions supplémentaires (bonus)
- [ ] Notifications en temps réel (WebSocket NestJS) pour les alertes de dépôt
- [ ] Gestion des fuseaux horaires (La Réunion UTC+4 / Madagascar UTC+3)
- [ ] Historique des modifications sur chaque dossier (audit log)
- [ ] Dark mode sur l'interface Angular
