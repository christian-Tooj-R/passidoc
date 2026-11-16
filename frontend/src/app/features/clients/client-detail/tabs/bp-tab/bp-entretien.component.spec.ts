/**
 * Questionnaire d'entretien BP (document client, partie 5) : 5 thèmes, réponses et notes, outil alimenté.
 */
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { BpEntretienComponent } from './bp-entretien.component';

const vide = () => ({ date: '', participants: '', reponses: {} as Record<string, string>, notes: { numerique: 0, satisfaction: 0 }, ecartees: [] });

async function afficher(contenu = vide(), editable = true) {
  TestBed.configureTestingModule({ imports: [BpEntretienComponent] });
  const fixture = TestBed.createComponent(BpEntretienComponent);
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', editable);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('BpEntretienComponent — questionnaire d’entretien BP', () => {
  it('5 thèmes du document, 24 questions, chacune avec l’outil qu’elle alimente', async () => {
    const { el } = await afficher();
    expect([...el.querySelectorAll('.en__theme h3')].map(h => h.textContent)).toEqual([
      'Contexte stratégique', 'Environnement externe', 'Organisation interne', 'Ambitions du dirigeant', 'Satisfaction sur les services du cabinet',
    ]);
    expect(el.querySelectorAll('[data-question] textarea')).toHaveLength(24);
    expect(el.querySelector('[data-question="concurrents"] .en__vers')!.textContent).toContain('Porter › Intensité concurrence');
    expect(el.querySelector('[data-question="appreciation"] .en__vers')).toBeNull();
    expect(el.querySelector('.en__avancement-val')!.textContent!.trim()).toBe('0 / 26');
  });

  it('notes de 1 à 5 : un 2e clic retire la note ; avancement mis à jour', async () => {
    const c = vide();
    c.reponses['menaces'] = 'Grande surface';
    const { fixture, comp, el } = await afficher(c);
    const emis: any[] = [];
    comp.contenuChange.subscribe(v => emis.push(v));
    const note = () => el.querySelectorAll<HTMLButtonElement>('[data-note="satisfaction"] button');
    note()[3].click();
    fixture.detectChanges();
    expect(c.notes.satisfaction).toBe(4);
    expect(emis).toHaveLength(1);
    expect(el.querySelector('.en__avancement-val')!.textContent!.trim()).toBe('2 / 26');
    note()[3].click();
    expect(c.notes.satisfaction).toBe(0);
  });

  it('lecture seule : réponses en texte, « Sans réponse » sinon, pas de bouton de note', async () => {
    const c = vide();
    c.reponses['horizon'] = 'Ouvrir un 2e magasin';
    c.date = '2026-11-13';
    const { el } = await afficher(c, false);
    expect(el.querySelector('[data-question="horizon"] .en__reponse')!.textContent).toBe('Ouvrir un 2e magasin');
    expect(el.querySelector('[data-question="freins"] .en__reponse')!.textContent).toBe('Sans réponse');
    expect(el.querySelectorAll('textarea, button')).toHaveLength(0);
    expect(el.textContent).toContain('13/11/2026');
  });
});
