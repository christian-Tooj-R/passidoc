/**
 * Tableau de Bord BP — Matrice BCG (quadrants, bulles proportionnelles au CA, formulaire intégré).
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BpBcgComponent } from './bp-bcg.component';
import { of } from 'rxjs';
import { ConfirmService } from '../../../../../core/services/confirm.service';

/** Fenêtre de confirmation : réponse choisie par le test. */
const confirmation = { reponse: true, confirm: vi.fn(() => of(confirmation.reponse)) };

const contenuTest = () => ({
  activites: [
    { id: 'a1', nom: 'Négoce', ca: 1000000, quadrant: 'VACHE', couleur: '#10b981' },
    { id: 'a2', nom: 'Services', ca: 250000, quadrant: 'DILEMME', couleur: '#8b5cf6' },
    { id: 'a3', nom: 'Formation', ca: null, quadrant: 'POIDS_MORT', couleur: '#64748b' },
  ] as any[],
  ecartees: [] as string[],
});

async function creer(editable: boolean, contenu: any = contenuTest()) {
  await TestBed.configureTestingModule({ imports: [BpBcgComponent], providers: [provideAnimations(), { provide: ConfirmService, useValue: confirmation }] }).compileComponents();
  const fixture = TestBed.createComponent(BpBcgComponent);
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', editable);
  const emis: any[] = [];
  fixture.componentInstance.contenuChange.subscribe(c => emis.push(c));
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, contenu, emis };
}

/** toLocaleString('fr-FR') sépare les milliers par une espace fine insécable. */
const txt = (n: Element | null | undefined) => (n?.textContent ?? '').replace(/[  ]/g, ' ');
const quadrant = (el: HTMLElement, code: string) => el.querySelector(`.bcg__q[data-quadrant="${code}"]`) as HTMLElement;
const bulle = (el: HTMLElement, id: string) => el.querySelector(`.bcg__act[data-id="${id}"] .bcg__bulle`) as HTMLElement;
const bouton = (el: HTMLElement, texte: string) =>
  ([...el.querySelectorAll('button')] as HTMLButtonElement[]).find(b => b.textContent?.includes(texte))!;

describe('BpBcgComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('affiche les 4 quadrants, les axes et l\'état vide', async () => {
    const { el } = await creer(false, { activites: [], ecartees: [] });
    expect(el.textContent).toContain('Aucune activité pour le moment');
    const qs = [...el.querySelectorAll('.bcg__q')].map(q => q.getAttribute('data-quadrant'));
    expect(qs).toEqual(['VEDETTE', 'DILEMME', 'VACHE', 'POIDS_MORT']);
    expect(quadrant(el, 'VACHE').textContent).toContain('Vaches à lait');
    expect(quadrant(el, 'POIDS_MORT').textContent).toContain('à envisager de désinvestir');
    expect(el.textContent).toContain('Taux de croissance du marché');
    expect(el.textContent).toContain('Part de marché relative');
    expect(el.querySelector('.bcg__act')).toBeNull();
  });

  it('place chaque activité en bulle dans son quadrant, taille selon le CA', async () => {
    const { el } = await creer(false);
    expect(el.textContent).not.toContain('Aucune activité pour le moment');
    expect(quadrant(el, 'VACHE').querySelector('.bcg__act[data-id="a1"]')).toBeTruthy();
    expect(quadrant(el, 'DILEMME').querySelector('.bcg__act[data-id="a2"]')).toBeTruthy();
    expect(quadrant(el, 'POIDS_MORT').querySelector('.bcg__act[data-id="a3"]')).toBeTruthy();
    expect(quadrant(el, 'VEDETTE').querySelector('.bcg__act')).toBeNull();

    expect(txt(quadrant(el, 'VACHE'))).toContain('Négoce');
    expect(txt(quadrant(el, 'VACHE'))).toContain('1 000 000');
    expect(bulle(el, 'a1').style.getPropertyValue('--d')).toBe('96px'); // plus gros CA
    expect(bulle(el, 'a2').style.getPropertyValue('--d')).toBe('48px'); // ¼ du CA → ½ du diamètre
    expect(bulle(el, 'a3').style.getPropertyValue('--d')).toBe('30px'); // CA inconnu : taille minimale
    expect(bulle(el, 'a1').style.background).toBeTruthy();
    // lecture seule : ni bouton d'ajout ni liste d'édition
    expect(bouton(el, 'Ajouter une activité')).toBeUndefined();
    expect(el.querySelector('.bcg__table')).toBeNull();
  });

  it('en édition : refuse une activité sans nom, puis l\'ajoute dans le quadrant choisi', async () => {
    const { fixture, el, contenu, emis } = await creer(true, { activites: [], ecartees: [] });
    bouton(el, 'Ajouter une activité').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.bcg__form')?.textContent).toContain('Nom de l\'activité');

    bouton(el, 'Enregistrer').click();
    fixture.detectChanges();
    expect(contenu.activites.length).toBe(0);
    expect(emis.length).toBe(0);
    expect(el.querySelector('.bcg__erreur')).toBeTruthy();

    const nom = el.querySelector('.bcg__nom-champ') as HTMLInputElement;
    nom.value = 'Location';
    nom.dispatchEvent(new Event('input'));
    const ca = el.querySelector('.bcg__ca-champ') as HTMLInputElement;
    ca.value = '1500000';
    ca.dispatchEvent(new Event('input'));
    const q = el.querySelector('.bcg__quadrant-champ') as HTMLSelectElement;
    q.selectedIndex = 1; // Dilemmes
    q.dispatchEvent(new Event('change'));
    bouton(el, 'Enregistrer').click();
    fixture.detectChanges();

    expect(contenu.activites).toEqual([expect.objectContaining({ nom: 'Location', ca: 1500000, quadrant: 'DILEMME' })]);
    expect(contenu.activites[0].couleur).toMatch(/^#[0-9a-f]{6}$/i);
    expect(emis).toEqual([contenu]);
    expect(el.querySelector('.bcg__form')).toBeNull();
    expect(quadrant(el, 'DILEMME').textContent).toContain('Location');
    expect(txt(el.querySelector('.bcg__table'))).toContain('1 500 000');
  });

  it('en édition : modifie puis supprime une activité depuis la liste', async () => {
    const { fixture, el, contenu, emis } = await creer(true);
    const ligne = () => el.querySelector('.bcg__table tr[data-id="a2"]') as HTMLElement;

    (ligne().querySelector('.bcg__modifier') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.bcg__form-titre')?.textContent).toContain('Modifier');
    const q = el.querySelector('.bcg__quadrant-champ') as HTMLSelectElement;
    q.selectedIndex = 0; // Vedettes
    q.dispatchEvent(new Event('change'));
    bouton(el, 'Enregistrer').click();
    fixture.detectChanges();
    expect(contenu.activites[1].quadrant).toBe('VEDETTE');
    expect(quadrant(el, 'VEDETTE').querySelector('.bcg__act[data-id="a2"]')).toBeTruthy();
    expect(emis.length).toBe(1);

    confirmation.reponse = false;            // Annuler dans la fenêtre de confirmation : rien n'est supprimé
    (ligne().querySelector('.bcg__supprimer') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(confirmation.confirm).toHaveBeenCalledWith('Supprimer cette activité ?', expect.any(String));
    expect(contenu.activites).toHaveLength(3);
    confirmation.reponse = true;
    (ligne().querySelector('.bcg__supprimer') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(contenu.activites.map((a: any) => a.id)).toEqual(['a1', 'a3']);
    expect(el.querySelector('.bcg__act[data-id="a2"]')).toBeNull();
    expect(emis.length).toBe(2);
  });
});
