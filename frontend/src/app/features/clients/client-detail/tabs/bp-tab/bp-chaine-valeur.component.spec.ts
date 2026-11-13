/**
 * Tableau de Bord BP — Chaîne de valeur de Porter (schéma StratPilote, panneau d'édition, goulots).
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { BpChaineValeurComponent } from './bp-chaine-valeur.component';

const act = (o: Partial<{ description: string; importance: number; performance: number }> = {}) =>
  ({ description: '', importance: 0, performance: 0, ...o });

const contenuTest = () => ({
  activites: {
    infrastructure: act({ description: 'Locaux vétustes', importance: 4, performance: 2 }),
    rh: act(),
    technologie: act({ importance: 2, performance: 5 }),
    approvisionnements: act({ importance: 3, performance: 4 }),
    logistiqueInterne: act(),
    production: act({ description: 'Machines anciennes', importance: 5, performance: 1 }),
    logistiqueExterne: act({ importance: 2, performance: 1 }),
    marketingVente: act({ importance: 4, performance: 3 }),
    services: act({ importance: 5, performance: 0 }),
  },
  marge: 'Marge brute 32 %',
  forces: [{ id: 'f1', texte: 'Équipe stable' }],
  faiblesses: [] as { id: string; texte: string }[],
  ecartees: [] as string[],
});

async function creer(editable: boolean) {
  await TestBed.configureTestingModule({ imports: [BpChaineValeurComponent], providers: [provideAnimations()] }).compileComponents();
  const fixture = TestBed.createComponent(BpChaineValeurComponent);
  const contenu = contenuTest();
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', editable);
  const emis: any[] = [];
  fixture.componentInstance.contenuChange.subscribe(c => emis.push(c));
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, contenu, emis };
}

const carte = (el: HTMLElement, code: string) => el.querySelector(`.cv__act[data-code="${code}"]`) as HTMLElement;
const lignesGoulots = (el: HTMLElement) => [...el.querySelectorAll('.cv__goulots tbody tr')].map(tr => tr.getAttribute('data-code'));

describe('BpChaineValeurComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('affiche les 4 activités de soutien en bandes, les 5 principales et la marge', async () => {
    const { el } = await creer(false);
    expect(el.querySelectorAll('.cv__soutien .cv__act--bande').length).toBe(4);
    expect(el.querySelectorAll('.cv__primaires .cv__act').length).toBe(5);
    expect(carte(el, 'infrastructure').textContent).toContain("Infrastructure de l'entreprise");
    expect(carte(el, 'marketingVente').textContent).toContain('Marketing & ventes');
    expect(carte(el, 'production').textContent).toContain('Machines anciennes');
    expect(el.querySelector('.cv__marge-titre')?.textContent).toContain('Marge');
    expect(el.querySelector('.cv__marge-texte')?.textContent).toContain('Marge brute 32 %');
  });

  it('colore chaque carte selon la performance (rouge ≤ 2, orange 3, vert ≥ 4, gris non évaluée)', async () => {
    const { el } = await creer(false);
    expect(carte(el, 'infrastructure').classList).toContain('cv__act--rouge');
    expect(carte(el, 'marketingVente').classList).toContain('cv__act--orange');
    expect(carte(el, 'approvisionnements').classList).toContain('cv__act--vert');
    expect(carte(el, 'rh').classList).toContain('cv__act--gris');
    expect(carte(el, 'services').classList).toContain('cv__act--gris');
  });

  it('en lecture seule : pas de champ ni de panneau, même au clic', async () => {
    const { fixture, el } = await creer(false);
    carte(el, 'production').click();
    fixture.detectChanges();
    expect(el.querySelector('.cv__panneau')).toBeNull();
    expect(el.querySelector('textarea')).toBeNull();
    expect(carte(el, 'production').getAttribute('role')).toBeNull();
  });

  it('liste les goulots d\'étranglement : importance ≥ 4 et performance ≤ 2, non évaluée exclue', async () => {
    const { el } = await creer(false);
    expect(lignesGoulots(el)).toEqual(['production', 'infrastructure']);
    expect(el.querySelector('.cv__goulots')?.textContent).toContain('Locaux vétustes');
  });

  it('en édition : le panneau « Éditer activité » modifie les scores et émet le contenu', async () => {
    const { fixture, el, contenu, emis } = await creer(true);
    carte(el, 'production').click();
    fixture.detectChanges();
    const panneau = el.querySelector('.cv__panneau') as HTMLElement;
    expect(panneau.textContent).toContain('Éditer activité');
    expect(panneau.textContent).toContain('Production');
    expect(panneau.textContent).toContain("Score d'Importance (1-5)");
    expect(panneau.textContent).toContain('1 = Performance faible, 5 = Excellence');

    const perf = [...panneau.querySelectorAll('[data-score="performance"] button')] as HTMLButtonElement[];
    perf[3].click();
    fixture.detectChanges();
    expect(contenu.activites.production.performance).toBe(4);
    expect(emis.at(-1)).toBe(contenu);
    expect(carte(el, 'production').classList).toContain('cv__act--vert');
    expect(lignesGoulots(el)).toEqual(['infrastructure']);

    perf[3].click();
    fixture.detectChanges();
    expect(contenu.activites.production.performance).toBe(0);
    expect(carte(el, 'production').classList).toContain('cv__act--gris');
  });

  it('en édition : description et marge se saisissent en place', async () => {
    const { fixture, el, contenu, emis } = await creer(true);
    carte(el, 'rh').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const desc = el.querySelector('.cv__panneau textarea') as HTMLTextAreaElement;
    desc.value = 'Turnover élevé';
    desc.dispatchEvent(new Event('input'));
    expect(contenu.activites.rh.description).toBe('Turnover élevé');

    const marge = el.querySelector('.cv__marge-champ') as HTMLTextAreaElement;
    marge.value = 'Marge nette 8 %';
    marge.dispatchEvent(new Event('input'));
    expect(contenu.marge).toBe('Marge nette 8 %');
    expect(emis.length).toBe(2);

    (el.querySelector('.cv__fermer') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.cv__panneau')).toBeNull();
  });
});
