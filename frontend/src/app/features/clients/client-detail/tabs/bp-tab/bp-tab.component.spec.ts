/**
 * Tableau de Bord BP — coquille de l'onglet : outil affiché (choisi dans le menu de la fiche), état des
 * 9 outils pour ce menu, suggestions PASSIDOC, enregistrement, validation BP+, lecture seule, comparaison N-1.
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { BpTabComponent } from './bp-tab.component';
import { OutilsBpService } from '../../../../../core/services/outils-bp.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { TenantService } from '../../../../../core/services/tenant.service';
import {
  ACTIVITES_PRIMAIRES, ACTIVITES_SOUTIEN, AXES_DIAGNOSTIC, FORCES_PORTER, LISTES_ICP, LISTES_PERSONA, OutilBpCode, OutilBpVue,
  SuggestionBp, TableauBp, ZONES_BMC, ZONES_PESTEL, ZONES_SWOT,
} from '../../../../../core/models/outils-bp.model';

const listes = (z: readonly string[]) => Object.fromEntries(z.map(k => [k, []]));
const VIDES: Record<OutilBpCode, any> = {
  SWOT: listes(ZONES_SWOT), BMC: listes(ZONES_BMC), PESTEL: listes(ZONES_PESTEL),
  PORTER: { forces: Object.fromEntries(FORCES_PORTER.map(f => [f, { niveau: 0, elements: [] }])) },
  CHAINE_VALEUR: { activites: Object.fromEntries([...ACTIVITES_SOUTIEN, ...ACTIVITES_PRIMAIRES].map(a => [a, { description: '', importance: 0, performance: 0 }])), marge: '', forces: [], faiblesses: [] },
  DIAGNOSTIC: { axes: Object.fromEntries(AXES_DIAGNOSTIC.map(a => [a, { score: 0, note: '' }])), forces: [], faiblesses: [] },
  RISQUES: { risques: [] },
  PERSONA: { persona: { age: '', poste: '', lieu: '', bio: '', ...listes(LISTES_PERSONA) }, icp: { employes: '', caAnnuel: '', croissance: '', ...listes(LISTES_ICP) } },
  BCG: { activites: [] },
};
const vide = (code: OutilBpCode): any => ({ ...JSON.parse(JSON.stringify(VIDES[code])), ecartees: [] });

const CODES: OutilBpCode[] = ['SWOT', 'PORTER', 'BMC', 'PESTEL', 'CHAINE_VALEUR', 'DIAGNOSTIC', 'RISQUES', 'PERSONA', 'BCG'];
const vue = (code: OutilBpCode, o: Partial<OutilBpVue> = {}): OutilBpVue =>
  ({ outil: code, contenu: vide(code), statut: 'BROUILLON', valideLe: null, validePar: null, modifieLe: null, origine: 'VIDE', ...o });

function tableau(o: { droits?: TableauBp['droits']; cloture?: boolean } = {}): TableauBp {
  const swot = vide('SWOT');
  swot.forces = [{ id: 'f1', texte: 'Clientèle fidèle' }];
  const swotN1 = vide('SWOT');
  swotN1.forces = [{ id: 'f0', texte: 'Clientèle fidèle' }, { id: 'f2', texte: 'Bonne marge' }];
  return {
    exercice: { id: 9, annee: 2026, cloture: !!o.cloture },
    precedent: { id: 8, annee: 2025, outils: { SWOT: vue('SWOT', { contenu: swotN1, origine: 'ENREGISTRE', statut: 'VALIDE' }) } },
    outils: CODES.map(c => c === 'SWOT' ? vue('SWOT', { contenu: swot, origine: 'REPRISE_ANCIENNE' })
      : c === 'PESTEL' ? vue('PESTEL', { origine: 'ENREGISTRE', statut: 'VALIDE', validePar: { id: 1, nom: 'Paul Chef' }, valideLe: '2026-11-10T08:00:00Z' })
      : vue(c)),
    droits: o.droits ?? { modifier: true, valider: true },
  };
}

const suggestions: SuggestionBp[] = [
  { cle: 'swot.valeur', outil: 'SWOT', zone: 'forces', texte: 'Valeur clé reconnue : qualité artisanale', source: 'ADN entreprise' },
  { cle: 'swot.concurrence', outil: 'SWOT', zone: 'menaces', texte: 'Concurrence : 3 dans le quartier', source: 'Fiche identité' },
  { cle: 'risque.tva', outil: 'RISQUES', zone: 'risques', texte: 'TVA en retard', source: 'Pilotage', risque: { categorie: 'FISCAL', probabilite: 4, gravite: 3 } },
];

let service: { tableau: any; suggestions: any; enregistrer: any; valider: any };
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

async function afficher(o: { tb?: TableauBp; readonly?: boolean } = {}) {
  service = {
    tableau: vi.fn(() => of(o.tb ?? tableau())),
    suggestions: vi.fn(() => of({ suggestions, profil: null })),
    enregistrer: vi.fn((_c: number, _e: number, outil: OutilBpCode, contenu: any) =>
      of(vue(outil, { contenu, origine: 'ENREGISTRE' }))),
    valider: vi.fn((_c: number, _e: number, outil: OutilBpCode) =>
      of(vue(outil, { origine: 'ENREGISTRE', statut: 'VALIDE', validePar: { id: 2, nom: 'Marie Dubois' }, valideLe: '2026-11-12T08:00:00Z' }))),
  };
  TestBed.configureTestingModule({
    imports: [BpTabComponent],
    providers: [
      provideAnimations(),
      { provide: OutilsBpService, useValue: service },
      { provide: ToastService, useValue: toast },
      { provide: TenantService, useValue: { nomSociete: () => 'AFYM' } },
    ],
  });
  const fixture = TestBed.createComponent(BpTabComponent);
  fixture.componentRef.setInput('clientId', 4);
  fixture.componentRef.setInput('exerciceId', 9);
  fixture.componentRef.setInput('clientNom', 'Boulangerie Hoarau');
  fixture.componentRef.setInput('readonly', !!o.readonly);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, comp: fixture.componentInstance, el };
}

/** Éléments affichés par les listes des outils : champs en édition, texte en lecture. */
const elements = (el: HTMLElement) => [...el.querySelectorAll('.bl__item')]
  .map(li => (li.querySelector('textarea') as HTMLTextAreaElement | null)?.value ?? li.querySelector('.bl__texte')?.textContent?.trim());
