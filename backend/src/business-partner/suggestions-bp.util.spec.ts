import { DonneesBp, construireSuggestions, profilAuto, tiersParMois } from './suggestions-bp.util';

const base = (o: Partial<DonneesBp> = {}): DonneesBp => ({
  annee: 2026, aujourdhui: '2026-11-12',
  client: { secteur: 'Boulangerie', site: 'EST', createdAt: '2022-03-01' },
  fiche: null, adn: null, controle: null, objectifs: null,
  syntheses: [], exercices: [], piecesEnRetard: [], nbFournisseurs: 0,
  tiersParMois: { clients: null, fournisseurs: null }, missions: [],
  ...o,
});

const parCle = (d: DonneesBp) => Object.fromEntries(construireSuggestions(d).map(s => [s.cle, s]));

describe('Tableau de bord BP — suggestions', () => {
  it('dossier sans données : aucune suggestion inventée', () => {
    expect(construireSuggestions(base({ client: { createdAt: '2022-03-01' } }))).toEqual([]);
  });

  it('synthèse de clôture : CA, EBE et résultat classés en forces ou faiblesses', () => {
    const hausse = parCle(base({ syntheses: [{ exercice: 2026, ca: 1100, caPrecedent: 1000, ebe: 110, resultatNet: 50 }] }));
    expect(hausse['swot.ca']).toMatchObject({ zone: 'forces', texte: "Chiffre d'affaires en hausse de 10 % (exercice 2026)", source: 'Synthèse de clôture' });
    expect(hausse['swot.ebe']).toMatchObject({ zone: 'forces', texte: "EBE positif : marge d'EBE de 10 % (exercice 2026)" });
    expect(hausse['diag.finance']).toMatchObject({ zone: 'axe:finance', score: 4 });

    const baisse = parCle(base({ syntheses: [{ exercice: 2026, ca: 800, caPrecedent: 1000, ebe: -10, resultatNet: -30 }] }));
    expect(baisse['swot.ca']).toMatchObject({ zone: 'faiblesses', texte: "Chiffre d'affaires en baisse de 20 % (exercice 2026)" });
    expect(baisse['swot.resultat'].zone).toBe('faiblesses');
    expect(baisse['risque.deficit'].risque).toEqual({ categorie: 'FINANCIER', probabilite: 4, gravite: 4 });
    expect(baisse['diag.finance'].score).toBe(2);
  });

  it('synthèse : celle de l’exercice courant, sinon la plus récente', () => {
    const s = parCle(base({ syntheses: [
      { exercice: 2024, ca: 500, caPrecedent: 1000, ebe: null, resultatNet: null },
      { exercice: 2025, ca: 2000, caPrecedent: 1000, ebe: null, resultatNet: null },
    ] }));
    expect(s['swot.ca'].texte).toContain('hausse de 100 % (exercice 2025)');
  });

  it('ADN et contrôle interne alimentent SWOT, BMC, Persona et la matrice de risques', () => {
    const s = parCle(base({
      adn: {
        valeurCle: 'PROXIMITE', niveauNumerique: 2, ambianceEquipe: 'TENSION', caillouChaussure: 'TRESORERIE',
        visionActivite: 'TRANSMISSION', placeExploitation: 'OPERATIONNELLE', canauxAcquisition: ['DIGITAL'],
        projetsInvestissement: ['MATERIEL', 'AUCUN'], saisonnalite: 'SAISONNIERE',
      },
      controle: {
        processOk: [{ description: 'Caisse rapprochée chaque jour' }],
        processDefaillants: [{ description: 'Pas de contrôle des stocks' }],
        risquesIdentifies: [{ description: 'Dépendance au fournisseur de farine', niveauRisque: 'ELEVE' }],
      },
    }));
    expect(s['swot.valeur']).toMatchObject({ zone: 'forces', texte: 'Valeur clé reconnue : proximité & conseil humain' });
    expect(s['swot.numerique']).toMatchObject({ zone: 'faiblesses', texte: 'Faible maturité numérique (2/5)' });
    expect(s['swot.equipe'].zone).toBe('faiblesses');
    expect(s['swot.processOk.0'].texte).toBe('Processus maîtrisé : Caisse rapprochée chaque jour');
    expect(s['swot.projet.MATERIEL'].zone).toBe('opportunites');
    expect(s['swot.projet.AUCUN']).toBeUndefined();
    expect(s['bmc.canal.DIGITAL']).toMatchObject({ zone: 'canaux', texte: 'Réseaux sociaux & site internet' });
    expect(s['diag.organisation']).toMatchObject({ zone: 'axe:organisation', score: 3 });
    expect(s['risque.processKo.0'].risque!.categorie).toBe('FRAUDE');
    expect(s['risque.ci.0']).toMatchObject({ texte: 'Dépendance au fournisseur de farine', risque: { categorie: 'OPERATIONNEL', probabilite: 4, gravite: 4 } });
    expect(s['risque.transmission']).toBeDefined();
    expect(s['risque.dirigeant']).toBeDefined();
    expect(s['risque.tresorerie'].risque!.categorie).toBe('FINANCIER');
    expect(s['persona.caillou']).toMatchObject({ zone: 'persona.frustrations', texte: 'Gestion de la trésorerie' });
  });

  it('pièces en retard et clôture tardive deviennent des risques cotés', () => {
    const s = parCle(base({
      piecesEnRetard: [{ type: 'TVA_MENSUELLE', mois: 1 }, { type: 'RELEVE_BANCAIRE', mois: 2 }, { type: 'PAIE', mois: 3 }],
      exercices: [{ annee: 2025, dateCloture: '2025-12-31', clotureLeAt: '2026-06-30' }],
    }));
    expect(s['risque.tva']).toMatchObject({ texte: 'Déclarations de TVA en retard (1 en 2026)', risque: { categorie: 'FISCAL', probabilite: 3, gravite: 3 } });
    expect(s['risque.pieces'].risque).toMatchObject({ categorie: 'OPERATIONNEL', probabilite: 2 });
    expect(s['swot.pieces'].zone).toBe('faiblesses');
    expect(s['risque.cloture']).toMatchObject({ texte: 'Retard de clôture des comptes 2025 (181 jours)', risque: { categorie: 'CONFORMITE' } });
  });

  it('import FEC : une clientèle très concentrée est signalée (Porter + risque)', () => {
    const s = parCle(base({ tiersParMois: { clients: 2, fournisseurs: 6.5 }, nbFournisseurs: 4 }));
    expect(s['porter.clients'].texte).toBe('Clientèle concentrée : 2 client(s) distinct(s) facturé(s) par mois en moyenne');
    expect(s['porter.fournisseursFec'].zone).toBe('pouvoirFournisseurs');
    expect(s['risque.concentration']).toBeDefined();
    expect(parCle(base({ tiersParMois: { clients: 25, fournisseurs: null } }))['risque.concentration']).toBeUndefined();
  });

  it('une même donnée saisie deux fois n’est proposée qu’une fois', () => {
    const doublon = { description: 'Risque de trésorerie', niveauRisque: 'ELEVE' };
    const s = construireSuggestions(base({ controle: { risquesIdentifies: [doublon, { ...doublon }] } }));
    expect(s.filter(x => x.outil === 'SWOT').map(x => x.texte)).toEqual(['Risque élevé : Risque de trésorerie']);
    expect(s.filter(x => x.outil === 'RISQUES')).toHaveLength(1);
  });

  it('chaque suggestion a une clé unique', () => {
    const toutes = construireSuggestions(base({
      adn: { valeurCle: 'QUALITE', niveauNumerique: 5, canauxAcquisition: ['BOUCHE_A_OREILLE', 'DIGITAL'] },
      fiche: { reglementations: ['HACCP', 'Licence IV'], nbConcurrentsQuartier: 3, typeClientele: 'Particuliers' },
      syntheses: [{ exercice: 2026, ca: 100, caPrecedent: 90, ebe: 5, resultatNet: 2, zonesRisque: ['Zone A'] }],
    }));
    expect(new Set(toutes.map(s => s.cle)).size).toBe(toutes.length);
  });
});

