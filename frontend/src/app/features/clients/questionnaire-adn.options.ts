export interface QOption { value: string; label: string; icon?: string; }

// ── Questionnaire Global ──────────────────────────────────────────
export const VISION_OPTS: QOption[] = [
  { value: 'STABLE',            label: 'Consolider l\'existant',  icon: 'anchor' },
  { value: 'CROISSANCE_MODEREE', label: 'Croissance modérée',      icon: 'trending_up' },
  { value: 'FORTE_EXPANSION',   label: 'Forte expansion',          icon: 'rocket_launch' },
  { value: 'TRANSMISSION',      label: 'Transmission / Vente',     icon: 'handshake' },
];

export const VALEUR_OPTS: QOption[] = [
  { value: 'QUALITE',            label: 'Qualité artisanale',        icon: 'workspace_premium' },
  { value: 'RAPIDITE',           label: 'Rapidité & efficacité',     icon: 'bolt' },
  { value: 'PROXIMITE',          label: 'Proximité & conseil humain', icon: 'favorite' },
  { value: 'RAPPORT_QUALITE_PRIX', label: 'Meilleur rapport Q/P',   icon: 'savings' },
];

export const PLACE_OPTS: QOption[] = [
  { value: 'OPERATIONNELLE', label: '100% opérationnel (je produis/je vends)', icon: 'engineering' },
  { value: 'MIXTE',          label: 'Mixte (gestion + production)',             icon: 'swap_horiz' },
  { value: 'SUPERVISION',    label: 'Supervision (je délègue)',                 icon: 'manage_accounts' },
];

export const AMBIANCE_OPTS: QOption[] = [
  { value: 'FAMILIALE',      label: 'Familiale & très soudée',      icon: 'groups' },
  { value: 'PROFESSIONNELLE', label: 'Professionnelle & structurée', icon: 'business_center' },
  { value: 'TENSION',        label: 'En tension (turnover, recrutement)', icon: 'warning' },
  { value: 'SANS_SALARIES',  label: 'Pas encore de salariés',       icon: 'person' },
];

export const ENJEUX_RH_OPTS: QOption[] = [
  { value: 'RECRUTER',  label: 'Recruter de nouveaux talents' },
  { value: 'FIDELISER', label: 'Fidéliser les salariés actuels' },
  { value: 'FORMER',    label: 'Former et monter en compétence' },
];

export const CANAUX_OPTS: QOption[] = [
  { value: 'BOUCHE_A_OREILLE', label: 'Bouche-à-oreille / Réputation',      icon: 'record_voice_over' },
  { value: 'EMPLACEMENT',      label: 'Emplacement physique (flux de passage)', icon: 'place' },
  { value: 'DIGITAL',          label: 'Réseaux sociaux & site internet',     icon: 'language' },
  { value: 'PUBLICITE',        label: 'Publicité / Partenariats',             icon: 'campaign' },
];

export const SAISONNALITE_OPTS: QOption[] = [
  { value: 'LINEAIRE',    label: 'Linéaire (activité constante)' },
  { value: 'SAISONNIERE', label: 'Saisonnière (tourisme, fêtes, météo)' },
  { value: 'CYCLIQUE',    label: 'Cyclique (marchés publics, contrats longs)' },
];

export const CAILLOU_OPTS: QOption[] = [
  { value: 'TRESORERIE',            label: 'Gestion de la trésorerie',             icon: 'account_balance' },
  { value: 'ADMINISTRATIF',         label: 'Complexité administrative et fiscale',  icon: 'description' },
  { value: 'VISIBILITE_RENTABILITE', label: 'Manque de visibilité sur la rentabilité', icon: 'analytics' },
  { value: 'MANQUE_TEMPS',          label: 'Manque de temps personnel',             icon: 'schedule' },
];

export const PROJETS_OPTS: QOption[] = [
  { value: 'IMMOBILIER',    label: 'Immobilier (achat de locaux)',  icon: 'home_work' },
  { value: 'MATERIEL',      label: 'Matériel ou véhicule',          icon: 'precision_manufacturing' },
  { value: 'DIGITALISATION', label: 'Digitalisation (logiciels, web)', icon: 'computer' },
  { value: 'AUCUN',         label: 'Aucun pour le moment',          icon: 'block' },
];

