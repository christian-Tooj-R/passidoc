import { describe, it, expect } from 'vitest';
import { formatReponseDynamique, itemsAdnDynamique, itemsAdnSectoriel, libelleNiveauNumerique, sectionsAdnGlobal } from './adn-lecture.util';

describe('lecture de l’ADN entreprise (partagée onglet ADN / note de passation)', () => {
  it('ADN global : 4 sections et libellés lisibles des réponses', () => {
    const s = sectionsAdnGlobal({ mission: 'Lire', visionActivite: 'CROISSANCE_MODEREE', canauxAcquisition: ['BOUCHE_A_OREILLE'], niveauNumerique: 3 });
    expect(s.map(x => x.titre)).toEqual(['I — Vision et Identité', 'II — Capital Humain', 'III — Modèle Économique', 'IV — Vigilance et Projets']);
    const items = Object.fromEntries(s.flatMap(x => x.items).map(i => [i.label, i.value]));
    expect(items['Mission']).toBe('Lire');
    expect(items['Vision à 3 ans']).toBe('Croissance modérée');
    expect(items["Canaux d'acquisition"]).toContain('Bouche-à-oreille');
    expect(items['Aisance numérique']).toBe('3/5 — Moyen');
    expect(items['Valeur n°1']).toBe('—');
    expect(sectionsAdnGlobal(null).flatMap(x => x.items).every(i => i.value === '—')).toBe(true);
  });

  it('questionnaire sectoriel codé (association) et secteur inconnu', () => {
    const items = itemsAdnSectoriel('ASSOCIATION', { surface_totale: 120, domaine: 'CULTUREL', pct_subventions: 75 });
    expect(items.find(i => i.label === 'Surface totale')?.value).toBe('120 m²');
    expect(items.find(i => i.label === 'Domaine')?.value).toBe('Culturel');
    expect(items.find(i => i.label === 'Subventions')).toMatchObject({ value: '75 %', warn: true });
    expect(itemsAdnSectoriel('SECTEUR_PERSO', {})).toEqual([]);
    expect(itemsAdnSectoriel(null)).toEqual([]);
  });

  it('questionnaire sectoriel dynamique : libellés des options', () => {
    const q = [{ id: 'q1', label: 'Canal', type: 'multiselect' as const, options: [{ value: 'A', label: 'Alpha' }] }, { id: 'q2', label: 'Note', type: 'text' as const }];
    expect(itemsAdnDynamique(q, { q1: ['A', 'Z'], q2: '' })).toEqual([
      { label: 'Canal', value: 'Alpha, Z', full: true },
      { label: 'Note', value: '—', full: false },
    ]);
    expect(formatReponseDynamique({ options: [{ value: 'A', label: 'Alpha' }] } as any, 'A')).toBe('Alpha');
    expect(libelleNiveauNumerique(5)).toBe('Expert');
    expect(libelleNiveauNumerique(null)).toBe('');
  });
});
