/**
 * Tableau de Bord BP — Fiche Persona / ICP (profil PASSIDOC automatique, persona du dirigeant, ICP).
 */
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BpPersonaComponent } from './bp-persona.component';
import { LISTES_ICP, LISTES_PERSONA, ProfilAutoBp } from '../../../../../core/models/outils-bp.model';

type Items = { id: string; texte: string; cle?: string }[];

/** Même structure que normaliserContenu('PERSONA', …) côté serveur. */
const contenuPersona = (persona: Record<string, string | Items> = {}, icp: Record<string, string | Items> = {}) => ({
  persona: {
    age: '', poste: '', lieu: '', bio: '',
    ...Object.fromEntries(LISTES_PERSONA.map(k => [k, []])),
    ...persona,
  } as Record<string, any>,
  icp: {
    employes: '', caAnnuel: '', croissance: '',
    ...Object.fromEntries(LISTES_ICP.map(k => [k, []])),
    ...icp,
  } as Record<string, any>,
  ecartees: [] as string[],
});

const PROFIL: ProfilAutoBp = {
  secteur: 'BTP', effectif: 12, capital: 10000, ca: 1250000, croissanceCa: 8, ancienneteRelationAns: 3, nbExercices: 2,
  dateCreationEntreprise: '2015-03-01', maturiteNumerique: 3, disciplinePieces: { enRetard: 2, appreciation: 'Quelques retards' },
  missionsAcceptees: 2, cyclesMissions: ['FIS'],
};

