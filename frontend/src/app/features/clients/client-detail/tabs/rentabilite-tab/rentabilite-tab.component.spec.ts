import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { SimpleChange } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { RentabiliteTabComponent } from './rentabilite-tab.component';
import { SaisieTempsService, RentabiliteDossier } from '../../../../../core/services/saisie-temps.service';

const dossier = (p: Partial<RentabiliteDossier> = {}, ind: any = {}): RentabiliteDossier => ({
  client: { id: 10, nom: 'TRANSMAS' },
  affaire: 'C2026-09',
  affaires: [
    { code: 'C2027-09', dateOuverture: '2026-10-01', dateCloture: '2027-09-30', etat: 'O', source: 'CALCUL' },
    { code: 'C2026-09', dateOuverture: '2025-10-01', dateCloture: '2026-09-30', etat: 'O', source: 'CALCUL' },
  ],
  indicateurs: {
    clientId: 10, client: 'TRANSMAS', site: 'EST', intervenants: { directeur: null, responsable: null, collaborateurOuest: null },
    affaire: 'C2026-09', etat: 'O', dateOuverture: '2025-10-01', dateCloture: '2026-09-30', budgetId: 1,
    honoraires: 3000, honorairesSource: 'FICHE', heuresBudget: 100, prixVenteHoraire: 30, prixVenteCalcule: true,
    heuresConsommees: 107.7, heuresRestantes: -7.7, tauxConsommation: 1.077, statut: 'DEPASSE', montantRealise: 3231,
    boniMali: -231, boniMaliPct: -0.077, valorisation: 2521, margeValorisation: 479, ...ind,
  },
  historique: [],
  heuresHorsBudget: 4,
  parMission: [{ missionCode: 'REV', heures: 60 }, { missionCode: 'SANS', heures: 47.7 }],
  parMois: [{ mois: '2026-09', heures: 50 }],
  parCollaborateur: [{ collaborateurId: 1, collaborateur: 'AAM', heures: 10, valorisation: 1000 }],
  peutModifierBudget: true,
  voirValorisation: true,
  missionsHorsBudget: ['SOC', 'JUR', 'CON'],
  seuilAttention: 0.8,
  ...p,
});

const mockSvc = {
  getRentabiliteDossier: vi.fn(() => of(dossier())),
  saveBudgetDossier: vi.fn(() => of({})),
  deleteBudgetDossier: vi.fn(() => of(undefined)),
};

async function create(readonly = false) {
  await TestBed.configureTestingModule({
    imports: [RentabiliteTabComponent],
    providers: [provideRouter([]), provideAnimations(), { provide: SaisieTempsService, useValue: mockSvc }],
  }).compileComponents();
  const fixture = TestBed.createComponent(RentabiliteTabComponent);
  const comp = fixture.componentInstance;
  comp.clientId = 10;
  comp.readonly = readonly;
  comp.ngOnChanges({ clientId: new SimpleChange(undefined, 10, true) });
  fixture.detectChanges();
  return { fixture, comp, el: fixture.nativeElement as HTMLElement };
}

describe('RentabiliteTabComponent', () => {
  beforeEach(() => { vi.clearAllMocks(); mockSvc.getRentabiliteDossier.mockImplementation(() => of(dossier())); });

  it("affiche le bandeau rouge de dépassement et les indicateurs", async () => {
    const { el, comp } = await create();
    expect(mockSvc.getRentabiliteDossier).toHaveBeenCalledWith(10, undefined);
    const alerte = el.querySelector('.alert--DEPASSE')!;
    expect(alerte.textContent).toContain('Budget dépassé');
    expect(alerte.textContent).toContain('108 %');
    expect(el.textContent).toContain('dépassement de 7h42');
    expect(el.textContent).toContain('Mali');
    expect(comp.budgetHeures).toBe('100h00');
    expect(comp.budgetHonoraires).toBeNull(); // honoraires repris de la fiche identité
  });

  it('bandeau orange à partir de 80 %, rien en dessous', async () => {
    mockSvc.getRentabiliteDossier.mockImplementation(() => of(dossier({}, { statut: 'ATTENTION', tauxConsommation: 0.85, heuresConsommees: 85, heuresRestantes: 15 })));
    const a = await create();
    expect(a.el.querySelector('.alert--ATTENTION')).not.toBeNull();
    TestBed.resetTestingModule();
    mockSvc.getRentabiliteDossier.mockImplementation(() => of(dossier({}, { statut: 'OK', tauxConsommation: 0.5 })));
    const b = await create();
    expect(b.el.querySelector('.alert')).toBeNull();
  });

  it('enregistre le budget saisi en heures et minutes (60h30 → 60,5 h)', async () => {
    const { comp } = await create();
    comp.budgetHeures = '60h30';
    comp.budgetHonoraires = 2500;
    comp.budgetPvh = null;
    comp.enregistrer();
    expect(mockSvc.saveBudgetDossier).toHaveBeenCalledWith(10, { affaire: 'C2026-09', heuresBudget: 60.5, honoraires: 2500, prixVenteHoraire: null });
    expect(mockSvc.getRentabiliteDossier).toHaveBeenLastCalledWith(10, 'C2026-09');
  });

  it("refuse un budget illisible sans appeler l'API", async () => {
    const { comp } = await create();
    comp.budgetHeures = 'beaucoup';
    comp.enregistrer();
    expect(mockSvc.saveBudgetDossier).not.toHaveBeenCalled();
    expect(comp.erreur()).toContain('Budget temps invalide');
  });

  it("affiche les erreurs de validation renvoyées par l'API", async () => {
    mockSvc.saveBudgetDossier.mockReturnValueOnce(throwError(() => ({ error: { message: ['Affaire invalide', 'Budget > 0'] } })));
    const { comp } = await create();
    comp.budgetHeures = '10';
    comp.enregistrer();
    expect(comp.erreur()).toBe('Affaire invalide Budget > 0');
    expect(comp.saving()).toBe(false);
  });

  it('supprime le budget après confirmation', async () => {
    const { comp } = await create();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    comp.supprimer();
    expect(mockSvc.deleteBudgetDossier).not.toHaveBeenCalled();
    comp.supprimer();
    expect(mockSvc.deleteBudgetDossier).toHaveBeenCalledWith(10, 'C2026-09');
  });

  it("change d'affaire", async () => {
    const { comp } = await create();
    comp.load('C2027-09');
    expect(mockSvc.getRentabiliteDossier).toHaveBeenLastCalledWith(10, 'C2027-09');
  });

  it('lecture seule : pas de formulaire de budget, ni valorisation ni détail par collaborateur hors ADMIN', async () => {
    mockSvc.getRentabiliteDossier.mockImplementation(() => of(dossier({
      peutModifierBudget: false, voirValorisation: false, parCollaborateur: null,
    }, { valorisation: null, margeValorisation: null })));
    const { el } = await create();
    expect(el.querySelector('form.budget')).toBeNull();
    expect(el.textContent).toContain('Budget temps');
    expect(el.textContent).not.toContain('Valorisation PV Col');
    expect(el.textContent).not.toContain('Par collaborateur');
  });

  it("masque le formulaire quand le dossier est en lecture seule, même pour un profil autorisé", async () => {
    const { el } = await create(true);
    expect(el.querySelector('form.budget')).toBeNull();
  });

  it('signale le temps passé hors budget compta', async () => {
    const { el } = await create();
    expect(el.textContent).toContain('+ 4h00 sur cette affaire hors budget compta');
    expect(el.textContent).toContain('SOC, JUR, CON');
  });
});
