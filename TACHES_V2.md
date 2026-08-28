# PASSIDOC — Tâches v2.0
> Source : CDC_PASSIDOC_v2.docx — Retours direction AFYM — Août 2026

---

## MODULE DOSSIER

### TACHE-01 — Correction référentiel géographique (pôles)
**Priorité : HAUTE**

Remplacer les options "La Réunion" / "Madagascar" dans la création/édition de dossier par :
- **Pôle EST**
- **Pôle OUEST**

Fichiers concernés :
- [ ] Formulaire création dossier (`create-client-wizard.component.ts`)
- [ ] Formulaire édition dossier
- [ ] Entité `client.entity.ts` — enum `UserSite` ou champ `site`
- [ ] Partout où le champ `site` est affiché ou filtré
- [ ] Labels dans `TenantConfig` (poleLabel1 / poleLabel2 déjà dynamiques ✓ — vérifier les valeurs en DB)

---

### TACHE-02 — Fiche Identité : galerie photos
**Priorité : HAUTE**

Permettre l'upload de plusieurs photos dans la fiche identité (salle, enseigne, localisation).

- [ ] Nouveau champ `photos: string[]` dans l'entité `FicheIdentite`
- [ ] Endpoint backend : `POST /clients/:id/fiche/photos` (upload multiple)
- [ ] Stockage MinIO ou local (dossier `/uploads/clients/:id/photos/`)
- [ ] Affichage galerie dans l'onglet Fiche Identité (grille de miniatures + modale zoom)
- [ ] Suppression photo individuelle

---

### TACHE-03 — Fiche Identité : activité et mode de fonctionnement
**Priorité : HAUTE**

Ajouter des champs de description de l'activité client dans la fiche identité.

- [ ] `activitePrincipale` : description libre (textarea)
- [ ] `typeClientele` : description libre
- [ ] `saisonnalite` : description libre / booléen + détail
- [ ] `pointsDeVente` : description libre
- [ ] Conserver les champs existants : présence digitale, organigramme

---

### TACHE-04 — Nouveau volet "Comptabilité par Cycles opérationnels"
**Priorité : HAUTE**

Nouvelle section dans le dossier client pour documenter le fonctionnement opérationnel par cycle (≠ révision comptable).

#### Cycle Trésorerie
- [ ] `nbComptesBancaires` : nombre entier
- [ ] `aEmprunts` : booléen
- [ ] `empruntsDetail` : texte (montant, périodicité, date de fin) — visible si `aEmprunts = true`
- [ ] `modeTransmissionReleves` : enum (Tiime / Mail / Remise physique)

#### Cycle Achats
- [ ] `modeDepotFacturesAchat` : enum (Tiime / Mail / Remise physique)
- [ ] `frequenceVolumeFa` : texte libre
- [ ] Lien vers onglet Fournisseurs existant

#### Cycle Ventes
- [ ] `typeFacturation` : enum (Logiciel caisse / Manuelle / Marketplace / Autre)
- [ ] `modeTransmissionVentes` : texte libre
- [ ] `periodiciteDeclarationTva` : enum (Mensuelle / Trimestrielle / Annuelle)

#### Cycle Charges externes & Paie
- [ ] `nbSalaries` : nombre entier (lien avec module RH existant)
- [ ] `gestionPaie` : enum (Internalisée cabinet / Externalisée)

#### Points de vigilance transversaux
- [ ] `pointsVigilance` : textarea libre

---

### TACHE-05 — Contrôle Interne : approfondissement
**Priorité : MOYENNE**

Enrichir l'onglet Contrôle Interne existant avec 3 nouvelles sous-sections.

#### Sous-section "Risques identifiés"
- [ ] Liste de risques (ajout/suppression dynamique)
- [ ] Champ : description du risque (texte)
- [ ] Champ : niveau de risque — enum (Faible / Moyen / Élevé)

#### Sous-section "Recommandations formalisées"
- [ ] Liste de recommandations (ajout/suppression)
- [ ] Champ : description de la recommandation
- [ ] Champ : statut — enum (À soumettre / Soumis au client / Accepté / En cours / Mis en œuvre)
- [ ] Liaison vers onglet Objectifs : bouton "Ajouter aux axes d'amélioration"

#### Sous-section "Mission de conseil potentielle"
- [ ] Case à cocher : "Une mission de conseil en CI pourrait être proposée"
- [ ] Bouton : "Créer la mission" → lien vers onglet Missions

---

## MODULE TRAVAIL

### TACHE-06 — Tâches récurrentes automatisées
**Priorité : HAUTE**

