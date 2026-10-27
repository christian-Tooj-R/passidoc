import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { SuiviPiecesComponent } from './suivi-pieces.component';
import { SuiviPiecesService } from '../../core/services/suivi-pieces.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';

const p = (mois: number, joursRetard: number) => ({ type: 'RELEVE_BANCAIRE', libelle: 'Relevés bancaires', mois, annee: 2026, echeance: '', joursRetard, statut: 'MANQUANT' });
const ligne = (o: any) => ({
  clientId: 1, client: 'A', site: 'EST', intervenants: { directeur: null, responsable: 'Marie Dubois', collaborateurOuest: null },
  attendus: 9, deposes: 9, taux: 100, manquantes: [], plusAncienRetard: 0, horsDelai: 0, indicateur: 'VERT', derniereRelance: null,
  approche: 'PROFESSIONNEL', destinataire: null, contactOperationnel: { nom: null, telephone: null, email: null }, ...o,
});
const tableau = {
  annee: 2026, delaiJours: 15, relanceAutoActive: false, sourceDonnees: 'PASSIDOC',
  lignes: [
    ligne({ clientId: 1, client: 'TRANSMAS', indicateur: 'ROUGE', deposes: 7, taux: 78, manquantes: [p(7, 84), p(8, 53)], plusAncienRetard: 84, horsDelai: 2,
      destinataire: { nom: 'Sophie', email: 'compta@example.com', role: 'OPERATIONNEL' }, contactOperationnel: { nom: 'Sophie', telephone: '0262', email: 'compta@example.com' }, approche: 'AMICAL' }),
    ligne({ clientId: 2, client: 'BOURBON', indicateur: 'ORANGE', manquantes: [p(9, 5)], plusAncienRetard: 5 }),
    ligne({ clientId: 3, client: 'SOLEIL', indicateur: 'VERT' }),
  ],
  totaux: { dossiers: 3, rouge: 1, orange: 1, vert: 1, nonSuivi: 0, piecesManquantes: 3 },
};
const svc = { tableau: vi.fn(() => of(tableau)), apercuRelance: vi.fn(() => of({ ...tableau, manquantes: [], destinataire: null, objet: '', texte: '' })), envoyerRelance: vi.fn() };
const auth = { isAdmin: vi.fn(() => true) };
const tenant = { updateConfig: vi.fn(() => of({})) };
const toast = { success: vi.fn(), error: vi.fn() };

async function create() {
  await TestBed.configureTestingModule({
    imports: [SuiviPiecesComponent],
    providers: [provideRouter([]),
      { provide: SuiviPiecesService, useValue: svc }, { provide: AuthService, useValue: auth },
      { provide: TenantService, useValue: tenant }, { provide: ToastService, useValue: toast }],
  }).compileComponents();
  const fixture = TestBed.createComponent(SuiviPiecesComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}
const lignesAffichees = (el: HTMLElement) => [...el.querySelectorAll('tbody tr')].map(tr => tr.querySelector('.lnk')!.textContent!.trim());

describe('SuiviPiecesComponent (cahier v2 #1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche indicateurs, pièces manquantes, retard et contact par dossier', async () => {
    const { el } = await create();
    expect(svc.tableau).toHaveBeenCalledWith(new Date().getFullYear());
    expect(lignesAffichees(el)).toEqual(['TRANSMAS', 'BOURBON', 'SOLEIL']);
    const r1 = el.querySelector('tbody tr')!;
    expect(r1.querySelector('.ind')!.textContent).toContain('À relancer');
    expect(r1.querySelectorAll('.piece').length).toBe(2);
    expect(r1.querySelectorAll('.piece--late').length).toBe(2);
    expect(r1.textContent).toContain('84 j');
    expect(r1.querySelector('.td-contact')!.textContent).toContain('Sophie');
    expect(el.querySelector('.kpi--ROUGE .kpi__v')!.textContent!.trim()).toBe('1');
    expect(el.querySelector('.source')!.textContent).toContain('TIIME');
  });

  it('filtre par indicateur (cartes) et par recherche', async () => {
    const { el, fixture, comp } = await create();
    (el.querySelector('.kpi--ORANGE') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(lignesAffichees(el)).toEqual(['BOURBON']);
    (el.querySelector('.kpi--ORANGE') as HTMLButtonElement).click();
    comp.recherche.set('compta@');
    fixture.detectChanges();
    expect(lignesAffichees(el)).toEqual(['TRANSMAS']);
  });

  it('« Relancer » seulement s’il y a des pièces et une adresse ; ouvre la fenêtre de relance', async () => {
    const { el, fixture } = await create();
    const boutons = [...el.querySelectorAll('.btn-relance')] as HTMLButtonElement[];
    expect(boutons.map(b => b.disabled)).toEqual([false, true, true]);
    boutons[0].click();
    fixture.detectChanges();
    expect(el.querySelector('app-relance-client')).not.toBeNull();
    expect(svc.apercuRelance).toHaveBeenCalledWith(1, new Date().getFullYear());
  });

  it('ADMIN : enregistre le délai et la relance automatique (avec confirmation)', async () => {
    const { comp } = await create();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    comp.delai = 20;
    comp.relanceAuto = true;
    comp.enregistrerReglages();
    expect(window.confirm).toHaveBeenCalled();
    expect(tenant.updateConfig).toHaveBeenCalledWith({ relanceDelaiJours: 20, relanceAutoActive: true });
    comp.delai = 0;
    comp.enregistrerReglages();
    expect(toast.error).toHaveBeenCalled();
    expect(tenant.updateConfig).toHaveBeenCalledTimes(1);
  });

  it('non-ADMIN : pas de réglages des relances', async () => {
    auth.isAdmin.mockReturnValue(false);
    const { el } = await create();
    expect(el.querySelector('.reglages')).toBeNull();
    auth.isAdmin.mockReturnValue(true);
  });
});
