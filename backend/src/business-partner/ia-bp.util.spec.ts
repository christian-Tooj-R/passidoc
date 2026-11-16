import { consigneIa, lireReponseIa, zonesIa } from './ia-bp.util';

describe('Tableau de bord BP — suggestions IA', () => {
  it('zones proposées par outil (quadrants pour la BCG) ; aucune pour l’entretien', () => {
    expect(Object.keys(zonesIa('SWOT'))).toEqual(['forces', 'faiblesses', 'opportunites', 'menaces']);
    expect(Object.keys(zonesIa('PERSONA'))).toContain('icp.problemes');
    expect(Object.keys(zonesIa('BCG'))).toEqual(['VEDETTE', 'DILEMME', 'VACHE', 'POIDS_MORT']);
    expect(zonesIa('ENTRETIEN')).toEqual({});
  });

  it('la consigne cite l’outil, les zones et les données du dossier', () => {
    const { utilisateur } = consigneIa('RISQUES', ['- [ADN] Tensions de trésorerie']);
    expect(utilisateur).toContain('Matrice de risques');
    expect(utilisateur).toContain('"probabilite": 1 à 5');
    expect(utilisateur).toContain('Tensions de trésorerie');
  });

  it('lecture stricte : JSON entouré de texte, zone inconnue, texte vide et doublons écartés', () => {
    const reponse = `Voici : {"suggestions": [
      {"zone": "menaces", "texte": "Concurrence du supermarché", "pourquoi": "Entretien"},
      {"zone": "inconnue", "texte": "X"},
      {"zone": "forces", "texte": "  "},
      {"zone": "forces", "texte": "Clientèle fidèle"},
      {"zone": "menaces", "texte": "concurrence du SUPERMARCHÉ"}
    ]} fin`;
    const s = lireReponseIa('SWOT', reponse, ['Clientèle   fidèle']);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ outil: 'SWOT', zone: 'menaces', texte: 'Concurrence du supermarché', source: 'IA PASSIDOC — Entretien' });
    expect(s[0].cle).toMatch(/^ia\.swot\.[0-9a-f]{10}$/);
    expect(lireReponseIa('SWOT', reponse, ['Clientèle fidèle'])[0].cle).toBe(s[0].cle);
  });

  it('risques : catégorie et cotation bornées', () => {
    const s = lireReponseIa('RISQUES', '{"suggestions":[{"zone":"risques","texte":"Panne du four","categorie":"PIRATE","probabilite":9,"gravite":"2"}]}', []);
    expect(s[0].risque).toEqual({ categorie: 'AUTRE', probabilite: 5, gravite: 2 });
  });

  it('réponse illisible : aucune suggestion', () => {
    expect(lireReponseIa('SWOT', 'pas de json', [])).toEqual([]);
    expect(lireReponseIa('SWOT', '{"suggestions": [', [])).toEqual([]);
  });

  it('BCG : activité proposée dans un quadrant connu seulement', () => {
    const s = lireReponseIa('BCG', '{"suggestions":[{"zone":"VACHE","texte":"Pain"},{"zone":"ETOILE","texte":"Snacking"}]}', []);
    expect(s.map(x => [x.zone, x.texte])).toEqual([['VACHE', 'Pain']]);
    expect(consigneIa('BCG', []).utilisateur).toContain('VENDUE aux clients');
  });
});
