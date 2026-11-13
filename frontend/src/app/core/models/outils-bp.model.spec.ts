/**
 * Tableau de Bord BP — suggestions PASSIDOC appliquées aux outils et comparaison N / N-1.
 */
import { describe, it, expect } from 'vitest';
import {
  SuggestionBp, appliquerSuggestion, criticite, ecarterSuggestion, evolutionN1, menaceGlobalePorter, scoreDiagnostic, suggestionTraitee,
} from './outils-bp.model';

const sug = (o: Partial<SuggestionBp>): SuggestionBp =>
  ({ cle: 'k', outil: 'SWOT', zone: 'forces', texte: 'Texte', source: 'ADN entreprise', ...o } as SuggestionBp);

const porterVide = () => ({ forces: Object.fromEntries(['nouveauxEntrants', 'pouvoirClients', 'substituts', 'pouvoirFournisseurs', 'concurrence']
  .map(f => [f, { niveau: 0, elements: [] }])), ecartees: [] });

describe('Suggestions PASSIDOC appliquées aux outils', () => {
  it('SWOT : l’élément ajouté porte la clé, la suggestion devient traitée ; le contenu d’origine est intact', () => {
    const avant = { forces: [], faiblesses: [], opportunites: [], menaces: [], ecartees: [] };
    const s = sug({ cle: 'swot.valeur', texte: 'Valeur clé reconnue : qualité' });
    const apres = appliquerSuggestion('SWOT', avant, s);
    expect(apres.forces).toEqual([{ id: expect.any(String), texte: 'Valeur clé reconnue : qualité', cle: 'swot.valeur' }]);
    expect(avant.forces).toEqual([]);
    expect(suggestionTraitee(avant, s)).toBe(false);
    expect(suggestionTraitee(apres, s)).toBe(true);
  });

  it('écarter : la suggestion ne revient plus', () => {
    const s = sug({ cle: 'swot.ca' });
    const c = ecarterSuggestion({ forces: [], ecartees: ['autre'] }, s);
    expect(c.ecartees).toEqual(['autre', 'swot.ca']);
    expect(suggestionTraitee(c, s)).toBe(true);
  });

  it('Porter : ajout dans les éléments de la force', () => {
    const c = appliquerSuggestion('PORTER', porterVide(), sug({ outil: 'PORTER', zone: 'concurrence', texte: '3 concurrents' }));
    expect(c.forces.concurrence.elements[0].texte).toBe('3 concurrents');
  });

  it('Diagnostic : la note proposée est reprise et l’explication va dans les notes de l’axe', () => {
    const c = appliquerSuggestion('DIAGNOSTIC', { axes: { finance: { score: 0, note: 'Déjà noté' } }, forces: [], faiblesses: [], ecartees: [] },
      sug({ cle: 'diag.finance', outil: 'DIAGNOSTIC', zone: 'axe:finance', score: 4, texte: 'Résultat positif' }));
    expect(c.axes.finance).toEqual({ score: 4, note: 'Déjà noté\nRésultat positif' });
    expect(c.ecartees).toEqual(['diag.finance']);
  });

  it('Chaîne de valeur : description d’activité et marge', () => {
    const base = { activites: { production: { description: '', importance: 0, performance: 0 } }, marge: '', forces: [], faiblesses: [], ecartees: [] };
    const c = appliquerSuggestion('CHAINE_VALEUR', base, sug({ cle: 'chaine.production', outil: 'CHAINE_VALEUR', zone: 'activite:production', texte: 'Boulangerie' }));
    expect(c.activites.production.description).toBe('Boulangerie');
    const m = appliquerSuggestion('CHAINE_VALEUR', c, sug({ cle: 'chaine.marge', outil: 'CHAINE_VALEUR', zone: 'marge', texte: "Marge d'EBE : 12 %" }));
    expect(m.marge).toBe("Marge d'EBE : 12 %");
  });

  it('Matrice de risques : un risque coté, rattaché à sa source', () => {
    const c = appliquerSuggestion('RISQUES', { risques: [], ecartees: [] }, sug({
      cle: 'risque.tva', outil: 'RISQUES', zone: 'risques', texte: 'Déclarations de TVA en retard', source: 'Pilotage des pièces',
      risque: { categorie: 'FISCAL', probabilite: 4, gravite: 3 },
    }));
    expect(c.risques[0]).toMatchObject({
      nom: 'Déclarations de TVA en retard', categorie: 'FISCAL', probabilite: 4, gravite: 3, cle: 'risque.tva',
      description: 'Détecté par PASSIDOC (Pilotage des pièces)',
    });
  });

  it('Persona / ICP : champ texte rempli, liste complétée', () => {
    const base = { persona: { age: '', poste: '', lieu: '', bio: '', objectifs: [] }, icp: { secteurs: [] }, ecartees: [] };
    let c = appliquerSuggestion('PERSONA', base, sug({ cle: 'persona.age', outil: 'PERSONA', zone: 'persona.age', texte: '58 ans' }));
    c = appliquerSuggestion('PERSONA', c, sug({ cle: 'icp.secteur', outil: 'PERSONA', zone: 'icp.secteurs', texte: 'Boulangerie' }));
    expect(c.persona.age).toBe('58 ans');
    expect(c.icp.secteurs[0]).toMatchObject({ texte: 'Boulangerie', cle: 'icp.secteur' });
    expect(c.ecartees).toEqual(['persona.age']);
  });
});

