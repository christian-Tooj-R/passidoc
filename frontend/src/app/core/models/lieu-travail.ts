/** Pôle de travail d'une saisie (cahier v2 #5) : où le travail a été réalisé. */
export type LieuTravail = 'EST' | 'OUEST' | 'HORS_BUREAU';

/** Couleurs de l'agenda de référence d'AFYM (Outlook) : Est = bleu, Ouest = jaune, Hors bureau = violet. */
export const LIEUX_TRAVAIL: { code: LieuTravail; label: string; icon: string; couleur: string; fond: string; texte: string }[] = [
  { code: 'EST',         label: 'Pôle Est',    icon: 'apartment',    couleur: '#2563eb', fond: '#dbeafe', texte: '#1d4ed8' },
  { code: 'OUEST',       label: 'Pôle Ouest',  icon: 'apartment',    couleur: '#eab308', fond: '#fef9c3', texte: '#854d0e' },
  { code: 'HORS_BUREAU', label: 'Hors bureau', icon: 'directions_car', couleur: '#9333ea', fond: '#f3e8ff', texte: '#7e22ce' },
];

export function lieuTravail(code?: string | null) {
  return LIEUX_TRAVAIL.find(l => l.code === code) ?? null;
}
