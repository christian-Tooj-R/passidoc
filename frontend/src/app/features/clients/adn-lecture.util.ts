import { QuestionnaireAdnGlobal } from '../../core/models/client.model';
import { SecteurQuestion } from '../../core/models/secteur.model';
import {
  VISION_OPTS, VALEUR_OPTS, PLACE_OPTS, AMBIANCE_OPTS, ENJEUX_RH_OPTS,
  CANAUX_OPTS, SAISONNALITE_OPTS, CAILLOU_OPTS, PROJETS_OPTS,
  ACCES_BTP_OPTS, ACCES_LIBERAL_OPTS, ACCES_RESTAU_OPTS, ASSURANCE_BTP_OPTS, BLOCAGE_RESTAU_OPTS, CARNET_BTP_OPTS, CLIENTS_BTP_OPTS, COMMERCIALISATION_OPTS, DOMAINE_ASSO_OPTS, ETAT_SCI_OPTS, HACCP_OPTS, INVENDUS_OPTS, MANAGEMENT_FEES_OPTS, MANAGEMENT_HOLDING_OPTS, MODE_LIBERAL_OPTS, OBJECTIF_SCI_OPTS, ORG_EQUIPE_OPTS, PATRIMOINE_SCI_OPTS, PROJETS_RESTAU_OPTS, REGIMES_HOLDING_OPTS, REGIME_SCI_OPTS, REVENU_BTP_OPTS, SECRETARIAT_OPTS, SOUS_TRAITANCE_OPTS, SPECIALITE_BTP_OPTS, VOCATION_HOLDING_OPTS, ZONE_BTP_OPTS, ZONE_LIBERAL_OPTS, ZONE_RESTAU_OPTS,
  labelOf, labelsOf,
} from './questionnaire-adn.options';

/**
 * Lecture « fiche » de l'ADN entreprise (libellés lisibles des réponses), partagée par l'onglet
 * ADN et la note de passation (cahier v2 #8) pour qu'ils affichent exactement la même chose.
 */
export interface ItemFiche { label: string; value: string; chip?: boolean; warn?: boolean; full?: boolean; }
export interface SectionFiche { titre: string; items: ItemFiche[]; }

export function libelleNiveauNumerique(n?: number | null): string {
  return n ? (['', 'Débutant', 'Faible', 'Moyen', 'À l\'aise', 'Expert'][n] ?? '') : '';
}

/** ADN global — tronc commun, mêmes sections et libellés que l'onglet ADN en lecture. */
export function sectionsAdnGlobal(g: Partial<QuestionnaireAdnGlobal> | null | undefined): SectionFiche[] {
  const v = g ?? {};
  const txt = (t?: string) => t?.trim() || '—';
  return [
    { titre: 'I — Vision et Identité', items: [
      { label: 'Mission', value: txt(v.mission), full: true },
      { label: 'Vision à 3 ans', value: labelOf(VISION_OPTS, v.visionActivite), chip: true },
      { label: 'Valeur n°1', value: labelOf(VALEUR_OPTS, v.valeurCle), chip: true },
    ] },
    { titre: 'II — Capital Humain', items: [
      { label: 'Place du dirigeant', value: labelOf(PLACE_OPTS, v.placeExploitation), chip: true },
      { label: 'Ambiance équipe', value: labelOf(AMBIANCE_OPTS, v.ambianceEquipe), chip: true },
      { label: 'Enjeu RH', value: labelOf(ENJEUX_RH_OPTS, v.enjeuxRH), chip: true },
    ] },
    { titre: 'III — Modèle Économique', items: [
      { label: "Canaux d'acquisition", value: labelsOf(CANAUX_OPTS, v.canauxAcquisition), full: true },
      { label: 'Principal concurrent', value: txt(v.principalConcurrent), full: true },
      { label: 'Saisonnalité', value: labelOf(SAISONNALITE_OPTS, v.saisonnalite), chip: true },
    ] },
    { titre: 'IV — Vigilance et Projets', items: [
      { label: 'Caillou dans la chaussure', value: labelOf(CAILLOU_OPTS, v.caillouChaussure), chip: true, warn: true },
      { label: 'Projets investissement', value: labelsOf(PROJETS_OPTS, v.projetsInvestissement), full: true },
      { label: 'Aisance numérique', value: v.niveauNumerique ? `${v.niveauNumerique}/5 — ${libelleNiveauNumerique(v.niveauNumerique)}` : '—' },
    ] },
  ];
}