Générer automatiquement les tâches fiscales/comptables récurrentes par dossier client.

- [ ] Nouvelle entité `TacheRecurrente` (type, fréquence, délai avant échéance J-X, dossier lié, assigné à)
- [ ] Cron NestJS : vérification quotidienne et création des tâches à J-X
- [ ] Interface admin/chef de mission pour configurer les tâches récurrentes par dossier
- [ ] Tag visuel "Récurrente" dans le Kanban
- [ ] Liste des tâches récurrentes standard à implémenter (à confirmer avec AFYM)

---

### TACHE-07 — Suivi des tâches inter-services
**Priorité : MOYENNE**

Tracer les tâches impliquant plusieurs pôles/services.

- [ ] Nouveau champ `serviceDestinataire` sur les tâches : enum (Compta / Social / Juridique / Admin)
- [ ] Nouveau statut `EN_ATTENTE_SERVICE` + champ `serviceAttendu`
- [ ] Vue filtrée par service dans le Kanban
- [ ] Notification au service destinataire lors de l'assignation inter-service

---

### TACHE-08 — Saisie des temps (remplacement Tempolia)
**Priorité : HAUTE**

Module natif de saisie des temps facturable et non facturable.

#### Modèle de données
- [ ] Nouvelle entité `SaisieTemps` (collaborateur, date, durée, type : facturable/non-facturable, catégorie, dossier lié)
- [ ] Catégories non facturables : Appel client / Réunion interne / Formation / Administratif / Autre

#### Interface
- [ ] Formulaire de saisie manuelle (temps non facturable)
- [ ] Lien avec le chronomètre existant pour le temps facturable (conserver l'existant)
- [ ] Tableau de bord individuel : ratio facturable/non-facturable par semaine et par mois

#### Alertes
- [ ] Alerte quotidienne si total < 8h (notification push web + mobile)
- [ ] Alerte hebdomadaire si total semaine < 40h (collaborateur + responsable)
- [ ] Alerte ratio non facturable > 10% du temps semaine

---

### TACHE-09 — Lien Pointage ↔ Saisie des temps
**Priorité : MOYENNE**

Règle de cohérence entre présence pointée et temps saisi.

- [ ] Règle bloquante : impossible de saisir plus d'heures que le pointage du jour
- [ ] Calcul : `heures présence = départ - arrivée - pauses`
- [ ] Message d'erreur explicite si règle violée
- [ ] Historique des incohérences accessible par l'admin

---

## MODULE RH (en attente validation direction)

### TACHE-10 — Circuit de validation des congés ⚠️ À CONFIRMER
**Priorité : À DÉFINIR** — décision requise par Alvin (directeur)

- [ ] Alvin reçoit une notification pour toutes les demandes de congés (lecture seule)
- [ ] Validation opérationnelle par l'Admin Madagascar pour les collabs de Madagascar
- [ ] Circuit exact (simple ou double validation) : **à confirmer avec la direction**

---

### TACHE-11 — Absences et variables de paie ⚠️ À CONFIRMER
**Priorité : À DÉFINIR** — décision requise par Alvin (directeur)

- Option A : Export CSV/Excel des absences pour traitement externe
- Option B : Rapport mensuel formaté directement utilisable comme variable de paie

**Décision requise avant développement.**

---

## RÉCAPITULATIF PRIORITÉS

| Tâche | Module | Priorité | Statut |
|---|---|---|---|
| TACHE-01 | Dossier — Pôles Est/Ouest | 🔴 HAUTE | À faire |
| TACHE-02 | Dossier — Galerie photos | 🔴 HAUTE | À faire |
| TACHE-03 | Dossier — Activité client | 🔴 HAUTE | À faire |
| TACHE-04 | Dossier — Cycles opérationnels | 🔴 HAUTE | À faire |
| TACHE-05 | Dossier — Contrôle interne | 🟡 MOYENNE | À faire |
| TACHE-06 | Travail — Tâches récurrentes | 🔴 HAUTE | À faire |
| TACHE-07 | Travail — Inter-services | 🟡 MOYENNE | À faire |
| TACHE-08 | Travail — Saisie des temps | 🔴 HAUTE | À faire |
| TACHE-09 | Travail — Lien pointage/temps | 🟡 MOYENNE | À faire |
| TACHE-10 | RH — Circuit congés | ⚪ EN ATTENTE | Validation Alvin |
| TACHE-11 | RH — Variables de paie | ⚪ EN ATTENTE | Validation Alvin |
