import {
  OUTILS_BP, contenuVide, criticite, estVide, menaceGlobalePorter, normaliserContenu, repriseAncienne, scoreDiagnostic, texteOutilsBp,
} from './outils-bp.util';

describe('Tableau de bord BP — contenu des outils', () => {
  it.each(OUTILS_BP)('%s : un contenu vide est stable et reconnu comme vide', (outil) => {
    const vide = contenuVide(outil);
    expect(normaliserContenu(outil, vide)).toEqual(vide);
    expect(estVide(outil, vide)).toBe(true);
  });

  it('SWOT : ne garde que les quadrants connus, élimine les éléments vides, conserve id et clé de suggestion', () => {
    const c = normaliserContenu('SWOT', {
      forces: [{ id: 'a1', texte: '  Équipe soudée ' }, { texte: '' }, 'Bonne marge'],
      menaces: [{ id: 'x', texte: 'Concurrence', cle: 'swot.concurrence' }],
      inconnu: [{ texte: 'ignoré' }],
      ecartees: ['swot.ca', 'swot.ca', 'pas une clé !'],
    });
    expect(c.forces).toEqual([{ id: 'a1', texte: 'Équipe soudée' }, { id: expect.any(String), texte: 'Bonne marge' }]);
    expect(c.menaces).toEqual([{ id: 'x', texte: 'Concurrence', cle: 'swot.concurrence' }]);
    expect(c).not.toHaveProperty('inconnu');
    expect(c.ecartees).toEqual(['swot.ca']);
  });

  it('Porter : niveau borné de 0 à 3, forces manquantes créées', () => {
    const c = normaliserContenu('PORTER', { forces: { concurrence: { niveau: 9, elements: ['Forte'] }, substituts: { niveau: -2 } } });
    expect(c.forces.concurrence.niveau).toBe(3);
    expect(c.forces.substituts.niveau).toBe(0);
    expect(c.forces.nouveauxEntrants).toEqual({ niveau: 0, elements: [] });
    expect(menaceGlobalePorter(c)).toEqual({ score: 3, max: 15, evaluees: 1 });
  });

  it('Matrice de risques : cotation bornée de 1 à 5, catégorie inconnue → AUTRE, risque sans nom ignoré', () => {
    const c = normaliserContenu('RISQUES', { risques: [
      { nom: 'Retard TVA', categorie: 'FISCAL', probabilite: 7, gravite: 0, dateCible: '2026-12-31', planAction: 'Relancer' },
      { nom: 'Fraude caisse', categorie: 'PIRATE', probabilite: 3, gravite: 4, dateCible: '31/12/2026' },
      { nom: '  ' },
    ] });
    expect(c.risques).toHaveLength(2);
    expect(c.risques[0]).toMatchObject({ categorie: 'FISCAL', probabilite: 5, gravite: 1, dateCible: '2026-12-31', planAction: 'Relancer' });
    expect(c.risques[1]).toMatchObject({ categorie: 'AUTRE', dateCible: '' });
  });

  it('BCG : quadrant et couleur contrôlés, CA vide = null', () => {
    const c = normaliserContenu('BCG', { activites: [
      { nom: 'Boulangerie', ca: '120000', quadrant: 'VACHE', couleur: '#10b981' },
      { nom: 'Traiteur', ca: '', quadrant: 'LICORNE', couleur: 'red' },
    ] });
    expect(c.activites[0]).toMatchObject({ ca: 120000, quadrant: 'VACHE', couleur: '#10b981' });
    expect(c.activites[1]).toMatchObject({ ca: null, quadrant: 'DILEMME', couleur: '#3b82f6' });
  });

  it('Persona / ICP : champs texte et listes reconstruits', () => {
    const c = normaliserContenu('PERSONA', { persona: { age: 52, poste: 'Gérant', objectifs: ['Transmettre'] }, icp: { secteurs: ['BTP'], pirate: 1 } });
    expect(c.persona).toMatchObject({ age: '52', poste: 'Gérant', lieu: '', objectifs: [{ id: expect.any(String), texte: 'Transmettre' }] });
    expect(c.icp.secteurs[0].texte).toBe('BTP');
    expect(c.icp).not.toHaveProperty('pirate');
  });

  it('textes tronqués et nombre d’éléments limité', () => {
    const c = normaliserContenu('PESTEL', { legal: Array.from({ length: 80 }, () => 'x'.repeat(900)) });
    expect(c.legal).toHaveLength(50);
    expect(c.legal[0].texte).toHaveLength(500);
  });
});

