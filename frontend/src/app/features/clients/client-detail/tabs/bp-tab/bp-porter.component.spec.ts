/**
 * Tableau de Bord BP — 5 Forces de Porter (schéma radial, niveaux, synthèse sur 15).
 */
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BpPorterComponent } from './bp-porter.component';
import { FORCES_PORTER } from '../../../../../core/models/outils-bp.model';

/** Même structure que normaliserContenu('PORTER', …) côté serveur. */
const contenuPorter = (o: Record<string, { niveau?: number; elements?: { id: string; texte: string; cle?: string }[] }> = {}) => ({
  forces: Object.fromEntries(FORCES_PORTER.map(f => [f, { niveau: o[f]?.niveau ?? 0, elements: o[f]?.elements ?? [] }])),
  ecartees: [] as string[],
});

async function creer(contenu: any, editable = false) {
  await TestBed.configureTestingModule({ imports: [BpPorterComponent] }).compileComponents();
  const fixture = TestBed.createComponent(BpPorterComponent);
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', editable);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

const txt = (n: Element | null | undefined) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
const carte = (el: HTMLElement, force: string) => el.querySelector(`[data-force="${force}"]`) as HTMLElement;
const bouton = (racine: HTMLElement, libelle: string) =>
  ([...racine.querySelectorAll('button')] as HTMLButtonElement[]).find(b => txt(b) === libelle)!;

describe('BpPorterComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lecture : entreprise au centre, 5 forces, aucune évaluation sur 15 et aucun champ', async () => {
    const { el } = await creer(contenuPorter());
    expect(txt(el.querySelector('.porter__centre'))).toContain("L'ENTREPRISE");
    expect(txt(el.querySelector('.porter__centre'))).toContain('Menace globale');
    expect(txt(el.querySelector('.porter__score'))).toBe('0 / 15');
    expect(txt(el.querySelector('.porter__menace-label'))).toBe('Aucune évaluation');
    const titres = [...el.querySelectorAll('.porter__titre')].map(txt);
    expect(titres).toEqual(['Nouveaux entrants', 'Pouvoir clients', 'Produits substituts', 'Pouvoir fournisseurs', 'Intensité concurrence']);
    expect([...el.querySelectorAll('.porter__statut')].map(txt).every(s => s === 'Non évalué')).toBe(true);
    expect(txt(carte(el, 'nouveauxEntrants'))).toContain("Barrières à l'entrée, investissements nécessaires, réglementation");
    expect(el.querySelectorAll('button, textarea, input').length).toBe(0);
  });

  it('lecture : niveaux, éléments identifiés et synthèse de l’analyse avec total', async () => {
    const { el } = await creer(contenuPorter({
      nouveauxEntrants: { niveau: 3, elements: [{ id: 'a', texte: 'Peu de barrières réglementaires' }] },
      pouvoirClients: { niveau: 2, elements: [{ id: 'b', texte: 'Deux clients = 60 % du CA', cle: 'porter.clients' }, { id: 'c', texte: 'Prix tirés' }] },
      substituts: { niveau: 2 },
    }));
    expect(txt(el.querySelector('.porter__score'))).toBe('7 / 15');
    expect(txt(el.querySelector('.porter__menace-label'))).toBe('Menace modérée');
    const ne = carte(el, 'nouveauxEntrants');
    expect(txt(ne.querySelector('.porter__note'))).toBe('3');
    expect(txt(ne.querySelector('.porter__statut'))).toBe('Élevé');
    expect(txt(ne)).toContain('Peu de barrières réglementaires');
    expect(txt(carte(el, 'pouvoirClients').querySelector('.porter__statut'))).toBe('Moyen');
    expect(txt(carte(el, 'pouvoirClients'))).toContain('PASSIDOC');
    expect(txt(carte(el, 'concurrence'))).toContain('Aucun élément identifié');

    const lignes = [...el.querySelectorAll('.synthese__table tbody tr')].map(r => [...r.querySelectorAll('td')].map(txt));
    expect(lignes[0]).toEqual(['person_addNouveaux entrants', 'Élevé', '1', '3']);
    expect(lignes[1].slice(1)).toEqual(['Moyen', '2', '2']);
    expect(lignes[4].slice(1)).toEqual(['Non évalué', '0', '0']);
    const total = [...el.querySelectorAll('.synthese__table tfoot td')].map(txt);
    expect(total).toEqual(['Menace globale', 'Menace modérée', '3', '7 / 15']);
  });

  it('édition : le niveau choisi met à jour le score global et émet le contenu ; recliquer le remet à 0', async () => {
    const contenu = contenuPorter({ nouveauxEntrants: { niveau: 3 }, pouvoirClients: { niveau: 3 }, substituts: { niveau: 2 } });
    const { fixture, comp, el } = await creer(contenu, true);
    const emis = vi.fn();
    comp.contenuChange.subscribe(emis);
    expect(txt(el.querySelector('.porter__score'))).toBe('8 / 15');

    bouton(carte(el, 'concurrence'), 'Élevé').click();
    fixture.detectChanges();
    expect(contenu.forces['concurrence'].niveau).toBe(3);
    expect(emis).toHaveBeenCalledWith(contenu);
    expect(txt(el.querySelector('.porter__score'))).toBe('11 / 15');
    expect(txt(el.querySelector('.porter__menace-label'))).toBe('Menace forte');
    expect(bouton(carte(el, 'concurrence'), 'Élevé').getAttribute('aria-pressed')).toBe('true');
    expect(txt(carte(el, 'concurrence').querySelector('.porter__statut'))).toBe('Élevé');
    expect(txt(el.querySelector('.synthese__table tfoot'))).toContain('11 / 15');

    bouton(carte(el, 'concurrence'), 'Élevé').click();
    fixture.detectChanges();
    expect(contenu.forces['concurrence'].niveau).toBe(0);
    expect(emis).toHaveBeenCalledTimes(2);
    expect(txt(el.querySelector('.porter__score'))).toBe('8 / 15');
    expect(txt(carte(el, 'concurrence').querySelector('.porter__statut'))).toBe('Non évalué');
  });

  it('édition : un élément ajouté à une force est poussé dans ses éléments et émis', async () => {
    const contenu = contenuPorter();
    const { fixture, comp, el } = await creer(contenu, true);
    const emis = vi.fn();
    comp.contenuChange.subscribe(emis);
    const sub = carte(el, 'substituts');
    bouton(sub, '+ Ajouter').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const champ = sub.querySelector('textarea') as HTMLTextAreaElement;
    champ.value = 'Offres en ligne low-cost';
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(contenu.forces['substituts'].elements.map(i => i.texte)).toEqual(['Offres en ligne low-cost']);
    expect(emis).toHaveBeenCalledWith(contenu);
    expect(txt(el.querySelector('.synthese__table tfoot'))).toContain('1');
  });
});