// ── Restauration ─────────────────────────────────────────────────
export const ZONE_RESTAU_OPTS: QOption[] = [
  { value: 'ZONE_COMMERCIALE', label: 'Zone commerciale / ZA (flux voitures)' },
  { value: 'CENTRE_VILLE',     label: 'Centre-ville / Rue commerçante (flux piéton)' },
  { value: 'ZONE_RURALE',      label: 'Zone rurale / Isolée' },
  { value: 'ZONE_BUREAUX',     label: 'Zone de bureaux / Quartier d\'affaires' },
];
export const ACCES_RESTAU_OPTS: QOption[] = [
  { value: 'PARKING',            label: 'Parking privatif' },
  { value: 'CONCURRENTS_PROCHES', label: 'Concurrents directs < 500 m' },
  { value: 'ZONE_TRAVAUX',       label: 'Zone en travaux / réaménagement urbain' },
];
export const INVENDUS_OPTS: QOption[] = [
  { value: 'TRANSFORMATION', label: 'Transformation (pudding, chapelure…)' },
  { value: 'DON',            label: 'Don / Too Good To Go' },
  { value: 'PERTE',          label: 'Perte sèche' },
];
export const COMMERCIALISATION_OPTS: QOption[] = [
  { value: 'DIRECT',     label: 'Direct' },
  { value: 'PLATEFORMES', label: 'Plateformes (UberEats, Deliveroo…)' },
  { value: 'CONTRATS',   label: 'Contrats récurrents B2B' },
];
export const ORG_EQUIPE_OPTS: QOption[] = [
  { value: 'ROTATION', label: 'Rotation (ex: 3h-12h)' },
  { value: 'CONTINU',  label: 'Service continu' },
  { value: 'COUPURE',  label: 'Coupure' },
];
export const HACCP_OPTS: QOption[] = [
  { value: 'PMS_OK', label: 'PMS à jour' },
  { value: 'MANUELS', label: 'Relevés manuels' },
  { value: 'AIDE',   label: 'Besoin d\'aide' },
];
export const BLOCAGE_RESTAU_OPTS: QOption[] = [
  { value: 'COUT_MATIERES',  label: 'Coût matières' },
  { value: 'MASSE_SALARIALE', label: 'Masse salariale' },
  { value: 'ENERGIE',         label: 'Énergie' },
  { value: 'LOYER',           label: 'Loyer' },
];
export const PROJETS_RESTAU_OPTS: QOption[] = [
  { value: 'CLICK_COLLECT', label: 'Click & Collect' },
  { value: 'BIO',           label: 'Gamme Bio / Santé' },
  { value: 'DEUXIEME_PDV',  label: '2ème point de vente' },
];

// ── BTP ──────────────────────────────────────────────────────────
export const ZONE_BTP_OPTS: QOption[] = [
  { value: 'ZA_ZI',   label: 'Zone d\'activités / Zone industrielle' },
  { value: 'URBAINE', label: 'Zone urbaine (accès difficile gros porteurs)' },
  { value: 'RURALE',  label: 'Zone rurale / Domicile du gérant' },
];
export const ACCES_BTP_OPTS: QOption[] = [
  { value: 'SEMI_REMORQUES',    label: 'Accès direct semi-remorques' },
  { value: 'PARKING_SECURISE',  label: 'Parking sécurisé pour la flotte' },
  { value: 'FOURNISSEURS_PROCHES', label: 'Proximité fournisseurs matériaux' },
];
export const SPECIALITE_BTP_OPTS: QOption[] = [
  { value: 'GROS_OEUVRE',    label: 'Gros œuvre (maçonnerie, structure, démolition)' },
  { value: 'SECOND_OEUVRE',  label: 'Second œuvre (plomberie, électricité, peinture…)' },
  { value: 'TRAVAUX_PUBLICS', label: 'Travaux Publics (VRD, terrassement, routes)' },
];
export const CLIENTS_BTP_OPTS: QOption[] = [
  { value: 'PARTICULIERS',   label: 'Particuliers (rénovation, maisons individuelles)' },
  { value: 'MARCHES_PUBLICS', label: 'Marchés publics (mairies, collectivités)' },
  { value: 'PRO_PROMO',      label: 'Professionnels / Promotion immobilière' },
];
export const SOUS_TRAITANCE_OPTS: QOption[] = [
  { value: 'INTERNE',         label: '100% interne' },
  { value: 'PONCTUEL',        label: 'Sous-traitance ponctuelle' },
  { value: 'DONNEUR_ORDRES',  label: 'Principalement donneur d\'ordres' },
];
export const ASSURANCE_BTP_OPTS: QOption[] = [
  { value: 'OK',       label: 'À jour, toutes attestations disponibles' },
  { value: 'EN_COURS', label: 'En cours de renégociation' },
];
export const REVENU_BTP_OPTS: QOption[] = [
  { value: 'AVANCEMENT', label: 'À l\'avancement' },
  { value: 'ACHEVEMENT',  label: 'À l\'achèvement' },
];
export const CARNET_BTP_OPTS: QOption[] = [
  { value: 'PLUS_6_MOIS', label: 'Visibilité > 6 mois' },
  { value: '3_A_6_MOIS',  label: '3 à 6 mois' },
  { value: 'FLUX_TENDU',  label: 'Flux tendu' },
];

