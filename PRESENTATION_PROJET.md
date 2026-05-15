# Passidoc — Présentation du projet
> AFYM Audit Expertise · La Réunion & Madagascar

---

## Le cabinet AFYM Audit Expertise

AFYM est un **cabinet d'expertise comptable** présent à La Réunion et à Madagascar.
Leur métier : gérer les finances d'entreprises clientes (commerçants, artisans, PME) qui
n'ont pas les compétences ou le temps de le faire eux-mêmes.

**Ce qu'ils font concrètement :**
- Comptabilité (saisie des opérations, établissement des bilans)
- Déclarations fiscales (TVA, IS, liasses fiscales)
- Conseil (optimisation fiscale, stratégie, investissements)
- Audit (vérification de la conformité des comptes)

Chaque collaborateur gère un portefeuille de **20 à 40 clients** simultanément.

---

## Le problème qu'ils vivent

Imagine une collaboratrice, **Marie**, qui gère depuis 3 ans le dossier d'une boulangerie
*"Du Four à la Planche"*. Elle connaît tout de ce client :

- Que le gérant s'appelle M. Dupont, 52 ans, marié sous communauté, 2 enfants en bas âge
- Que la boulangerie est en **zone ZFA** (exonération fiscale spéciale La Réunion)
- Que le fournisseur Grands Moulins envoie sa balance en retard chaque décembre
- Que M. Dupont veut ouvrir un 2ème point de vente dans 2 ans
- Que l'EBE est structurellement bas à cause des charges de personnel élevées

**Marie part en congé maternité 6 mois.** Un nouveau collaborateur, **Thomas**, reprend le dossier.

| Sans Passidoc | Avec Passidoc |
|---|---|
| Thomas passe 2 semaines à rappeler M. Dupont | Thomas est opérationnel en 15 minutes |
| Il rate l'exonération ZFA → erreur fiscale | Il lit le dossier complet, l'IA le résume |
| Le client est mécontent | Le client ne voit aucune rupture de service |
| Risque de perte du client | Continuité parfaite |

> **C'est le problème central : la connaissance est dans les têtes, pas dans le système.**

---

## La solution — Passidoc

Un **Dossier Permanent Dynamique (DPD)** : une plateforme web sécurisée qui centralise
tout ce que le cabinet sait sur chaque client, pour qu'aucune information ne soit jamais perdue.

---

## Scénario d'utilisation — Une semaine au cabinet

### Lundi matin — Réunion d'intelligence collective
Le directeur ouvre le **dashboard Passidoc** sur grand écran avec toute l'équipe.

Il voit d'un coup d'œil :
- 3 dossiers en **alerte rouge** (score < 50%) → fiches incomplètes, risque si quelqu'un part
- La cloche 🔔 affiche **7 alertes** → 7 relevés bancaires non déposés ce mois-ci
- 2 dossiers à **score 100%** → parfaitement transmissibles

Il dit à l'équipe :
> *"Marie, le dossier Boulangerie Dupont est en alerte, tu peux compléter la fiche identité cette semaine ?"*

---

### Mardi — Passation d'un dossier

Marie envoie juste le lien Passidoc à Thomas. Il :

1. Ouvre le dossier → lit la fiche identité (gérants, SIREN, surface, salariés)
2. Va dans **Analyse Stratégique** → voit le SWOT, comprend le positionnement marché
3. Clique sur **Assistant IA** → tape :
   > *"Résume-moi ce dossier pour ma prise en charge"*
4. L'IA répond en 30 secondes :
   > *"Boulangerie artisanale 950k€ CA, gérant 52 ans en ZFA NG, attention aux flux
   > d'espèces identifiés comme zone de risque, objectif ouverture 2ème point de vente
   > en 2025, fournisseur Grands Moulins toujours en retard en décembre..."*
5. Thomas est **opérationnel en 15 minutes**

---

### Mercredi — Appel client de prospection

Un expert-comptable consulte l'onglet **Missions** avant d'appeler un client :
- Il voit qu'une mission de restructuration avait été **proposée l'an dernier → refusée**
  car *"pas le bon moment"*
- Il voit que le client était intéressé par une **mission tableau de bord**

Il adapte son discours. Il ne repropose pas ce qui a été refusé. Il fait mouche.

---

### Vendredi — Clôture d'exercice

La collaboratrice ouvre l'onglet **Synthèse de clôture** et renseigne :
- Points IS importants de cette année
- Impact de l'EBE
- Zones d'exonération utilisées
- Notes N-1 à garder pour l'an prochain

Puis clique **"Note de passation PDF"** → génère automatiquement un document propre
de 5 pages envoyé au client pour validation.

---

## Les 5 modules de l'application

### a. Fiche Identité & Gouvernance — *"Qui est ce client ?"*
Données légales (SIREN, SIRET, forme juridique), gérants (âge, situation familiale,
parts), salariés, surface commerciale, réglementations spécifiques.

### b. Pilotage Opérationnel — *"Comment ça tourne ?"*
Tableau de bord des flux mensuels (relevés bancaires, rapports de vente, règlements).
Alertes visuelles si un fichier est manquant ou en retard. Annuaire fournisseurs.

### c. Analyse Stratégique & Financière — *"Combien et où va-t-on ?"*
SWOT, 5 forces de Porter, Business Model Canvas, KPIs financiers (CA, EBE, résultat net),
synthèse de clôture, spécificités fiscales (ZFA NG, flux d'espèces).

### d. Missions & Objectifs — *"Qu'est-ce qu'on fait pour eux ?"*
Missions réalisées, refusées (avec raison), détectées, proposées par IA.
Objectifs du client à 1 an, 3-5 ans, long terme. Qualité de la relation cabinet/client.

### e. Assistant IA — *"Que dit le dossier ?"*
Agent IA (Ollama / Mistral, 100% local) entraîné sur les données du client.
Capable de résumer le dossier, répondre à des questions précises, aider à la passation.
Les données ne quittent jamais le serveur du cabinet.

---

## Différence avec Pappers.fr

| | Pappers.fr | Passidoc |
|---|---|---|
| Source des données | Données publiques (greffe) | Connaissance interne du cabinet |
| SIREN / SIRET | ✅ | ✅ |
| Bilans déposés | ✅ (lecture seule) | — |
| SWOT, Porter, BMC | ❌ | ✅ |
| Missions vendues/refusées | ❌ | ✅ |
| Contrôle interne client | ❌ | ✅ |
| Objectifs du client | ❌ | ✅ |
| Score de passation | ❌ | ✅ |
| Assistant IA dédié | ❌ | ✅ |
| Export PDF note de passation | ❌ | ✅ |
| Multi-sites Réunion + Madagascar | ❌ | ✅ |

> Pappers = *"Qui est cette entreprise légalement ?"*
> Passidoc = *"Tout ce que notre cabinet sait sur ce client"*

---

## Résumé en une phrase

> Passidoc est la **mémoire institutionnelle** du cabinet AFYM.
> Tout ce qu'un collaborateur sait sur un client est capturé, structuré et accessible
> à n'importe qui en quelques clics — même si la personne qui gérait le dossier n'est plus là.

---

*Développé pour AFYM Audit Expertise — La Réunion & Madagascar*
