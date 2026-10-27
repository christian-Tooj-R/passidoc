import { analyserPieces, echeance, listePieces, moisEchus, prenomDe, redigerRelance } from './suivi-pieces.util';

const T = [{ key: 'RELEVE_BANCAIRE', label: 'Relevés bancaires' }];

describe('suivi des pièces manquantes (cahier v2 #1)', () => {
  it('un document du mois M est attendu à partir du 1er du mois M+1', () => {
    expect(echeance(2026, 9)).toBe('2026-10-01');
    expect(echeance(2026, 12)).toBe('2027-01-01');
    expect(moisEchus('RELEVE_BANCAIRE', 2026, '2026-10-01')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(moisEchus('RELEVE_BANCAIRE', 2026, '2026-09-30')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('respecte la périodicité (trimestrielle, annuelle)', () => {
    expect(moisEchus('TVA_TRIMESTRIELLE', 2026, '2026-10-23')).toEqual([3, 6, 9]);
    expect(moisEchus('TVA_ANNUELLE', 2026, '2026-10-23')).toEqual([]);
    expect(moisEchus('TVA_ANNUELLE', 2025, '2026-10-23')).toEqual([12]);
  });

  it('VERT : tout ce qui est échu est déposé', () => {
    const flux = [1, 2, 3].map(m => ({ type: 'RELEVE_BANCAIRE', mois: m, annee: 2026, statut: 'DEPOSE' }));
    const a = analyserPieces({ types: T, flux, annee: 2026, aujourdhui: '2026-04-10' });
    expect(a).toMatchObject({ attendus: 3, deposes: 3, taux: 100, indicateur: 'VERT', manquantes: [] });
  });

  it('ORANGE dans le délai, ROUGE au-delà ; les absents comptent comme manquants', () => {
    const flux = [
      { type: 'RELEVE_BANCAIRE', mois: 1, annee: 2026, statut: 'DEPOSE' },
      { type: 'RELEVE_BANCAIRE', mois: 2, annee: 2026, statut: 'EN_RETARD', dateRelance: '2026-03-20T08:00:00Z' },
    ];
    const orange = analyserPieces({ types: [{ key: 'RELEVE_BANCAIRE', label: 'R' }], flux: [flux[0]], annee: 2026, aujourdhui: '2026-03-10', delaiJours: 15 });
    expect(orange).toMatchObject({ indicateur: 'ORANGE', horsDelai: 0, plusAncienRetard: 9 });
    const rouge = analyserPieces({ types: T, flux, annee: 2026, aujourdhui: '2026-04-20', delaiJours: 15 });
    expect(rouge.indicateur).toBe('ROUGE');
    expect(rouge.manquantes.map(p => [p.mois, p.statut, p.joursRetard])).toEqual([[2, 'EN_RETARD', 50], [3, 'MANQUANT', 19]]);
    expect(rouge).toMatchObject({ attendus: 3, deposes: 1, taux: 33, horsDelai: 2, derniereRelance: '2026-03-20T08:00:00.000Z' });
  });

  it('rien d’échu : complet à 100 %', () => {
    expect(analyserPieces({ types: T, flux: [], annee: 2026, aujourdhui: '2026-01-15' })).toMatchObject({ attendus: 0, taux: 100, indicateur: 'VERT' });
  });

  it('prénom probable du contact (format Pappers « NOM Prénom » ou « Prénom Nom »)', () => {
    expect(prenomDe('DUBOIS Marie')).toBe('Marie');
    expect(prenomDe('Marie Dubois')).toBe('Marie');
    expect(prenomDe('Sophie')).toBe('Sophie');
    expect(prenomDe('  ')).toBeNull();
  });

  it('liste les périodes manquantes par type de document', () => {
    const p = (mois: number) => ({ type: 'R', libelle: 'Relevés bancaires', mois, annee: 2026, echeance: '', joursRetard: 0, statut: 'MANQUANT' as const });
    expect(listePieces([p(9), p(8)])).toBe('• Relevés bancaires : août 2026, septembre 2026');
  });

  it('rédige la relance selon l’approche : vouvoiement formel → tutoiement informel', () => {
    const m = [{ type: 'R', libelle: 'Relevés bancaires', mois: 9, annee: 2026, echeance: '', joursRetard: 30, statut: 'MANQUANT' as const }];
    const base = { contactNom: 'DUBOIS Marie', dossier: 'TRANSMAS', cabinet: 'AFYM', signataire: 'Julie R', manquantes: m };
    const formel = redigerRelance({ ...base, approche: 'FORMEL' });
    expect(formel.objet).toBe('Documents comptables manquants — TRANSMAS');
    expect(formel.texte).toMatch(/^Madame, Monsieur,/);
    expect(formel.texte).toContain('salutations distinguées');
    expect(formel.texte).toContain('• Relevés bancaires : septembre 2026');
    expect(formel.texte.endsWith('Julie R\nAFYM')).toBe(true);
    expect(redigerRelance({ ...base, approche: 'PROFESSIONNEL' }).texte).toMatch(/^Bonjour DUBOIS Marie,/);
    expect(redigerRelance({ ...base, approche: 'AMICAL' }).texte).toMatch(/^Bonjour Marie,/);
    const informel = redigerRelance({ ...base, approche: 'INFORMEL' });
    expect(informel.texte).toContain('ta compta');
    expect(informel.texte).not.toContain('votre');
    expect(redigerRelance({ ...base, contactNom: null, approche: 'AMICAL' }).texte).toMatch(/^Bonjour,/);
  });
});