async function creer(contenu: any, opts: { editable?: boolean; profil?: ProfilAutoBp | null } = {}) {
  await TestBed.configureTestingModule({ imports: [BpPersonaComponent] }).compileComponents();
  const fixture = TestBed.createComponent(BpPersonaComponent);
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', opts.editable ?? false);
  if (opts.profil !== undefined) fixture.componentRef.setInput('profil', opts.profil);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

/** Texte normalisé : toLocaleString('fr-FR') sépare les milliers par une espace fine insécable. */
const txt = (n: Element | null | undefined) => (n?.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
const caseProfil = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll('.auto__case')].find(c => txt(c.querySelector('dt')).endsWith(label)) as HTMLElement;
const valeurs = (c: HTMLElement) => [...c.querySelectorAll('dd')].map(txt);

describe('BpPersonaComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('affiche le profil PASSIDOC automatique en lecture seule', async () => {
    const { el } = await creer(contenuPersona(), { profil: PROFIL, editable: true });
    const bande = el.querySelector('.auto') as HTMLElement;
    expect(txt(bande)).toContain('Profil PASSIDOC (automatique)');
    expect(valeurs(caseProfil(el, 'Secteur'))).toEqual(['BTP']);
    expect(valeurs(caseProfil(el, 'Effectif'))).toEqual(['12 salariés']);
    expect(valeurs(caseProfil(el, 'Capital'))).toEqual(['10 000']);
    expect(valeurs(caseProfil(el, "Chiffre d'affaires"))).toEqual(['1 250 000']);
    expect(valeurs(caseProfil(el, 'Croissance du CA'))).toEqual(['+8 %']);
    expect(valeurs(caseProfil(el, 'Ancienneté de la relation'))).toEqual(['3 ans', '2 exercices']);
    expect(valeurs(caseProfil(el, "Création de l'entreprise"))).toEqual(['01/03/2015']);
    expect(valeurs(caseProfil(el, 'Maturité numérique'))).toEqual(['3 / 5']);
    expect(valeurs(caseProfil(el, 'Dépôt des pièces'))).toEqual(['Quelques retards', '2 pièces en retard']);
    expect(valeurs(caseProfil(el, 'Missions acceptées'))).toEqual(['2', 'Fiscal & TVA']);
    expect(bande.querySelectorAll('input, textarea, button').length).toBe(0);
  });

  it('profil : valeurs absentes affichées « — » ; bande masquée quand le profil est null', async () => {
    const { fixture, el } = await creer(contenuPersona(), {
      profil: { ...PROFIL, secteur: null, effectif: null, capital: null, ca: null, croissanceCa: null, ancienneteRelationAns: null,
        dateCreationEntreprise: null, maturiteNumerique: null, missionsAcceptees: 0, cyclesMissions: [],
        disciplinePieces: { enRetard: 0, appreciation: 'Pièces à jour' } },
    });
    for (const l of ['Secteur', 'Effectif', 'Capital', "Chiffre d'affaires", 'Croissance du CA', "Création de l'entreprise", 'Maturité numérique']) {
      expect(valeurs(caseProfil(el, l))).toEqual(['—']);
    }
    expect(valeurs(caseProfil(el, 'Ancienneté de la relation'))).toEqual(['—', '2 exercices']);
    expect(valeurs(caseProfil(el, 'Dépôt des pièces'))).toEqual(['Pièces à jour', 'Aucune pièce en retard']);
    expect(valeurs(caseProfil(el, 'Missions acceptées'))).toEqual(['0']);

    fixture.componentRef.setInput('profil', null);
    fixture.detectChanges();
    expect(el.querySelector('.auto')).toBeNull();
    expect(el.textContent).not.toContain('Profil PASSIDOC');
  });

  it('sans profil : pas de bande ; lecture du persona et de l’ICP (champs, listes, pastilles), sans champ de saisie', async () => {
    const { el } = await creer(contenuPersona(
      { age: '52 ans', poste: 'Gérant fondateur', lieu: 'Saint-Pierre', bio: 'Ancien chef de chantier.',
        objectifs: [{ id: 'o1', texte: 'Transmettre en 2030' }], frustrations: [{ id: 'f1', texte: 'Trésorerie tendue', cle: 'persona.caillou' }] },
      { employes: '10 à 50', secteurs: [{ id: 's1', texte: 'BTP' }, { id: 's2', texte: 'Promotion immobilière' }] },
    ));
    expect(el.querySelector('.auto')).toBeNull();
    const [persona, icp] = [...el.querySelectorAll('.carte')] as HTMLElement[];
    expect(txt(persona.querySelector('.carte__titre'))).toBe('Persona — le dirigeant');
    expect(txt(icp.querySelector('.carte__titre'))).toBe('Profil Client Idéal (ICP)');
    expect([...persona.querySelectorAll('.champ__valeur')].map(txt)).toEqual(['52 ans', 'Gérant fondateur', 'Saint-Pierre', 'Ancien chef de chantier.']);
    expect([...persona.querySelectorAll('.liste__titre')].map(t => txt(t).replace(/^[a-z_]+/, '')))
      .toEqual(['Objectifs', 'Frustrations', 'Motivations', 'Comportements']);
    expect(txt(persona.querySelector('[data-liste="persona.objectifs"]'))).toContain('Transmettre en 2030');
    expect(txt(persona.querySelector('[data-liste="persona.frustrations"]'))).toContain('PASSIDOC');
    expect(txt(persona.querySelector('[data-liste="persona.motivations"]'))).toContain('Non renseigné');
    expect([...icp.querySelectorAll('.champ__valeur')].map(txt)).toEqual(['10 à 50', '—', '—']);
    expect([...icp.querySelectorAll('.liste__titre')].map(t => txt(t).replace(/^[a-z_]+/, '')))
      .toEqual(["Secteur d'activité", 'Technologie utilisée', 'Localisation', 'Problèmes rencontrés', 'Budget disponible', 'Critères de décision']);
    expect([...icp.querySelectorAll('[data-liste="icp.secteurs"] .tag')].map(txt)).toEqual(['BTP', 'Promotion immobilière']);
    expect(txt(icp.querySelector('[data-liste="icp.budget"]'))).toContain('Non renseigné');
    expect(el.querySelectorAll('input, textarea, button').length).toBe(0);
  });

  it('édition : un champ texte modifié met à jour le contenu en place et l’émet', async () => {
    const contenu = contenuPersona({ poste: 'Gérant' });
    const { fixture, comp, el } = await creer(contenu, { editable: true });
    const emis = vi.fn();
    comp.contenuChange.subscribe(emis);
    await fixture.whenStable();   // ngModel écrit la valeur de façon asynchrone
    const poste = el.querySelector('[data-champ="persona.poste"]') as HTMLInputElement;
    expect(poste.value).toBe('Gérant');
    poste.value = 'Gérant majoritaire';
    poste.dispatchEvent(new Event('input'));
    expect(contenu.persona['poste']).toBe('Gérant majoritaire');
    expect(emis).toHaveBeenCalledWith(contenu);

    const ca = el.querySelector('[data-champ="icp.caAnnuel"]') as HTMLInputElement;
    ca.value = '1 à 3 M€';
    ca.dispatchEvent(new Event('input'));
    expect(contenu.icp['caAnnuel']).toBe('1 à 3 M€');
    const bio = el.querySelector('[data-champ="persona.bio"]') as HTMLTextAreaElement;
    bio.value = 'Reprise de l’entreprise familiale';
    bio.dispatchEvent(new Event('input'));
    expect(contenu.persona['bio']).toBe('Reprise de l’entreprise familiale');
    expect(emis).toHaveBeenCalledTimes(3);
  });

  it('édition : un élément ajouté à une liste de l’ICP est poussé dans la bonne liste et émis', async () => {
    const contenu = contenuPersona();
    const { fixture, comp, el } = await creer(contenu, { editable: true });
    const emis = vi.fn();
    comp.contenuChange.subscribe(emis);
    const zone = el.querySelector('[data-liste="icp.criteres"]') as HTMLElement;
    (zone.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const champ = zone.querySelector('textarea') as HTMLTextAreaElement;
    champ.value = 'Réactivité du cabinet';
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(contenu.icp['criteres'].map((i: any) => i.texte)).toEqual(['Réactivité du cabinet']);
    expect(contenu.persona['objectifs']).toEqual([]);
    expect(emis).toHaveBeenCalledWith(contenu);
  });
});