describe('Tableau de bord BP — profil client auto-généré', () => {
  it('taille, croissance, ancienneté, discipline et missions', () => {
    const p = profilAuto(base({
      fiche: { cycleChargesPaie: { nbSalaries: 8 }, capital: 10000, dateCreation: '2015' },
      adn: { niveauNumerique: 3 },
      syntheses: [{ exercice: 2026, ca: 1200, caPrecedent: 1000, ebe: null, resultatNet: null }],
      exercices: [{ annee: 2025, dateCloture: '2025-12-31', clotureLeAt: null }, { annee: 2026, dateCloture: '2026-12-31', clotureLeAt: null }],
      piecesEnRetard: [{ type: 'PAIE', mois: 1 }],
      missions: [{ statut: 'ACCEPTEE', cycle: 'FIS' }, { statut: 'ACCEPTEE', cycle: 'FIS' }, { statut: 'REFUSEE', cycle: 'SOC' }],
    }));
    expect(p).toEqual({
      secteur: 'Boulangerie', effectif: 8, capital: 10000, ca: 1200, croissanceCa: 20, ancienneteRelationAns: 4,
      nbExercices: 2, dateCreationEntreprise: '2015', maturiteNumerique: 3,
      disciplinePieces: { enRetard: 1, appreciation: 'Quelques retards' }, missionsAcceptees: 2, cyclesMissions: ['FIS'],
    });
  });

  it('moyenne des tiers par mois : mois sans import ignorés', () => {
    expect(tiersParMois([{ nbClientsAttendu: 4, nbFournisseursAttendu: 0 }, { nbClientsAttendu: 6 }, {}]))
      .toEqual({ clients: 5, fournisseurs: null });
  });
});