describe('Comparaison N / N-1', () => {
  it('SWOT : ajouts et retraits par quadrant (casse et espaces ignorés)', () => {
    const n1 = { forces: [{ id: '1', texte: 'Clientèle fidèle' }, { id: '2', texte: 'Bonne marge' }], menaces: [] };
    const n = { forces: [{ id: '3', texte: ' clientèle fidèle ' }], menaces: [{ id: '4', texte: 'Grande surface' }] };
    expect(evolutionN1('SWOT', n, n1)).toEqual({
      ajouts: ['Menaces : Grande surface'], retraits: ['Forces : Bonne marge'], changements: [],
    });
  });

  it('Porter : changement de niveau et de menace globale', () => {
    const n1 = porterVide();
    const n = porterVide();
    n.forces['concurrence'].niveau = 3;
    expect(evolutionN1('PORTER', n, n1).changements).toEqual([
      'Intensité concurrence : Non évalué → Élevé', 'Menace globale : 0/15 → 3/15',
    ]);
  });

  it('Risques : nouveau risque et criticité modifiée', () => {
    const n1 = { risques: [{ nom: 'Retard TVA', probabilite: 2, gravite: 3 }] };
    const n = { risques: [{ nom: 'Retard TVA', probabilite: 4, gravite: 3 }, { nom: 'Fraude caisse', probabilite: 1, gravite: 5 }] };
    expect(evolutionN1('RISQUES', n, n1)).toEqual({
      ajouts: ['Risque : Fraude caisse'], retraits: [], changements: ['Criticité « Retard TVA » : 6 → 12'],
    });
  });

  it('pas de N-1 : aucune évolution', () => {
    expect(evolutionN1('SWOT', { forces: [] }, undefined)).toEqual({ ajouts: [], retraits: [], changements: [] });
  });
});

describe('Indicateurs (identiques au serveur)', () => {
  it.each([[1, 4, 'ACCEPTABLE'], [1, 5, 'TOLERABLE'], [2, 5, 'A_TRAITER'], [3, 5, 'INACCEPTABLE']])('criticité %i × %i → %s', (p, g, zone) => {
    expect(criticite(p, g).zone).toBe(zone);
  });

  it('menace globale de Porter et score du diagnostic', () => {
    const p = porterVide();
    expect(menaceGlobalePorter(p)).toMatchObject({ score: 0, label: 'Aucune évaluation' });
    p.forces['concurrence'].niveau = 3; p.forces['pouvoirClients'].niveau = 3; p.forces['substituts'].niveau = 3; p.forces['nouveauxEntrants'].niveau = 2;
    expect(menaceGlobalePorter(p)).toMatchObject({ score: 11, label: 'Menace forte' });
    expect(scoreDiagnostic({ axes: { finance: { score: 4 }, rh: { score: 3 } } })).toBe(3.5);
  });
});
