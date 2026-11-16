/**
 * Tableau de Bord BP — suggestions tirées des données déjà saisies dans PASSIDOC.
 * Le document prévoit un pré-remplissage « depuis le grand livre et les ratios » : PASSIDOC ne
 * conserve aucune écriture comptable (l'import FEC ne compte que des pièces), les suggestions
 * reposent donc sur la fiche identité, l'ADN, le contrôle interne, la synthèse de clôture (CA,
 * EBE, résultat), les pièces en retard, les clôtures et les missions. Le BP accepte ou écarte
 * chaque suggestion (identifiée par une clé stable, pour ne pas la reproposer).
 */
import { OutilBpCode, QUESTIONS_ENTRETIEN } from './outils-bp.util';

// Libellés des réponses ADN (identiques à frontend/src/app/features/clients/questionnaire-adn.options.ts).
const VISION: Record<string, string> = {
  STABLE: "consolider l'existant", CROISSANCE_MODEREE: 'croissance modérée',
  FORTE_EXPANSION: 'forte expansion', TRANSMISSION: 'transmission / vente',
};
const VALEUR: Record<string, string> = {
  QUALITE: 'qualité artisanale', RAPIDITE: 'rapidité & efficacité',
  PROXIMITE: 'proximité & conseil humain', RAPPORT_QUALITE_PRIX: 'meilleur rapport qualité/prix',
};
const AMBIANCE: Record<string, string> = {
  FAMILIALE: 'familiale & très soudée', PROFESSIONNELLE: 'professionnelle & structurée',
  TENSION: 'en tension (turnover, recrutement)', SANS_SALARIES: 'pas encore de salariés',
};
const ENJEU_RH: Record<string, string> = {
  RECRUTER: 'recruter de nouveaux talents', FIDELISER: 'fidéliser les salariés actuels', FORMER: 'former et monter en compétence',
};
const CANAL: Record<string, string> = {
  BOUCHE_A_OREILLE: 'bouche-à-oreille / réputation', EMPLACEMENT: 'emplacement physique (flux de passage)',
  DIGITAL: 'réseaux sociaux & site internet', PUBLICITE: 'publicité / partenariats',
};
const SAISON: Record<string, string> = {
  SAISONNIERE: 'saisonnière (tourisme, fêtes, météo)', CYCLIQUE: 'cyclique (marchés publics, contrats longs)',
};
const CAILLOU: Record<string, string> = {
  TRESORERIE: 'gestion de la trésorerie', ADMINISTRATIF: 'complexité administrative et fiscale',
  VISIBILITE_RENTABILITE: 'manque de visibilité sur la rentabilité', MANQUE_TEMPS: 'manque de temps personnel',
};
const PROJET: Record<string, string> = {
  IMMOBILIER: 'immobilier (achat de locaux)', MATERIEL: 'matériel ou véhicule', DIGITALISATION: 'digitalisation (logiciels, web)',
};

export interface SyntheseBp {
  exercice: number; ca: number | null; caPrecedent: number | null; ebe: number | null; resultatNet: number | null;
  zonesExoneration?: string[] | null; zonesRisque?: string[] | null;
}

export interface DonneesBp {
  annee: number;
  aujourdhui: string;
  client: { secteur?: string | null; site?: string | null; createdAt: Date | string };
  fiche?: Record<string, any> | null;
  adn?: Record<string, any> | null;
  controle?: Record<string, any> | null;
  objectifs?: Record<string, any> | null;
  syntheses: SyntheseBp[];
  exercices: { annee: number; dateCloture: string; clotureLeAt: Date | string | null }[];
  /** Pièces de l'année marquées manquantes ou en retard dans la grille Pilotage. */
  piecesEnRetard: { type: string; mois: number }[];
  nbFournisseurs: number;
  /** Moyennes mensuelles de tiers distincts comptés à l'import FEC (null si pas d'import). */
  tiersParMois: { clients: number | null; fournisseurs: number | null };
  missions: { statut: string | null; cycle?: string | null }[];
  /** Réponses du questionnaire d'entretien BP de l'exercice (contenu de l'outil ENTRETIEN). */
  entretien?: Record<string, any> | null;
}

export interface SuggestionBp {
  cle: string;
  outil: OutilBpCode;
  /** Zone de destination : quadrant, force, bloc, `axe:<code>`, `activite:<code>`, `persona.<champ>`… */
  zone: string;
  texte: string;
  source: string;
  /** Diagnostic : note proposée pour l'axe. */
  score?: number;
  /** Matrice de risques : cotation proposée. */
  risque?: { categorie: string; probabilite: number; gravite: number };
}

