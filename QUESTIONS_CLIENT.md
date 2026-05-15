# Questions Client — Passidoc / AFYM Audit Expertise

> À valider avant de poursuivre le développement.

---

## 🔴 Priorité haute — Fonctionnel

### Module IA
1. L'agent IA est listé comme objectif principal. Voulez-vous qu'on l'intègre maintenant, ou c'est hors périmètre pour cette version ?
2. Si oui, comment doit fonctionner le "fil de discussion" — l'utilisateur pose une question en langage naturel sur le dossier client ?

### Santé de passation
3. Comment calculez-vous exactement le score ? Le CDC dit "si la fiche est remplie à 100% avec les notes de synthèse et l'organigramme → Transmissible". Quels champs comptent pour combien de points ?
4. Un dossier à 20% est "à risque" — doit-on envoyer une notification (email ? alerte dans l'app) au responsable ?

### Flux mensuels
5. Qu'est-ce qui déclenche une alerte "en retard" — un délai fixe (ex : relevé bancaire attendu avant le 10 du mois suivant) ou c'est manuel ?
6. Qui dépose les fichiers — le collaborateur ou le client lui-même a un accès ?

---

## 🟡 Priorité moyenne — Contenu métier

### Fiche identité
7. Le CDC mentionne le logo du client — doit-on permettre l'upload d'un logo ? Affiché où ?
8. Le champ "contrat de mariage" des gérants — y a-t-il une liste fixe de régimes, ou champ libre ?

### Spécificités Madagascar
9. Quelles taxes/spécificités fiscales Madagascar doit-on afficher différemment de La Réunion ? (ZFA NG = Réunion, Zone franche = Madagascar — y a-t-il d'autres règles ?)
10. Les fuseaux horaires (UTC+4 / UTC+3) — doivent-ils apparaître quelque part dans l'interface, ou c'est juste pour les horodatages en base ?

### Fournisseurs
11. L'annuaire fournisseurs sert à "faciliter les demandes de balances tiers en fin d'exercice" — doit-on pouvoir envoyer un email directement depuis la plateforme, ou juste afficher le contact ?

---

## 🟠 Sécurité & Technique

12. Le CDC dit PostgreSQL, on a utilisé MySQL/MariaDB. Est-ce acceptable, ou faut-il migrer ?
13. Le CDC dit React, on a utilisé Angular. Est-ce acceptable pour le jury du mémoire ?
14. Le chiffrement des documents stockés — est-ce une exigence réelle pour la démo/soutenance, ou suffit-il de le mentionner dans le mémoire comme prévu ?
15. Le coffre-fort numérique (stockage MinIO) — les documents uploadés sont-ils actuellement bien stockés hors Drive/Cloud public ? C'est un argument fort pour le jury.

---

## 🟢 Livrables & Mémoire

16. Le Mémoire de Master 2 CCA est listé comme livrable — c'est toi qui le rédiges, ou tu veux qu'on t'aide à structurer la partie technique ?
17. Le Guide utilisateur — format attendu : PDF, page web, ou intégré dans l'app (aide contextuelle) ?
18. Y a-t-il une date de soutenance ou une deadline de livraison à respecter ?

---

## Réponses

| # | Question | Réponse | Date |
|---|----------|---------|------|
| 1 | Module IA — inclure maintenant ? | | |
| 2 | IA — fonctionnement du fil de discussion | | |
| 3 | Calcul exact du score santé | | |
| 4 | Notification dossier en alerte | | |
| 5 | Déclencheur alerte "en retard" | | |
| 6 | Qui dépose les fichiers | | |
| 7 | Upload logo client | | |
| 8 | Contrat de mariage — liste fixe ou champ libre | | |
| 9 | Spécificités fiscales Madagascar | | |
| 10 | Fuseaux horaires dans l'interface | | |
| 11 | Email fournisseurs depuis la plateforme | | |
| 12 | MySQL vs PostgreSQL | | |
| 13 | Angular vs React pour le jury | | |
| 14 | Chiffrement documents — démo ou mémoire | | |
| 15 | Stockage MinIO opérationnel | | |
| 16 | Rédaction du mémoire | | |
| 17 | Format guide utilisateur | | |
| 18 | Date de soutenance / deadline | | |
