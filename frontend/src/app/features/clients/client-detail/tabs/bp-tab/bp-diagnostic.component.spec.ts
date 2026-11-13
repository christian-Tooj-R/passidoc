/**
 * Tableau de Bord BP — Diagnostic interne (score global, radar, notation par axe, synthèse).
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { BpDiagnosticComponent } from './bp-diagnostic.component';

const axe = (score = 0, note = '') => ({ score, note });

const contenuTest = () => ({
  axes: {
    strategie: axe(4, 'Vision claire à 3 ans'),
    gouvernance: axe(),
    finance: axe(5),
    rh: axe(2, 'Dépendance au dirigeant'),
    organisation: axe(),
    commercial: axe(),
    digital: axe(),
    reputation: axe(),
  },
  forces: [{ id: 'f1', texte: 'Trésorerie solide' }],
  faiblesses: [] as { id: string; texte: string }[],
  ecartees: [] as string[],
});

async function creer(editable: boolean, contenu: any = contenuTest()) {
  await TestBed.configureTestingModule({ imports: [BpDiagnosticComponent], providers: [provideAnimations()] }).compileComponents();
  const fixture = TestBed.createComponent(BpDiagnosticComponent);
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', editable);
  const emis: any[] = [];
  fixture.componentInstance.contenuChange.subscribe(c => emis.push(c));
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, contenu, emis };
}

const carteAxe = (el: HTMLElement, code: string) => el.querySelector(`.dg__axe[data-axe="${code}"]`) as HTMLElement;
const axesDe = (el: HTMLElement, sel: string) => [...el.querySelectorAll(`${sel} li[data-axe]`)].map(li => li.getAttribute('data-axe'));

describe('BpDiagnosticComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('affiche le score global (moyenne des axes notés) et le radar des 8 axes', async () => {
    const { el } = await creer(false);
    const global = el.querySelector('.dg__global') as HTMLElement;
    // (4 + 5 + 2) / 3 = 3,67 → 3,7
    expect(global.textContent).toContain('3,7');
    expect(global.textContent).toContain('/ 5');
    expect(global.textContent).toContain('3 axes notés sur 8');
    expect(el.querySelectorAll('svg.dg__radar .dg__lib').length).toBe(8);
    expect(el.querySelector('svg.dg__radar')?.textContent).toContain('Finance');
    expect(el.querySelector('.dg__forme')?.getAttribute('points')?.split(' ').length).toBe(8);
    expect(el.querySelectorAll('.dg__pt').length).toBe(3);
  });

  it('« — » et radar vide quand aucun axe n\'est noté', async () => {
    const c = contenuTest();
    Object.values(c.axes).forEach(a => (a.score = 0));
    const { el } = await creer(false, c);
    expect(el.querySelector('.dg__global-val')?.textContent?.trim()).toBe('—');
    expect(el.querySelector('.dg__forme')).toBeNull();
    expect(el.querySelector('.dg__radar-vide')?.textContent).toContain('Aucun axe noté');
  });

  it('calcule les points forts (≥ 4) et les points faibles (≤ 2, non noté exclu)', async () => {
    const { el } = await creer(false);
    expect(axesDe(el, '.dg__pts--forts')).toEqual(['strategie', 'finance']);
    expect(axesDe(el, '.dg__pts--faibles')).toEqual(['rh']);
    expect(el.querySelector('.dg__pts--faibles')?.textContent).toContain('Gestion des ressources humaines');
  });

  it('en lecture seule : échelle et notes affichées, sans bouton ni champ', async () => {
    const { el } = await creer(false);
    const strat = carteAxe(el, 'strategie');
    expect(strat.textContent).toContain('Stratégie & vision');
    expect(strat.textContent).toContain('4 - Bon');
    expect(strat.textContent).toContain('Vision claire à 3 ans');
    expect(strat.textContent).toContain('1 - Très faible');
    expect(strat.querySelector('.dg__n.on')?.textContent?.trim()).toBe('4');
    expect(el.querySelector('.dg__echelle button')).toBeNull();
    expect(el.querySelector('.dg__axes textarea')).toBeNull();
    expect(carteAxe(el, 'gouvernance').textContent).toContain('Non noté');
  });

  it('en édition : noter un axe met à jour le score, la synthèse et émet le contenu', async () => {
    const { fixture, el, contenu, emis } = await creer(true);
    const boutons = () => [...carteAxe(el, 'gouvernance').querySelectorAll('.dg__echelle button')] as HTMLButtonElement[];
    expect(boutons().length).toBe(5);

    boutons()[0].click();
    fixture.detectChanges();
    expect(contenu.axes.gouvernance.score).toBe(1);
    expect(emis.at(-1)).toBe(contenu);
    expect(axesDe(el, '.dg__pts--faibles')).toEqual(['gouvernance', 'rh']);
    // (4 + 1 + 5 + 2) / 4 = 3
    expect(el.querySelector('.dg__global-val')?.textContent).toContain('3,0');

    boutons()[0].click(); // clic sur la note active : l'axe redevient non noté
    fixture.detectChanges();
    expect(contenu.axes.gouvernance.score).toBe(0);
    expect(axesDe(el, '.dg__pts--faibles')).toEqual(['rh']);
    expect(emis.length).toBe(2);
  });

  it('en édition : « Notes / Analyse » se saisit en place', async () => {
    const { fixture, el, contenu, emis } = await creer(true);
    await fixture.whenStable();
    const champ = carteAxe(el, 'digital').querySelector('textarea') as HTMLTextAreaElement;
    champ.value = 'Pas de logiciel de gestion';
    champ.dispatchEvent(new Event('input'));
    expect(contenu.axes.digital.note).toBe('Pas de logiciel de gestion');
    expect(emis.at(-1)).toBe(contenu);
  });
});
