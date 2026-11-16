/**
 * Liste d'éléments des outils BP : ajout, modification, suppression après confirmation.
 */
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { BpListeComponent } from './bp-liste.component';
import { ConfirmService } from '../../../../../core/services/confirm.service';

const confirmation = { reponse: true, confirm: vi.fn(() => of(confirmation.reponse)) };

async function afficher(items: any[]) {
  TestBed.configureTestingModule({ imports: [BpListeComponent], providers: [{ provide: ConfirmService, useValue: confirmation }] });
  const fixture = TestBed.createComponent(BpListeComponent);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('editable', true);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('BpListeComponent — suppression confirmée', () => {
  it('la croix demande confirmation ; Annuler garde l’élément, Supprimer le retire', async () => {
    const items = [{ id: '1', texte: 'Clientèle fidèle' }, { id: '2', texte: 'Équipe stable' }];
    const { fixture, comp, el } = await afficher(items);
    let emis = 0;
    comp.changement.subscribe(() => emis++);
    confirmation.reponse = false;
    (el.querySelectorAll('.bl__suppr')[0] as HTMLButtonElement).click();
    expect(confirmation.confirm).toHaveBeenCalledWith('Supprimer cet élément ?', expect.stringContaining('« Clientèle fidèle »'));
    expect(items).toHaveLength(2);
    expect(emis).toBe(0);
    confirmation.reponse = true;
    (el.querySelectorAll('.bl__suppr')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(items.map(i => i.texte)).toEqual(['Équipe stable']);
    expect(emis).toBe(1);
  });
});
