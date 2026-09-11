# Stack Technique — Passidoc

**Client :** AFYM Audit Expertise (La Réunion + Madagascar)
**Architecture :** Multi-tenant SaaS
**Mise à jour :** Août 2026

---

## Vue d'ensemble

Passidoc est une application SaaS multi-tenant pour cabinet d'expertise comptable. Un seul déploiement sert plusieurs cabinets. Chaque cabinet est identifié par un `slug` (sous-domaine ou paramètre URL). Toutes les entités (utilisateurs, clients, tâches…) portent un `tenantId` assurant l'isolation stricte des données.

**Flux général :**

```
[Navigateur Angular]  ──┐
                         ├──> Nginx (reverse proxy + SSL)
[Application Flutter] ──┘         |
                                   v
                          NestJS API (REST)
                          /        |        \
                    PostgreSQL   MinIO   Claude API
```

---

> L'infrastructure est portable : l'application tourne sur tout serveur Linux via Docker. Le choix de l'hébergeur (VPS, serveur dédié, cloud) est indépendant du code.

---

## 1. Frontend Web

**Framework :** Angular 21.2

- Composants standalone avec Signals (réactivité native Angular)
- Routing, guards, interceptors HTTP
- Build avec esbuild (rapide), configurations séparées : `development`, `production`, `render`

**UI :** Angular Material 21.2 + CDK
- Design system complet : tables, dialogs, formulaires, sidenav, snackbars
- Thème personnalisé SCSS aux couleurs AFYM

**Langages et outils :**
- TypeScript 5.9 — typage statique strict
- SCSS — styles composants et thème global
- RxJS 7.8 — gestion des flux asynchrones, observables, interceptors

**Graphiques :** Chart.js 4.5 + ng2-charts 10
- Balance comptable, pilotage, pointage, suivi dossiers

**Tests :** Playwright 1.62
- Tests end-to-end automatisés
- Mocking de routes API, tests d'intégration login/setup/tenant

---

## 2. Backend API

**Framework :** NestJS 11.0 (Node.js)
- Architecture modulaire avec injection de dépendances
- Guards, interceptors, middleware, pipes de validation
- Documentation API auto-générée via Swagger UI

**ORM :** TypeORM 0.3.28
- Entités décorées, relations, repositories
- Support PostgreSQL (prod) et MySQL (dev)
- Isolation multi-tenant via `tenantId` sur chaque entité

**Authentification :**
- Passport-JWT 4.0 + @nestjs/jwt 11.0 — tokens JWT (expiry 7j)
- bcrypt 6.0 — hashage des mots de passe (saltRounds: 10)
- speakeasy 2.0 + qrcode 1.5 — 2FA TOTP (Google Authenticator)

**Autres librairies :**
- Nodemailer 9.0 — emails transactionnels (notifications, invitations)
- MinIO SDK 8.0 — stockage fichiers S3-compatible
- class-validator 0.15 + class-transformer 0.5 — validation des DTOs
- @nestjs/config — gestion des variables d'environnement

**Modules métier (28 modules) :**

| Module | Rôle |
|---|---|
| auth | Connexion, JWT, 2FA |
| users | Gestion des utilisateurs et rôles |
| tenant | Configuration du cabinet |
| setup | Wizard d'installation multi-tenant |
| clients | Portefeuille clients |
| tasks | Tâches et suivi |
| pointage | Présences et horaires |
| secteurs | Secteurs d'activité |
| documents | Pièces jointes |
| storage | Upload/download MinIO |
| notifications | Alertes temps réel |
| missions | Missions et affectations |
| salaries | Gestion RH salaires |
| conges-absences | Congés et absences |
| balance | Balance comptable / FEC |
| audit | Piste d'audit |
| questionnaire-adn | Formulaires ADN entreprise |
| analyse-strategique | Analyse stratégique cabinet |
| notes | Notes collaborateurs |
| fiche-identite | Fiche identité client |
| flux-mensuel | Relevés et dépôts mensuels |
| synthese-cloture | Synthèses de clôture |
| objectifs | Objectifs cabinet |
| mail | Service email |
| help | Aide contextuelle |
| export | Export PDF/Excel |
| role-permissions | Permissions par rôle |
| ai-assistant | Intégration IA Claude |

---

## 3. Application Mobile

**Framework :** Flutter (Dart SDK ≥ 3.3.0)
- Cible Android et iOS depuis un seul codebase
- Material Design 3
- Consomme la même API REST que le frontend web

**Gestion d'état :** Riverpod 2.5 + riverpod_annotation 2.3
- Providers typés, code généré via `build_runner`