// ── Association ───────────────────────────────────────────────────
export const DOMAINE_ASSO_OPTS: QOption[] = [
  { value: 'SOCIAL',    label: 'Social / Humanitaire' },
  { value: 'SPORTIF',   label: 'Sportif' },
  { value: 'CULTUREL',  label: 'Culturel' },
  { value: 'EDUCATIF',  label: 'Éducatif / Formation' },
];

// ── Holding ───────────────────────────────────────────────────────
export const VOCATION_HOLDING_OPTS: QOption[] = [
  { value: 'PURE',       label: 'Holding Pure (détention de titres uniquement)' },
  { value: 'ANIMATRICE', label: 'Holding Animatrice (participation active + services)' },
];
export const MANAGEMENT_HOLDING_OPTS: QOption[] = [
  { value: 'DIRIGEANT_TOUT',   label: 'Le dirigeant gérant toutes les filiales' },
  { value: 'DIRECTEURS_PROPRES', label: 'Chaque filiale a son propre directeur' },
];
export const MANAGEMENT_FEES_OPTS: QOption[] = [
  { value: 'DIRECTION', label: 'Direction générale / Stratégie' },
  { value: 'ADMIN',     label: 'Services administratifs et comptables' },
  { value: 'LOCAUX',    label: 'Mise à disposition locaux / matériel' },
];
export const REGIMES_HOLDING_OPTS: QOption[] = [
  { value: 'INTEGRATION_FISCALE', label: 'Intégration fiscale (compensation pertes/profits)' },
  { value: 'MERE_FILLE',          label: 'Régime Mère-Fille (exonération dividendes)' },
];

// ── Profession Libérale ───────────────────────────────────────────
export const ZONE_LIBERAL_OPTS: QOption[] = [
  { value: 'CENTRE_VILLE',  label: 'Centre-ville / Zone de forte visibilité' },
  { value: 'POLE_SANTE',    label: 'Proximité d\'un pôle de santé' },
  { value: 'RESIDENTIEL',   label: 'Quartier résidentiel (calme, discrétion)' },
  { value: 'BUREAUX',       label: 'Centre d\'affaires / Immeuble de bureaux' },
];
export const ACCES_LIBERAL_OPTS: QOption[] = [
  { value: 'PMR',       label: 'Cabinet aux normes PMR' },
  { value: 'PARKING',   label: 'Parking réservé / Stationnement facile' },
  { value: 'TRANSPORTS', label: 'Proche transports en commun' },
];
export const MODE_LIBERAL_OPTS: QOption[] = [
  { value: 'INDIVIDUEL',   label: 'Individuel (BNC)' },
  { value: 'GROUPE_FRAIS', label: 'Groupe avec partage de frais (SCM)' },
  { value: 'SOCIETE',      label: 'Société de capitaux (SELARL, SELAS)' },
];
export const SECRETARIAT_OPTS: QOption[] = [
  { value: 'PHYSIQUE',  label: 'Physique sur place' },
  { value: 'TELE',      label: 'Télésecrétariat' },
  { value: 'AUTONOME',  label: 'Autonome (sans secrétariat)' },
];

// ── SCI ───────────────────────────────────────────────────────────
export const PATRIMOINE_SCI_OPTS: QOption[] = [
  { value: 'ENTREPRISE', label: 'Immobilier d\'entreprise (bureaux, ateliers, entrepôts)' },
  { value: 'RESIDENTIEL', label: 'Immobilier résidentiel (appartements, maisons)' },
  { value: 'MIXTE',      label: 'Mixte' },
];
export const ETAT_SCI_OPTS: QOption[] = [
  { value: 'NEUF',      label: 'Neuf ou récent (< 10 ans)' },
  { value: 'ENTRETENU', label: 'Ancien mais entretenu (travaux réguliers)' },
  { value: 'RENOVATION', label: 'Nécessite des rénovations lourdes' },
];
export const OBJECTIF_SCI_OPTS: QOption[] = [
  { value: 'PROTECTION',  label: 'Protection du patrimoine professionnel' },
  { value: 'REVENUS',     label: 'Revenus complémentaires (investissement locatif)' },
  { value: 'TRANSMISSION', label: 'Transmission familiale (démembrement, donation)' },
];
export const REGIME_SCI_OPTS: QOption[] = [
  { value: 'IR', label: 'Impôt sur le Revenu — IR (translucidité fiscale)' },
  { value: 'IS', label: 'Impôt sur les Sociétés — IS (option irrévocable)' },
];

// ── Helper : label depuis valeur ──────────────────────────────────
export function labelOf(opts: QOption[], value: string | undefined): string {
  return opts.find(o => o.value === value)?.label ?? value ?? '—';
}

export function labelsOf(opts: QOption[], values: string[] | undefined): string {
  if (!values?.length) return '—';
  return values.map(v => opts.find(o => o.value === v)?.label ?? v).join(', ');
}