const boutons = (el: HTMLElement, texte: string) => [...el.querySelectorAll('button')].filter(b => b.textContent?.includes(texte));

describe('BpTabComponent — Tableau de bord BP', () => {
  beforeEach(() => vi.clearAllMocks());

  it('SWOT par défaut avec la reprise des anciens onglets ; état des outils pour le menu de la fiche', async () => {
    const { el, comp } = await afficher();
    expect(service.tableau).toHaveBeenCalledWith(4, 9);
    expect(el.querySelector('.bp__titre h2')!.textContent).toBe('SWOT');
    expect(el.querySelector('.bp__info')!.textContent).toContain('Repris des anciens onglets');
    expect(elements(el)).toEqual(['Clientèle fidèle']);
    expect(comp.nbValides()).toBe(1);
    expect([comp.etat('PESTEL'), comp.etat('SWOT'), comp.etat('BCG')]).toEqual(['valide', 'vide', 'vide']);
    expect(comp.libelleEtat('PESTEL')).toBe('Validé');
  });

  it('suggestions : ajout dans le quadrant, outil marqué modifié, enregistré par « Enregistrer »', async () => {
    const { fixture, el, comp } = await afficher();
    const items = () => [...el.querySelectorAll('.bp__sugg-item')];
    expect(items().map(i => i.querySelector('p')!.textContent)).toEqual(['Valeur clé reconnue : qualité artisanale', 'Concurrence : 3 dans le quartier']);

    (items()[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();   // ngModel écrit la valeur des champs de façon asynchrone
    expect(items()).toHaveLength(1);
    expect(el.querySelector('.bp__statut--modifie')).not.toBeNull();
    expect(elements(el)).toContain('Valeur clé reconnue : qualité artisanale');
    expect(comp.etat('SWOT')).toBe('modifie');

    (el.querySelector('.bp__enregistrer') as HTMLButtonElement).click();
    fixture.detectChanges();
    const [clientId, exerciceId, outil, contenu] = service.enregistrer.mock.calls[0];
    expect([clientId, exerciceId, outil]).toEqual([4, 9, 'SWOT']);
    expect(contenu.forces.map((i: any) => i.texte)).toEqual(['Clientèle fidèle', 'Valeur clé reconnue : qualité artisanale']);
    expect(toast.success).toHaveBeenCalledWith('SWOT enregistré');
    expect(el.querySelector('.bp__statut--modifie')).toBeNull();
    expect(comp.etat('SWOT')).toBe('brouillon');
  });

  it('« Enregistrer » sans modification : l’outil repris affiché est enregistré tel quel, sinon rien à faire', async () => {
    const { fixture, el, comp } = await afficher();
    (el.querySelector('.bp__enregistrer') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.enregistrer).toHaveBeenCalledTimes(1);
    expect(service.enregistrer.mock.calls[0][2]).toBe('SWOT');
    expect(service.enregistrer.mock.calls[0][3].forces.map((i: any) => i.texte)).toEqual(['Clientèle fidèle']);

    comp.actif.set('PESTEL');
    fixture.detectChanges();
    (el.querySelector('.bp__enregistrer') as HTMLButtonElement).click();
    expect(service.enregistrer).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith('Aucune modification à enregistrer');
  });

  it('écarter une suggestion la retire sans l’ajouter', async () => {
    const { fixture, el, comp } = await afficher();
    boutons(el, 'Écarter')[1].click();
    fixture.detectChanges();
    expect([...el.querySelectorAll('.bp__sugg-item p')].map(p => p.textContent)).toEqual(['Valeur clé reconnue : qualité artisanale']);
    expect(comp.contenuActif().menaces).toEqual([]);
    expect(comp.contenuActif().ecartees).toEqual(['swot.concurrence']);
  });

  it('valider : un outil repris est d’abord enregistré, puis validé', async () => {
    const { fixture, el } = await afficher();
    boutons(el, 'Valider')[0].click();
    fixture.detectChanges();
    expect(service.enregistrer).toHaveBeenCalledTimes(1);
    expect(service.valider).toHaveBeenCalledWith(4, 9, 'SWOT');
    expect(el.querySelector('.bp__statut--valide')!.textContent).toContain('Validé par Marie Dubois le 12/11/2026');
    expect(toast.success).toHaveBeenCalledWith('SWOT validé');
  });

  it('outil déjà validé et non modifié : bouton Valider désactivé, statut affiché', async () => {
    const { fixture, el, comp } = await afficher();
    comp.actif.set('PESTEL');
    fixture.detectChanges();
    expect(el.querySelector('.bp__titre h2')!.textContent).toBe('PESTEL');
    expect(el.querySelector('.bp__statut--valide')!.textContent).toContain('Validé par Paul Chef le 10/11/2026');
    expect(boutons(el, 'Valider')[0].disabled).toBe(true);
  });

  it('profil sans droit de validation : pas de bouton Valider', async () => {
    const { el } = await afficher({ tb: tableau({ droits: { modifier: true, valider: false } }) });
    expect(boutons(el, 'Valider')).toHaveLength(0);
    expect(el.querySelector('.bp__sugg')).not.toBeNull();
  });

  it('lecture seule (non assigné ou exercice clôturé) : ni suggestions, ni validation, ni enregistrement', async () => {
    for (const cas of [{ readonly: true }, { tb: tableau({ cloture: true }) }, { tb: tableau({ droits: { modifier: false, valider: false } }) }]) {
      TestBed.resetTestingModule();
      const { el } = await afficher(cas);
      expect(el.querySelector('.bp__sugg')).toBeNull();
      expect(boutons(el, 'Valider')).toHaveLength(0);
      expect(el.querySelector('.bp__enregistrer')).toBeNull();
    }
  });

  it('exercice clôturé : l’export PDF reste disponible', async () => {
    const { el } = await afficher({ tb: tableau({ cloture: true }) });
    expect(el.textContent).toContain('Exercice clôturé : consultation seule.');
    expect(boutons(el, 'Exporter')).toHaveLength(1);
  });

  it('comparer à N-1 : ce qui a été retiré depuis l’exercice précédent', async () => {
    const { fixture, el } = await afficher();
    boutons(el, 'Comparer à 2025')[0].click();
    fixture.detectChanges();
    const ev = el.querySelector('.bp__evolution')!;
    expect(ev.textContent).toContain('Évolution 2025 → 2026');
    expect(ev.textContent).toContain('− Forces : Bonne marge');
  });

  it('pas d’exercice : message au lieu du tableau', async () => {
    TestBed.configureTestingModule({
      imports: [BpTabComponent],
      providers: [provideAnimations(), { provide: OutilsBpService, useValue: { tableau: vi.fn(), suggestions: vi.fn() } },
        { provide: ToastService, useValue: toast }, { provide: TenantService, useValue: { nomSociete: () => 'AFYM' } }],
    });
    const fixture = TestBed.createComponent(BpTabComponent);
    fixture.componentRef.setInput('clientId', 4);
    fixture.componentRef.setInput('exerciceId', null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Créez un exercice');
  });
});