export interface ProfilAutoBp {
  secteur: string | null;
  effectif: number | null;
  capital: number | null;
  ca: number | null;
  croissanceCa: number | null;
  ancienneteRelationAns: number | null;
  nbExercices: number;
  dateCreationEntreprise: string | null;
  maturiteNumerique: number | null;
  disciplinePieces: { enRetard: number; appreciation: string };
  missionsAcceptees: number;
  cyclesMissions: string[];
}

const pct = (a: number, b: number) => Math.round(((a - b) / Math.abs(b)) * 100);
const nombre = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
const court = (t: unknown, max = 160) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
const joursEntre = (a: Date | string, b: Date | string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
const moyenne = (l: number[]) => (l.length ? l.reduce((a, n) => a + n, 0) / l.length : null);

export function synthesesTriees(s: SyntheseBp[]) {
  return [...s].sort((a, b) => b.exercice - a.exercice);
}

/** Synthèse de l'exercice courant, ou à défaut la plus récente. */
function syntheseCourante(d: DonneesBp): SyntheseBp | null {
  const triees = synthesesTriees(d.syntheses);
  return triees.find(s => s.exercice === d.annee) ?? triees[0] ?? null;
}

/** Retard de la dernière clôture effectuée (jours après la date de clôture prévue), si connu. */
function retardCloture(d: DonneesBp): { annee: number; jours: number } | null {
  const closes = d.exercices.filter(e => e.clotureLeAt && e.dateCloture).sort((a, b) => b.annee - a.annee);
  const e = closes[0];
  return e ? { annee: e.annee, jours: joursEntre(e.dateCloture, e.clotureLeAt!) } : null;
}

export function construireSuggestions(d: DonneesBp): SuggestionBp[] {
  const out: SuggestionBp[] = [];
  const add = (s: SuggestionBp) => { if (s.texte) out.push(s); };
  const f = d.fiche ?? {};
  const adn = d.adn ?? {};
  const ci = d.controle ?? {};
  const s = syntheseCourante(d);
  const ca = nombre(s?.ca), caPrec = nombre(s?.caPrecedent), ebe = nombre(s?.ebe), rn = nombre(s?.resultatNet);
  const exo = s ? ` (exercice ${s.exercice})` : '';
  const SYN = 'Synthèse de clôture', ADN = 'ADN entreprise', FICHE = 'Fiche identité', CI = 'Contrôle interne', ENTRETIEN = 'Entretien BP';
  const concurrents = [nombre(f.nbConcurrentsQuartier), nombre(f.nbConcurrentsCommune), nombre(f.nbConcurrentsGeneral)];
  const reglementations: string[] = (f.reglementations ?? []).filter(Boolean).slice(0, 5);
  const saisonnalite = adn.saisonnalite || f.saisonnalite;
  const nbSalaries = nombre(f.cycleChargesPaie?.nbSalaries);
  const retard = retardCloture(d);
  const tva = d.piecesEnRetard.filter(p => p.type.startsWith('TVA'));

  // ── SWOT ──
  if (ca !== null && caPrec !== null && caPrec !== 0 && ca !== caPrec) {
    const evol = pct(ca, caPrec);
    add({ cle: 'swot.ca', outil: 'SWOT', zone: evol > 0 ? 'forces' : 'faiblesses', source: SYN,
      texte: `Chiffre d'affaires en ${evol > 0 ? 'hausse' : 'baisse'} de ${Math.abs(evol)} %${exo}` });
  }
  if (ebe !== null && ca) add({ cle: 'swot.ebe', outil: 'SWOT', zone: ebe > 0 ? 'forces' : 'faiblesses', source: SYN,
    texte: ebe > 0 ? `EBE positif : marge d'EBE de ${Math.round((ebe / ca) * 100)} %${exo}` : `EBE négatif${exo}` });
  if (rn !== null && rn !== 0) add({ cle: 'swot.resultat', outil: 'SWOT', zone: rn > 0 ? 'forces' : 'faiblesses', source: SYN,
    texte: rn > 0 ? `Résultat net bénéficiaire${exo}` : `Résultat net déficitaire${exo}` });
  if (VALEUR[adn.valeurCle]) add({ cle: 'swot.valeur', outil: 'SWOT', zone: 'forces', source: ADN, texte: `Valeur clé reconnue : ${VALEUR[adn.valeurCle]}` });
  const num = nombre(adn.niveauNumerique);
  if (num !== null && num >= 4) add({ cle: 'swot.numerique', outil: 'SWOT', zone: 'forces', source: ADN, texte: `Bonne maturité numérique (${num}/5)` });
  if (num !== null && num > 0 && num <= 2) add({ cle: 'swot.numerique', outil: 'SWOT', zone: 'faiblesses', source: ADN, texte: `Faible maturité numérique (${num}/5)` });
  if (['FAMILIALE', 'PROFESSIONNELLE'].includes(adn.ambianceEquipe)) add({ cle: 'swot.equipe', outil: 'SWOT', zone: 'forces', source: ADN, texte: `Équipe ${AMBIANCE[adn.ambianceEquipe]}` });
  if (adn.ambianceEquipe === 'TENSION') add({ cle: 'swot.equipe', outil: 'SWOT', zone: 'faiblesses', source: ADN, texte: `Équipe ${AMBIANCE.TENSION}` });
  if ((adn.canauxAcquisition ?? []).includes('BOUCHE_A_OREILLE')) add({ cle: 'swot.reputation', outil: 'SWOT', zone: 'forces', source: ADN, texte: 'Réputation : le bouche-à-oreille amène des clients' });
  (ci.processOk ?? []).slice(0, 5).forEach((p: any, i: number) =>
    add({ cle: `swot.processOk.${i}`, outil: 'SWOT', zone: 'forces', source: CI, texte: p?.description ? `Processus maîtrisé : ${court(p.description)}` : '' }));
  (ci.outilsPilotage ?? []).slice(0, 3).forEach((o: any, i: number) =>
    add({ cle: `swot.pilotage.${i}`, outil: 'SWOT', zone: 'forces', source: CI, texte: o?.nom ? `Outil de pilotage en place : ${court(o.nom)}` : '' }));
  if (CAILLOU[adn.caillouChaussure]) add({ cle: 'swot.caillou', outil: 'SWOT', zone: 'faiblesses', source: ADN, texte: `Difficulté citée par le dirigeant : ${CAILLOU[adn.caillouChaussure]}` });
  (ci.processDefaillants ?? []).slice(0, 5).forEach((p: any, i: number) =>
    add({ cle: `swot.processKo.${i}`, outil: 'SWOT', zone: 'faiblesses', source: CI, texte: p?.description ? `Processus défaillant : ${court(p.description)}` : '' }));
  (ci.risquesIdentifies ?? []).filter((r: any) => r?.niveauRisque === 'ELEVE').slice(0, 3).forEach((r: any, i: number) =>
    add({ cle: `swot.risqueEleve.${i}`, outil: 'SWOT', zone: 'faiblesses', source: CI, texte: r?.description ? `Risque élevé : ${court(r.description)}` : '' }));
  if (f.pointsVigilance) add({ cle: 'swot.vigilance', outil: 'SWOT', zone: 'faiblesses', source: FICHE, texte: `Point de vigilance : ${court(f.pointsVigilance, 200)}` });
  if (d.piecesEnRetard.length >= 3) add({ cle: 'swot.pieces', outil: 'SWOT', zone: 'faiblesses', source: 'Pilotage des pièces',
    texte: `Pièces transmises en retard : ${d.piecesEnRetard.length} manquante(s) ou en retard en ${d.annee}` });
  if (retard && retard.jours > 120) add({ cle: 'swot.cloture', outil: 'SWOT', zone: 'faiblesses', source: 'Exercices',
    texte: `Clôture ${retard.annee} tardive (${retard.jours} jours après la date de clôture)` });
  if (['CROISSANCE_MODEREE', 'FORTE_EXPANSION'].includes(adn.visionActivite)) add({ cle: 'swot.vision', outil: 'SWOT', zone: 'opportunites', source: ADN, texte: `Ambition du dirigeant : ${VISION[adn.visionActivite]}` });
  (adn.projetsInvestissement ?? []).filter((p: string) => PROJET[p]).forEach((p: string) =>
    add({ cle: `swot.projet.${p}`, outil: 'SWOT', zone: 'opportunites', source: ADN, texte: `Projet d'investissement : ${PROJET[p]}` }));
  (s?.zonesExoneration ?? []).slice(0, 3).forEach((z, i) => add({ cle: `swot.exo.${i}`, outil: 'SWOT', zone: 'opportunites', source: SYN, texte: `Zone d'exonération : ${court(z)}` }));
  if (concurrents.some(n => n)) add({ cle: 'swot.concurrence', outil: 'SWOT', zone: 'menaces', source: FICHE, texte: `Concurrence : ${[
    concurrents[0] ? `${concurrents[0]} dans le quartier` : '', concurrents[1] ? `${concurrents[1]} dans la commune` : '',
    concurrents[2] ? `${concurrents[2]} au total` : ''].filter(Boolean).join(', ')}` });
  if (adn.principalConcurrent) add({ cle: 'swot.concurrent', outil: 'SWOT', zone: 'menaces', source: ADN, texte: `Principal concurrent : ${court(adn.principalConcurrent)}` });
  (s?.zonesRisque ?? []).slice(0, 3).forEach((z, i) => add({ cle: `swot.zoneRisque.${i}`, outil: 'SWOT', zone: 'menaces', source: SYN, texte: `Zone de risque fiscal : ${court(z)}` }));
  reglementations.forEach((r, i) => add({ cle: `swot.regl.${i}`, outil: 'SWOT', zone: 'menaces', source: FICHE, texte: `Réglementation spécifique : ${court(r)}` }));
  if (SAISON[saisonnalite]) add({ cle: 'swot.saison', outil: 'SWOT', zone: 'menaces', source: ADN, texte: `Activité ${SAISON[saisonnalite]}` });

  // ── 5 Forces de Porter ──
  if (concurrents.some(n => n)) add({ cle: 'porter.nb', outil: 'PORTER', zone: 'concurrence', source: FICHE,
    texte: `Concurrents recensés : ${concurrents.map((n, i) => (n ? `${n} ${['dans le quartier', 'dans la commune', 'au total'][i]}` : '')).filter(Boolean).join(', ')}` });
  if (adn.principalConcurrent) add({ cle: 'porter.principal', outil: 'PORTER', zone: 'concurrence', source: ADN, texte: `Principal concurrent : ${court(adn.principalConcurrent)}` });
  if (f.evolutionSecteur) add({ cle: 'porter.secteur', outil: 'PORTER', zone: 'concurrence', source: FICHE, texte: `Évolution du secteur : ${court(f.evolutionSecteur)}` });
  reglementations.forEach((r, i) => add({ cle: `porter.regl.${i}`, outil: 'PORTER', zone: 'nouveauxEntrants', source: FICHE, texte: `Barrière réglementaire : ${court(r)}` }));
  if (f.typeClientele) add({ cle: 'porter.clientele', outil: 'PORTER', zone: 'pouvoirClients', source: FICHE, texte: `Clientèle : ${court(f.typeClientele)}` });
  if (d.tiersParMois.clients !== null) add({ cle: 'porter.clients', outil: 'PORTER', zone: 'pouvoirClients', source: 'Import FEC',
    texte: d.tiersParMois.clients <= 3
      ? `Clientèle concentrée : ${Math.round(d.tiersParMois.clients * 10) / 10} client(s) distinct(s) facturé(s) par mois en moyenne`
      : `${Math.round(d.tiersParMois.clients)} clients distincts facturés par mois en moyenne` });
  if (d.nbFournisseurs) add({ cle: 'porter.fournisseurs', outil: 'PORTER', zone: 'pouvoirFournisseurs', source: 'Fournisseurs', texte: `${d.nbFournisseurs} fournisseur(s) référencé(s) dans le dossier` });
  if (d.tiersParMois.fournisseurs !== null) add({ cle: 'porter.fournisseursFec', outil: 'PORTER', zone: 'pouvoirFournisseurs', source: 'Import FEC',
    texte: `${Math.round(d.tiersParMois.fournisseurs * 10) / 10} fournisseur(s) distinct(s) par mois en moyenne` });
  if (f.cycleAchats?.frequenceVolume) add({ cle: 'porter.achats', outil: 'PORTER', zone: 'pouvoirFournisseurs', source: FICHE, texte: `Achats : ${court(f.cycleAchats.frequenceVolume)}` });

  // ── Business Model Canvas ──
  if (f.typeClientele) add({ cle: 'bmc.segments', outil: 'BMC', zone: 'segments', source: FICHE, texte: court(f.typeClientele) });
  if (d.client.secteur) add({ cle: 'bmc.secteur', outil: 'BMC', zone: 'segments', source: 'Dossier', texte: `Secteur : ${d.client.secteur}` });
  if (VALEUR[adn.valeurCle]) add({ cle: 'bmc.valeur', outil: 'BMC', zone: 'proposition', source: ADN, texte: VALEUR[adn.valeurCle].replace(/^./, c => c.toUpperCase()) });
  if (adn.mission) add({ cle: 'bmc.mission', outil: 'BMC', zone: 'proposition', source: ADN, texte: court(adn.mission, 300) });
  (adn.canauxAcquisition ?? []).filter((c: string) => CANAL[c]).forEach((c: string) =>
    add({ cle: `bmc.canal.${c}`, outil: 'BMC', zone: 'canaux', source: ADN, texte: CANAL[c].replace(/^./, x => x.toUpperCase()) }));
  if (f.pointsDeVente) add({ cle: 'bmc.pdv', outil: 'BMC', zone: 'canaux', source: FICHE, texte: `Points de vente : ${court(f.pointsDeVente)}` });
  if (f.siteWeb) add({ cle: 'bmc.web', outil: 'BMC', zone: 'canaux', source: FICHE, texte: `Site web : ${court(f.siteWeb, 120)}` });
  if (f.activitePrincipale || f.activite) add({ cle: 'bmc.activite', outil: 'BMC', zone: 'activites', source: FICHE, texte: court(f.activitePrincipale || f.activite) });
  if (ca !== null) add({ cle: 'bmc.ca', outil: 'BMC', zone: 'revenus', source: SYN, texte: `Chiffre d'affaires : ${fmt(ca)}${exo}` });
  if (f.cycleVentes?.typeFacturation) add({ cle: 'bmc.facturation', outil: 'BMC', zone: 'revenus', source: FICHE, texte: `Facturation : ${court(f.cycleVentes.typeFacturation)}` });
  if (nbSalaries) add({ cle: 'bmc.salaries', outil: 'BMC', zone: 'ressources', source: FICHE, texte: `${nbSalaries} salarié(s)` });
  if (nombre(f.capital)) add({ cle: 'bmc.capital', outil: 'BMC', zone: 'ressources', source: FICHE, texte: `Capital social : ${fmt(Number(f.capital))}` });
  if (nombre(f.surfaceCommerciale)) add({ cle: 'bmc.surface', outil: 'BMC', zone: 'ressources', source: FICHE, texte: `Surface commerciale : ${fmt(Number(f.surfaceCommerciale))} m²` });
  (f.actionnaires ?? []).slice(0, 5).forEach((a: any, i: number) => add({ cle: `bmc.actionnaire.${i}`, outil: 'BMC', zone: 'partenaires', source: FICHE,
    texte: [a?.prenom, a?.nom].filter(Boolean).length ? `Associé : ${[a?.prenom, a?.nom].filter(Boolean).join(' ')}${nombre(a?.pourcentage) ? ` (${a.pourcentage} %)` : ''}` : '' }));
  if (nombre(f.cycleTresorerie?.nbComptesBancaires)) add({ cle: 'bmc.banques', outil: 'BMC', zone: 'partenaires', source: FICHE, texte: `${f.cycleTresorerie.nbComptesBancaires} compte(s) bancaire(s)` });
  if (f.cycleTresorerie?.aEmprunts) add({ cle: 'bmc.emprunts', outil: 'BMC', zone: 'partenaires', source: FICHE, texte: `Financement bancaire${f.cycleTresorerie.empruntsDetail ? ` : ${court(f.cycleTresorerie.empruntsDetail)}` : ''}` });
  if (d.nbFournisseurs) add({ cle: 'bmc.fournisseurs', outil: 'BMC', zone: 'partenaires', source: 'Fournisseurs', texte: `${d.nbFournisseurs} fournisseur(s) référencé(s)` });
  if (nbSalaries) add({ cle: 'bmc.masseSalariale', outil: 'BMC', zone: 'couts', source: FICHE, texte: `Masse salariale (${nbSalaries} salarié(s))` });
  if (f.cycleTresorerie?.aEmprunts) add({ cle: 'bmc.chargesFin', outil: 'BMC', zone: 'couts', source: FICHE, texte: 'Charges financières des emprunts' });

  // ── PESTEL ──
  if (f.evolutionSecteur) add({ cle: 'pestel.secteur', outil: 'PESTEL', zone: 'economique', source: FICHE, texte: `Évolution du secteur : ${court(f.evolutionSecteur)}` });
  if (SAISON[saisonnalite]) add({ cle: 'pestel.saison', outil: 'PESTEL', zone: 'economique', source: ADN, texte: `Activité ${SAISON[saisonnalite]}` });
  reglementations.forEach((r, i) => add({ cle: `pestel.regl.${i}`, outil: 'PESTEL', zone: 'legal', source: FICHE, texte: court(r) }));
  (s?.zonesExoneration ?? []).slice(0, 3).forEach((z, i) => add({ cle: `pestel.exo.${i}`, outil: 'PESTEL', zone: 'legal', source: SYN, texte: `Zone d'exonération : ${court(z)}` }));
  (s?.zonesRisque ?? []).slice(0, 3).forEach((z, i) => add({ cle: `pestel.zoneRisque.${i}`, outil: 'PESTEL', zone: 'legal', source: SYN, texte: `Zone de risque fiscal : ${court(z)}` }));
  if (f.cycleVentes?.periodiciteDeclarationTva) add({ cle: 'pestel.tva', outil: 'PESTEL', zone: 'legal', source: FICHE, texte: `TVA déclarée : ${court(f.cycleVentes.periodiciteDeclarationTva)}` });
  if (ENJEU_RH[adn.enjeuxRH]) add({ cle: 'pestel.rh', outil: 'PESTEL', zone: 'socioculturel', source: ADN, texte: `Enjeu RH : ${ENJEU_RH[adn.enjeuxRH]}` });
  if (num) add({ cle: 'pestel.numerique', outil: 'PESTEL', zone: 'technologique', source: ADN, texte: `Maturité numérique de l'entreprise : ${num}/5` });

  // ── Chaîne de valeur (descriptions d'activités) ──
  if (f.activitePrincipale || f.activite) add({ cle: 'chaine.production', outil: 'CHAINE_VALEUR', zone: 'activite:production', source: FICHE, texte: court(f.activitePrincipale || f.activite, 300) });
  const canaux = (adn.canauxAcquisition ?? []).filter((c: string) => CANAL[c]).map((c: string) => CANAL[c]);
  if (canaux.length) add({ cle: 'chaine.vente', outil: 'CHAINE_VALEUR', zone: 'activite:marketingVente', source: ADN, texte: `Acquisition : ${canaux.join(', ')}` });
  if (f.cycleAchats?.frequenceVolume) add({ cle: 'chaine.achats', outil: 'CHAINE_VALEUR', zone: 'activite:approvisionnements', source: FICHE, texte: `Achats : ${court(f.cycleAchats.frequenceVolume, 300)}` });
  if (nbSalaries || f.cycleChargesPaie?.gestionPaie) add({ cle: 'chaine.rh', outil: 'CHAINE_VALEUR', zone: 'activite:rh', source: FICHE,
    texte: [nbSalaries ? `${nbSalaries} salarié(s)` : '', f.cycleChargesPaie?.gestionPaie ? `paie : ${court(f.cycleChargesPaie.gestionPaie)}` : ''].filter(Boolean).join(', ') });
  if (num) add({ cle: 'chaine.techno', outil: 'CHAINE_VALEUR', zone: 'activite:technologie', source: ADN, texte: `Maturité numérique : ${num}/5` });
  if (ebe !== null && ca) add({ cle: 'chaine.marge', outil: 'CHAINE_VALEUR', zone: 'marge', source: SYN, texte: `Marge d'EBE : ${Math.round((ebe / ca) * 100)} %${exo}` });

  // ── Diagnostic interne (notes proposées par axe) ──
  if (rn !== null || ebe !== null) {
    const positifs = [rn !== null && rn > 0, ebe !== null && ebe > 0, ca !== null && caPrec !== null && ca > caPrec].filter(Boolean).length;
    const negatifs = [rn !== null && rn < 0, ebe !== null && ebe < 0].filter(Boolean).length;
    const score = negatifs ? 2 : positifs >= 3 ? 4 : 3;
    add({ cle: 'diag.finance', outil: 'DIAGNOSTIC', zone: 'axe:finance', source: SYN, score,
      texte: `Capacité financière d'après la synthèse${exo} : ${[rn !== null ? `résultat ${rn >= 0 ? 'positif' : 'négatif'}` : '', ebe !== null ? `EBE ${ebe >= 0 ? 'positif' : 'négatif'}` : ''].filter(Boolean).join(', ')}` });
  }
  if (num) add({ cle: 'diag.digital', outil: 'DIAGNOSTIC', zone: 'axe:digital', source: ADN, score: num, texte: `Maturité numérique déclarée : ${num}/5` });
  if (['FAMILIALE', 'PROFESSIONNELLE', 'TENSION'].includes(adn.ambianceEquipe)) add({ cle: 'diag.rh', outil: 'DIAGNOSTIC', zone: 'axe:rh', source: ADN,
    score: adn.ambianceEquipe === 'TENSION' ? 2 : 4, texte: `Équipe ${AMBIANCE[adn.ambianceEquipe]}` });
  const ok = (ci.processOk ?? []).length, ko = (ci.processDefaillants ?? []).length;
  if (ok + ko) add({ cle: 'diag.organisation', outil: 'DIAGNOSTIC', zone: 'axe:organisation', source: CI,
    score: Math.max(1, Math.round(1 + (4 * ok) / (ok + ko))), texte: `${ok} processus maîtrisé(s), ${ko} défaillant(s)` });
  if (VISION[adn.visionActivite]) add({ cle: 'diag.strategie', outil: 'DIAGNOSTIC', zone: 'axe:strategie', source: ADN, texte: `Vision du dirigeant : ${VISION[adn.visionActivite]}` });

  // ── Matrice de risques ──
  const risque = (cle: string, texte: string, source: string, categorie: string, probabilite: number, gravite: number) =>
    add({ cle, outil: 'RISQUES', zone: 'risques', texte, source, risque: { categorie, probabilite, gravite } });
  if (tva.length) risque('risque.tva', `Déclarations de TVA en retard (${tva.length} en ${d.annee})`, 'Pilotage des pièces', 'FISCAL', Math.min(5, 2 + tva.length), 3);
  if (d.piecesEnRetard.length) risque('risque.pieces', `Pièces comptables transmises en retard (${d.piecesEnRetard.length} en ${d.annee})`, 'Pilotage des pièces', 'OPERATIONNEL', Math.min(5, 1 + Math.ceil(d.piecesEnRetard.length / 3)), 2);
  (s?.zonesRisque ?? []).slice(0, 3).forEach((z, i) => risque(`risque.zone.${i}`, `Zone de risque fiscal : ${court(z)}`, SYN, 'FISCAL', 3, 3));
  if (retard && retard.jours > 120) risque('risque.cloture', `Retard de clôture des comptes ${retard.annee} (${retard.jours} jours)`, 'Exercices', 'CONFORMITE', 3, 3);
  (ci.processDefaillants ?? []).slice(0, 5).forEach((p: any, i: number) => {
    if (p?.description) risque(`risque.processKo.${i}`, `Processus défaillant : ${court(p.description)}`, CI, 'FRAUDE', 3, 3);
  });
  const cotation: Record<string, [number, number]> = { FAIBLE: [2, 2], MOYEN: [3, 3], ELEVE: [4, 4] };
  (ci.risquesIdentifies ?? []).slice(0, 10).forEach((r: any, i: number) => {
    if (r?.description) risque(`risque.ci.${i}`, court(r.description), CI, 'OPERATIONNEL', ...(cotation[r.niveauRisque] ?? [3, 3]));
  });
  if (rn !== null && rn < 0) risque('risque.deficit', `Résultat déficitaire${exo}`, SYN, 'FINANCIER', 4, 4);
  if (adn.caillouChaussure === 'TRESORERIE') risque('risque.tresorerie', 'Tensions de trésorerie signalées par le dirigeant', ADN, 'FINANCIER', 3, 3);
  if (d.tiersParMois.clients !== null && d.tiersParMois.clients > 0 && d.tiersParMois.clients <= 3)
    risque('risque.concentration', 'Dépendance à un petit nombre de clients', 'Import FEC', 'OPERATIONNEL', 3, 4);
  if (adn.placeExploitation === 'OPERATIONNELLE') risque('risque.dirigeant', "Dépendance à la présence du dirigeant (100 % opérationnel)", ADN, 'OPERATIONNEL', 3, 4);
  if (adn.visionActivite === 'TRANSMISSION') risque('risque.transmission', "Transmission / cession de l'entreprise à préparer", ADN, 'OPERATIONNEL', 3, 4);
  const doyen = Math.max(0, ...(f.gerants ?? []).map((g: any) => Number(g?.age) || 0));
  if (doyen >= 60) risque('risque.age', `Âge du dirigeant (${doyen} ans) : succession à anticiper`, FICHE, 'OPERATIONNEL', 3, 3);
  if (SAISON[saisonnalite]) risque('risque.saison', `Activité ${SAISON[saisonnalite]} : trésorerie à piloter`, ADN, 'MARCHE', 3, 2);

  // ── Persona / ICP ──
  const gerant = (f.gerants ?? [])[0];
  if (nombre(gerant?.age)) add({ cle: 'persona.age', outil: 'PERSONA', zone: 'persona.age', source: FICHE, texte: `${gerant.age} ans` });
  if (f.contactLegalFonction) add({ cle: 'persona.poste', outil: 'PERSONA', zone: 'persona.poste', source: FICHE, texte: court(f.contactLegalFonction, 120) });
  if (adn.mission) add({ cle: 'persona.bio', outil: 'PERSONA', zone: 'persona.bio', source: ADN, texte: court(adn.mission, 600) });
  if (VISION[adn.visionActivite]) add({ cle: 'persona.vision', outil: 'PERSONA', zone: 'persona.objectifs', source: ADN, texte: VISION[adn.visionActivite].replace(/^./, c => c.toUpperCase()) });
  if (d.objectifs?.objectifs12mois) add({ cle: 'persona.obj12', outil: 'PERSONA', zone: 'persona.objectifs', source: 'Objectifs', texte: `À 12 mois : ${court(d.objectifs.objectifs12mois)}` });
  if (d.objectifs?.objectifs3a5ans) add({ cle: 'persona.obj35', outil: 'PERSONA', zone: 'persona.objectifs', source: 'Objectifs', texte: `À 3-5 ans : ${court(d.objectifs.objectifs3a5ans)}` });
  if (CAILLOU[adn.caillouChaussure]) add({ cle: 'persona.caillou', outil: 'PERSONA', zone: 'persona.frustrations', source: ADN, texte: CAILLOU[adn.caillouChaussure].replace(/^./, c => c.toUpperCase()) });
  if (VALEUR[adn.valeurCle]) add({ cle: 'persona.valeur', outil: 'PERSONA', zone: 'persona.motivations', source: ADN, texte: VALEUR[adn.valeurCle].replace(/^./, c => c.toUpperCase()) });
  if (d.objectifs?.attentesClient) add({ cle: 'persona.attentes', outil: 'PERSONA', zone: 'persona.motivations', source: 'Objectifs', texte: `Attentes envers le cabinet : ${court(d.objectifs.attentesClient)}` });
  if (nbSalaries) add({ cle: 'icp.employes', outil: 'PERSONA', zone: 'icp.employes', source: FICHE, texte: String(nbSalaries) });
  if (ca !== null) add({ cle: 'icp.ca', outil: 'PERSONA', zone: 'icp.caAnnuel', source: SYN, texte: fmt(ca) });
  if (ca !== null && caPrec) add({ cle: 'icp.croissance', outil: 'PERSONA', zone: 'icp.croissance', source: SYN, texte: `${pct(ca, caPrec) > 0 ? '+' : ''}${pct(ca, caPrec)} %` });
  if (d.client.secteur) add({ cle: 'icp.secteur', outil: 'PERSONA', zone: 'icp.secteurs', source: 'Dossier', texte: d.client.secteur });
  if (f.adresse) add({ cle: 'icp.localisation', outil: 'PERSONA', zone: 'icp.localisations', source: FICHE, texte: court(f.adresse, 120) });
  if (CAILLOU[adn.caillouChaussure]) add({ cle: 'icp.probleme', outil: 'PERSONA', zone: 'icp.problemes', source: ADN, texte: CAILLOU[adn.caillouChaussure].replace(/^./, c => c.toUpperCase()) });
  if ((adn.canauxAcquisition ?? []).includes('DIGITAL')) add({ cle: 'icp.digital', outil: 'PERSONA', zone: 'icp.technologies', source: ADN, texte: 'Réseaux sociaux & site internet' });

  // ── Entretien BP : chaque ligne de réponse alimente la zone d'outil prévue par la question ──
  const rep = d.entretien?.reponses ?? {};
  QUESTIONS_ENTRETIEN.forEach(q => {
    if (!q.vers || typeof rep[q.cle] !== 'string') return;
    const [outil, zone] = q.vers;
    const prefixe = q.cle === 'investissements' ? 'Investissement prévu : ' : q.cle === 'attentes' ? 'Attendu du cabinet : ' : '';
    rep[q.cle].split(/\r?\n/).map((l: string) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 10)
      .forEach((l: string, i: number) => add({ cle: `entretien.${q.cle}.${i}`, outil: outil as OutilBpCode, zone, source: ENTRETIEN, texte: prefixe + court(l, 300) }));
  });
  const numEntretien = Number(d.entretien?.notes?.numerique) || 0;
  if (numEntretien) add({ cle: 'entretien.numerique', outil: 'DIAGNOSTIC', zone: 'axe:digital', source: ENTRETIEN, score: numEntretien,
    texte: `Maîtrise du numérique évaluée en entretien : ${numEntretien}/5` });

  // Une même donnée saisie deux fois (ex. deux risques identiques au contrôle interne) n'est proposée qu'une fois.
  const vus = new Set<string>();
  return out.filter(s => {
    const k = `${s.outil}|${s.zone}|${s.texte.toLowerCase()}`;
    return !vus.has(k) && !!vus.add(k);
  });
}

/** « Profil client auto-généré depuis les données existantes » (fiche Persona / ICP). */
export function profilAuto(d: DonneesBp): ProfilAutoBp {
  const f = d.fiche ?? {};
  const s = syntheseCourante(d);
  const ca = nombre(s?.ca), caPrec = nombre(s?.caPrecedent);
  const n = d.piecesEnRetard.length;
  const acceptees = d.missions.filter(m => m.statut === 'ACCEPTEE');
  return {
    secteur: d.client.secteur ?? null,
    effectif: nombre(f.cycleChargesPaie?.nbSalaries),
    capital: nombre(f.capital),
    ca,
    croissanceCa: ca !== null && caPrec ? pct(ca, caPrec) : null,
    ancienneteRelationAns: d.client.createdAt ? Math.max(0, Math.floor(joursEntre(d.client.createdAt, d.aujourdhui) / 365)) : null,
    nbExercices: d.exercices.length,
    dateCreationEntreprise: f.dateCreation || null,
    maturiteNumerique: nombre(d.adn?.niveauNumerique) || null,
    disciplinePieces: { enRetard: n, appreciation: n === 0 ? 'Pièces à jour' : n <= 3 ? 'Quelques retards' : 'Retards fréquents' },
    missionsAcceptees: acceptees.length,
    cyclesMissions: [...new Set(acceptees.map(m => m.cycle).filter((c): c is string => !!c))],
  };
}

/** Moyenne mensuelle des tiers distincts comptés par l'import FEC (comptes 411 / 401). */
export function tiersParMois(balances: { nbClientsAttendu?: number | null; nbFournisseursAttendu?: number | null }[]) {
  const c = balances.map(b => Number(b.nbClientsAttendu)).filter(v => Number.isFinite(v) && v > 0);
  const fr = balances.map(b => Number(b.nbFournisseursAttendu)).filter(v => Number.isFinite(v) && v > 0);
  return { clients: moyenne(c), fournisseurs: moyenne(fr) };
}