describe('Tableau de bord BP — reprise des anciens onglets', () => {
  const analyse = {
    forces: ['Clientèle fidèle', 'Bonne marge\nÉquipe stable'], faiblesses: [], opportunites: null, menaces: ['Concurrence'],
    porterConcurrence: '- Trois boulangeries\n- Une grande surface', porterClients: '', businessModelCanvas: 'Pain artisanal',
  };

  it('SWOT et Porter : une ligne de texte = un élément', () => {
    const swot = repriseAncienne('SWOT', analyse, null)!;
    expect(swot.forces.map((i: any) => i.texte)).toEqual(['Clientèle fidèle', 'Bonne marge', 'Équipe stable']);
    expect(swot.menaces.map((i: any) => i.texte)).toEqual(['Concurrence']);
    const porter = repriseAncienne('PORTER', analyse, null)!;
    expect(porter.forces.concurrence.elements.map((i: any) => i.texte)).toEqual(['Trois boulangeries', 'Une grande surface']);
  });

  it('BMC : le « Modèle Canvas » prime ; sinon le texte libre va dans « Proposition de valeur »', () => {
    const depuisCanvas = repriseAncienne('BMC', analyse, { 'partenairesClés': 'Meunier', sourcesRevenus: 'Ventes comptoir' })!;
    expect(depuisCanvas.partenaires[0].texte).toBe('Meunier');
    expect(depuisCanvas.revenus[0].texte).toBe('Ventes comptoir');
    expect(depuisCanvas.proposition).toEqual([]);
    expect(repriseAncienne('BMC', analyse, { 'partenairesClés': '' })!.proposition[0].texte).toBe('Pain artisanal');
  });

  it('rien à reprendre → null (y compris pour les nouveaux outils)', () => {
    expect(repriseAncienne('SWOT', { forces: [], faiblesses: [] }, null)).toBeNull();
    expect(repriseAncienne('PESTEL', analyse, null)).toBeNull();
    expect(repriseAncienne('BMC', null, null)).toBeNull();
  });
});

describe('Tableau de bord BP — indicateurs', () => {
  it.each([
    [1, 4, 4, 'ACCEPTABLE'], [1, 5, 5, 'TOLERABLE'], [3, 3, 9, 'TOLERABLE'],
    [2, 5, 10, 'A_TRAITER'], [3, 5, 15, 'INACCEPTABLE'], [5, 5, 25, 'INACCEPTABLE'],
  ])('criticité %i × %i = %i → %s', (p, g, valeur, zone) => {
    expect(criticite(p, g)).toEqual({ valeur, zone });
  });

  it('score du diagnostic : moyenne des seuls axes notés', () => {
    expect(scoreDiagnostic(contenuVide('DIAGNOSTIC'))).toBeNull();
    expect(scoreDiagnostic({ axes: { finance: { score: 4 }, rh: { score: 3 }, digital: { score: 0 } } })).toBe(3.5);
  });
});

describe('Tableau de bord BP — résumé pour l’assistant IA', () => {
  it('résume les outils enregistrés (statut, niveaux, cotations), ignore les outils vides', () => {
    const lignes = texteOutilsBp(2026, [
      { outil: 'SWOT', statut: 'VALIDE', contenu: { forces: ['Clientèle fidèle', 'Pain au levain'], menaces: ['Grande surface'] } },
      { outil: 'PORTER', statut: 'BROUILLON', contenu: { forces: { concurrence: { niveau: 3, elements: ['Trois boulangeries'] } } } },
      { outil: 'RISQUES', statut: 'BROUILLON', contenu: { risques: [{ nom: 'Retard TVA', categorie: 'FISCAL', probabilite: 4, gravite: 3, planAction: 'Relancer' }] } },
      { outil: 'PESTEL', statut: 'BROUILLON', contenu: {} },
    ]);
    expect(lignes).toEqual([
      '\n=== TABLEAU DE BORD BP (exercice 2026) ===',
      'SWOT [validé] :',
      '  Forces : Clientèle fidèle | Pain au levain',
      '  Menaces : Grande surface',
      '5 Forces de Porter [brouillon] :',
      '  Intensité concurrentielle (élevé) : Trois boulangeries',
      '  Menace globale : 3/15',
      'Matrice de risques [brouillon] :',
      "  Retard TVA (FISCAL, probabilité 4 × gravité 3 = 12) — plan d'action : Relancer",
    ]);
    expect(texteOutilsBp(2026, [])).toEqual([]);
  });
});
