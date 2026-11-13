/**
 * Tableau de Bord BP — Business Model Canvas (9 blocs, questions guides, édition en place).
 */
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BpBmcComponent } from './bp-bmc.component';
import { ZONES_BMC } from '../../../../../core/models/outils-bp.model';

/** Même structure que normaliserContenu('BMC', …) côté serveur. */
const contenuBmc = (o: Record<string, { id: string; texte: string; cle?: string }[]> = {}) => ({
  ...Object.fromEntries(ZONES_BMC.map(z => [z, o[z] ?? []])),
  ecartees: [] as string[],
}) as Record<string, any>;

async function creer(contenu: any, editable = false) {
  await TestBed.configureTestingModule({ imports: [BpBmcComponent] }).compileComponents();
  const fixture = TestBed.createComponent(BpBmcComponent);
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', editable);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

const txt = (n: Element | null | undefined) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
const bloc = (el: HTMLElement, zone: string) => el.querySelector(`[data-zone="${zone}"]`) as HTMLElement;

describe('BpBmcComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lecture : les 9 blocs du canevas avec icône, question guide et éléments, sans champ', async () => {
    const { el } = await creer(contenuBmc({
      partenaires: [{ id: 'p1', texte: 'Banque partenaire' }],
      proposition: [{ id: 'v1', texte: 'Accompagnement clé en main', cle: 'bmc.prop' }],
      revenus: [{ id: 'r1', texte: 'Abonnements mensuels' }],
    }));
    const titres = [...el.querySelectorAll('.bmc__titre')].map(h => txt(h).replace(/^[a-z_0-9]+/, ''));
    expect(titres).toEqual(['Partenaires clés', 'Activités clés', 'Ressources clés', 'Proposition de valeur', 'Relations clients',
      'Canaux', 'Segments clients', 'Structure de coûts', 'Sources de revenus']);
    expect(el.querySelectorAll('.bmc__bloc mat-icon').length).toBe(9);
    expect(txt(bloc(el, 'partenaires'))).toContain('Qui sont nos partenaires et fournisseurs clés ?');
    expect(txt(bloc(el, 'proposition'))).toContain('Quelle valeur apportons-nous au client ?');
    expect(txt(bloc(el, 'segments'))).toContain('Pour qui créons-nous de la valeur ?');
    expect(txt(bloc(el, 'couts'))).toContain('Quels sont les coûts les plus importants ?');
    expect(txt(bloc(el, 'revenus'))).toContain('Pour quelle valeur nos clients sont-ils prêts à payer ?');
    expect(txt(bloc(el, 'partenaires'))).toContain('Banque partenaire');
    expect(txt(bloc(el, 'proposition'))).toContain('Accompagnement clé en main');
    expect(txt(bloc(el, 'proposition'))).toContain('PASSIDOC');
    expect(txt(bloc(el, 'revenus'))).toContain('Abonnements mensuels');
    expect(txt(bloc(el, 'canaux'))).toContain('Rien de noté');
    expect(el.querySelectorAll('button, textarea, input').length).toBe(0);
  });

  it('édition : modifier un élément existant met à jour le contenu en place et l’émet', async () => {
    const contenu = contenuBmc({ activites: [{ id: 'a1', texte: 'Production' }] });
    const { fixture, comp, el } = await creer(contenu, true);
    const emis = vi.fn();
    comp.contenuChange.subscribe(emis);
    await fixture.whenStable();
    const champ = bloc(el, 'activites').querySelector('textarea') as HTMLTextAreaElement;
    expect(champ.value).toBe('Production');
    champ.value = 'Production à la demande';
    champ.dispatchEvent(new Event('input'));
    expect(contenu['activites'][0]).toEqual({ id: 'a1', texte: 'Production à la demande' });
    expect(emis).toHaveBeenCalledWith(contenu);
  });

  it('édition : « + Ajouter » dans un bloc ajoute l’élément à la bonne liste et l’émet', async () => {
    const contenu = contenuBmc();
    const { fixture, comp, el } = await creer(contenu, true);
    const emis = vi.fn();
    comp.contenuChange.subscribe(emis);
    expect(el.querySelectorAll('.bmc__bloc button').length).toBe(9);
    (bloc(el, 'segments').querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const champ = bloc(el, 'segments').querySelector('textarea') as HTMLTextAreaElement;
    champ.value = 'TPE du BTP à La Réunion';
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(contenu['segments'].map((i: any) => i.texte)).toEqual(['TPE du BTP à La Réunion']);
    expect(contenu['proposition']).toEqual([]);
    expect(emis).toHaveBeenCalledWith(contenu);
    expect(txt(bloc(el, 'segments'))).not.toContain('Rien de noté');
  });
});