/** Réponse d'un questionnaire sectoriel dynamique (secteur paramétré en base). */
export function formatReponseDynamique(q: Pick<SecteurQuestion, 'options'>, val: any): string {
  if (val == null || val === '') return '—';
  if (Array.isArray(val)) {
    if (!val.length) return '—';
    if (q.options?.length) return val.map((x: string) => q.options!.find(o => o.value === x)?.label ?? x).join(', ');
    return val.join(', ');
  }
  if (q.options?.length) return q.options.find(o => o.value === val)?.label ?? val;
  return String(val);
}

/** Questionnaire sectoriel des 6 secteurs codés (restauration, BTP, association…). */
export function itemsAdnSectoriel(secteur: string | null | undefined, rep: Record<string, any> = {}): ItemFiche[] {
  const items: ItemFiche[] = [];
  const add = (label: string, value: string, opts?: Omit<ItemFiche, 'label' | 'value'>) =>
    items.push({ label, value: value || '—', ...opts });

  const s = secteur;
  if (!s) return [];

  const num = (v: any) => v != null ? `${v} m²` : '—';
  const pct = (v: any) => v != null ? `${v} %` : '—';

  if (s === 'RESTAURATION') {
    add('Surface totale', num(rep['surface_totale']));
    add('Surface vente', num(rep['surface_vente']));
    add('Surface cuisine', num(rep['surface_production']));
    add('Surface stockage', num(rep['surface_stockage']));
    add('Terrasse', num(rep['surface_terrasse']));
    add('Zone', labelOf(ZONE_RESTAU_OPTS, rep['zone_implantation']), { chip: true });
    add('Accessibilité', labelsOf(ACCES_RESTAU_OPTS, rep['accessibilite']), { full: true, warn: rep['accessibilite']?.includes('ZONE_TRAVAUX') });
    add('CA Boutique', pct(rep['ca_boutique']));
    add('CA Sur place', pct(rep['ca_sur_place']));
    add('CA Traiteur', pct(rep['ca_traiteur']));
    add('Ticket moyen', rep['ticket_moyen'] ? `${rep['ticket_moyen']} €` : '—');
    add('Signature', rep['signature'] || '—', { full: true });
    add('Invendus', labelsOf(INVENDUS_OPTS, rep['invendus']), { full: true });
    add('Commercialisation', labelsOf(COMMERCIALISATION_OPTS, rep['commercialisation']), { full: true });
    add('Org. équipes', labelOf(ORG_EQUIPE_OPTS, rep['organisation_equipe']), { chip: true });
    add('HACCP', labelOf(HACCP_OPTS, rep['haccp']), { chip: true });
    add('Blocage principal', labelOf(BLOCAGE_RESTAU_OPTS, rep['blocage_principal']), { chip: true, warn: true });
    add('Projets', labelsOf(PROJETS_RESTAU_OPTS, rep['projets']), { full: true });
  } else if (s === 'BTP') {
    add('Surface totale', num(rep['surface_totale']));
    add('Dépôt', num(rep['surface_depot']));
    add('Bureaux', num(rep['surface_bureaux']));
    add('Atelier', num(rep['surface_atelier']));
    add('Zone', labelOf(ZONE_BTP_OPTS, rep['zone_implantation']), { chip: true });
    add('Accessibilité', labelsOf(ACCES_BTP_OPTS, rep['accessibilite']), { full: true });
    add('Spécialité', labelOf(SPECIALITE_BTP_OPTS, rep['specialite']), { chip: true });
    add('Clients', labelOf(CLIENTS_BTP_OPTS, rep['nature_clients']), { chip: true });
    add('Périmètre', rep['perimetre_geo'] || '—', { full: true });
    add('Sous-traitance', labelOf(SOUS_TRAITANCE_OPTS, rep['sous_traitance']), { chip: true });
    add('Décennale', labelOf(ASSURANCE_BTP_OPTS, rep['assurance_decennale']), { chip: true, warn: rep['assurance_decennale'] === 'EN_COURS' });
    add('Méthode revenu', labelOf(REVENU_BTP_OPTS, rep['methode_revenu']), { chip: true });
    add('Carnet commandes', labelOf(CARNET_BTP_OPTS, rep['carnet_commandes']), { chip: true, warn: rep['carnet_commandes'] === 'FLUX_TENDU' });
  } else if (s === 'ASSOCIATION') {
    add('Surface totale', num(rep['surface_totale']));
    add('Bureaux', num(rep['surface_bureaux']));
    add('Accueil public', num(rep['surface_accueil']));
    add('Domaine', labelOf(DOMAINE_ASSO_OPTS, rep['domaine']), { chip: true });
    add('Membres bureau', rep['nb_bureau'] ?? '—');
    add('Adhérents', rep['nb_adherents'] ?? '—');
    add('Bénévoles', rep['nb_benevoles'] ?? '—');
    add('Cotisations', pct(rep['pct_cotisations']));
    add('Subventions', pct(rep['pct_subventions']), { warn: rep['pct_subventions'] > 70 });
    add('Dons', pct(rep['pct_dons']));
  } else if (s === 'HOLDING') {
    add('Vocation', labelOf(VOCATION_HOLDING_OPTS, rep['vocation']), { chip: true });
    add('Nb filiales', rep['nb_filiales'] ?? '—');
    add('Management', labelOf(MANAGEMENT_HOLDING_OPTS, rep['politique_management']), { chip: true, full: true });
    add('Management Fees', labelsOf(MANAGEMENT_FEES_OPTS, rep['management_fees']), { full: true });
    add('Régimes fiscaux', labelsOf(REGIMES_HOLDING_OPTS, rep['regimes_fiscaux']), { full: true });
  } else if (s === 'PROFESSION_LIBERALE') {
    add('Surface totale', num(rep['surface_totale']));
    add('Salles consult.', rep['nb_salles_consult'] ?? '—');
    add('Salle d\'attente', num(rep['surface_attente']));
    add('RDV / semaine', rep['nb_rdv_semaine'] ?? '—');
    add('Zone cabinet', labelOf(ZONE_LIBERAL_OPTS, rep['zone_cabinet']), { chip: true });
    add('Accessibilité', labelsOf(ACCES_LIBERAL_OPTS, rep['accessibilite']), { full: true, warn: !rep['accessibilite']?.includes('PMR') });
    add('Mode d\'exercice', labelOf(MODE_LIBERAL_OPTS, rep['mode_exercice']), { chip: true });
    add('Spécialité', rep['specialite'] || '—', { full: true });
    add('Secrétariat', labelOf(SECRETARIAT_OPTS, rep['secretariat']), { chip: true });
  } else if (s === 'SCI') {
    add('Patrimoine', labelOf(PATRIMOINE_SCI_OPTS, rep['nature_patrimoine']), { chip: true });
    add('Surface totale', num(rep['surface_totale']));
    add('Surface habitable', num(rep['surface_habitable']));
    add('Dépendances', num(rep['surface_dependances']));
    add('État des biens', labelOf(ETAT_SCI_OPTS, rep['etat_biens']), { chip: true, warn: rep['etat_biens'] === 'RENOVATION' });
    add('Objectif SCI', labelOf(OBJECTIF_SCI_OPTS, rep['objectif_sci']), { chip: true, full: true });
    add('Régime fiscal', labelOf(REGIME_SCI_OPTS, rep['regime_fiscal']), { chip: true });
  }
  return items;
}

/** Questionnaire sectoriel dynamique : une ligne par question paramétrée. */
export function itemsAdnDynamique(questions: SecteurQuestion[] | undefined, rep: Record<string, any> = {}): ItemFiche[] {
  return (questions ?? []).map(q => ({
    label: q.label, value: formatReponseDynamique(q, rep[q.id]), full: q.type === 'textarea' || q.type === 'multiselect',
  }));
}
