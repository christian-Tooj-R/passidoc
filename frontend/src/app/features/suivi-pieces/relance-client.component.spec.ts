import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { RelanceClientComponent } from './relance-client.component';
import { SuiviPiecesService } from '../../core/services/suivi-pieces.service';

const piece = { type: 'RELEVE_BANCAIRE', libelle: 'Relevés bancaires', mois: 8, annee: 2026, echeance: '2026-09-01', joursRetard: 52, statut: 'MANQUANT' };
const apercu = {
  clientId: 12, client: 'Association Lire & Vivre', approche: 'AMICAL',
  destinataire: { nom: 'Sophie Hoarau', email: 'compta@example.com', role: 'OPERATIONNEL' },
  manquantes: [piece], objet: 'Petit rappel : documents en attente', texte: 'Bonjour Sophie,\n\n• Relevés bancaires : août 2026',
};
const svc = { apercuRelance: vi.fn(), envoyerRelance: vi.fn() };

async function create(a: any = apercu) {
  svc.apercuRelance.mockReturnValue(a instanceof Error ? throwError(() => ({ error: { message: a.message } })) : of(a));
  await TestBed.configureTestingModule({ imports: [RelanceClientComponent], providers: [{ provide: SuiviPiecesService, useValue: svc }] }).compileComponents();
  const fixture = TestBed.createComponent(RelanceClientComponent);
  fixture.componentInstance.clientId = 12;
  fixture.componentInstance.annee = 2026;
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, comp: fixture.componentInstance, el };
}

describe('RelanceClientComponent (cahier v2 #1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('montre le destinataire (contact opérationnel), l’approche et le texte pré-rédigé modifiable', async () => {
    const { el, comp } = await create();
    expect(svc.apercuRelance).toHaveBeenCalledWith(12, 2026);
    expect(el.querySelector('.rc-dest')!.textContent).toContain('contact opérationnel');
    expect(el.querySelector('.rc-dest')!.textContent).toContain('compta@example.com');
    expect(el.querySelector('.rc-appr')!.textContent).toContain('Approche amical');
    expect(comp.objet).toBe(apercu.objet);
    expect(comp.texte).toContain('Bonjour Sophie');
    expect(svc.envoyerRelance).not.toHaveBeenCalled();
  });

  it('envoie le texte relu, puis confirme l’envoi', async () => {
    svc.envoyerRelance.mockReturnValue(of({ envoyeA: 'compta@example.com', destinataire: apercu.destinataire, nbPieces: 1, dateRelance: '2026-10-23' }));
    const { el, comp, fixture } = await create();
    const emis: any[] = [];
    comp.envoyee.subscribe(r => emis.push(r));
    comp.texte = 'Texte retouché';
    (el.querySelector('.rc-btn--ok') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(svc.envoyerRelance).toHaveBeenCalledWith(12, { objet: apercu.objet, texte: 'Texte retouché' }, 2026);
    expect(el.querySelector('.rc-ok')!.textContent).toContain('Relance envoyée à Sophie Hoarau');
    expect(emis).toHaveLength(1);
  });

  it('sans adresse e-mail : envoi impossible et consigne affichée', async () => {
    const { el } = await create({ ...apercu, destinataire: null });
    expect(el.querySelector('.rc-dest--none')!.textContent).toContain("Renseignez le contact opérationnel");
    expect((el.querySelector('.rc-btn--ok') as HTMLButtonElement).disabled).toBe(true);
  });

  it('erreur serveur à l’envoi : message affiché, la relance reste éditable', async () => {
    svc.envoyerRelance.mockReturnValue(throwError(() => ({ error: { message: 'Envoi refusé' } })));
    const { el, fixture } = await create();
    (el.querySelector('.rc-btn--ok') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.rc-err')!.textContent).toContain('Envoi refusé');
    expect(el.querySelector('textarea')).not.toBeNull();
  });

  it('dossier inaccessible : message d’erreur', async () => {
    const { el } = await create(new Error('Accès interdit'));
    expect(el.querySelector('.rc-etat--err')!.textContent).toContain('Accès interdit');
  });
});