**Navigation :** go_router 13.2
- Navigation déclarative, deep linking, guards d'authentification

**HTTP :** Dio 5.4
- Client HTTP avancé
- Interceptors pour injection du JWT et du slug tenant

**Sécurité :** flutter_secure_storage 9.2
- Stockage sécurisé du JWT (Keychain iOS / Keystore Android)

**Sérialisation :** json_serializable 6.8 + json_annotation 4.9
- Modèles JSON générés automatiquement

---

## 4. Base de données

**Production :** PostgreSQL 16
- Hébergé sur Render (service managé)
- Ou en container Docker Alpine sur serveur dédié

**Développement local :** MySQL 8 (via mysql2 3.x)
- Plus simple à installer en local
- TypeORM abstrait la différence — le code est identique

**Variables d'environnement :**

| Variable | Valeur |
|---|---|
| DATABASE_URL | URL complète PostgreSQL (prod) |
| DB_TYPE | `postgres` (prod) ou `mysql` (dev) |
| DB_SYNC | `true` en dev, `false` en prod |

---

## 5. Stockage fichiers

**Outil :** MinIO (SDK v8.0)
- Object storage compatible S3
- Stockage de documents, pièces jointes, exports
- Container Docker en développement et production self-hosted
- Remplaçable par AWS S3 ou Scaleway sans changer le code — uniquement les variables d'env

**Variables :**

| Variable | Rôle |
|---|---|
| MINIO_ENDPOINT | Adresse du serveur MinIO |
| MINIO_ACCESS_KEY | Clé d'accès |
| MINIO_SECRET_KEY | Clé secrète |
| MINIO_BUCKET | Nom du bucket (`passidoc-documents`) |

---

## 6. Intelligence artificielle

**API :** Anthropic Claude (SDK Node.js)

Utilisée dans le module `ai-assistant` pour :
- Aide à la rédaction de synthèses comptables
- Analyse contextuelle des dossiers clients
- Questionnaires ADN entreprise
- Aide contextuelle aux collaborateurs

**Variable :** `ANTHROPIC_API_KEY`

---

## 7. Infrastructure & DevOps

### Docker

Deux fichiers Docker Compose :

**`docker-compose.yml`** — développement local
- Ports exposés en direct
- 4 services : `postgres`, `minio`, `backend`, frontend via `ng serve`

**`docker-compose.prod.yml`** — production serveur
- Réseau interne (`passidoc-net`), ports non exposés sauf Nginx
- Variables d'env via fichier `.env.prod`
- SSL Let's Encrypt géré par Nginx
- 4 services : `postgres`, `minio`, `backend`, `nginx`

Commandes :
```bash
# Dev local
docker compose up -d

# Production serveur
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Nginx

- Reverse proxy en production
- SSL termination (Let's Encrypt)
- Redirection HTTP → HTTPS
- Proxy pass vers le backend NestJS
- Service des assets Angular statiques

### Hébergement

L'application est conçue pour être déployée sur **n'importe quel serveur Linux** via Docker Compose. Elle ne dépend d'aucun fournisseur spécifique.

Services nécessaires côté serveur :
- Un serveur avec Docker installé
- PostgreSQL (container ou service managé)
- MinIO (container ou service S3 compatible)
- Nginx en reverse proxy avec certificat SSL

---

## 8. Sécurité

| Mécanisme | Détail |
|---|---|
| JWT | Tokens signés, expiry 7j, header `Authorization: Bearer` |
| TOTP 2FA | Google Authenticator compatible, code 6 chiffres / 30s |
| bcrypt | Hashage mots de passe, saltRounds 10, irréversible |
| Guards NestJS | `authGuard`, `setupGuard`, vérification des rôles |
| Isolation tenant | Chaque requête filtrée par `tenantId`, header `x-tenant-slug` |
| CORS | Origines autorisées via `FRONTEND_URL` |

**Rôles utilisateurs :**
- ADMIN
- EXPERT_COMPTABLE
- CHEF_ANTENNE
- CHEF_MISSION
- COLLABORATEUR
- GERANT_MADAGASCAR

---

## 9. Git & CI/CD

**Repository :** GitHub (privé)
**Branche principale :** `main`
**Convention branches :** `feature/nom-feature`

**Workflow de déploiement :**

```
git push origin main
       |
       v
  Serveur de production
  ├── Backend  : npm ci && npm run build → node dist/main
  └── Frontend : npm ci && npm run build --configuration=production
       |
       v
  Redémarrage des containers Docker
```

**Auteur Git :** christian / tojochris50@gmail.com
