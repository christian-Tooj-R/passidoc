import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SalariesDetailComponent } from './salaries-detail.component';
import { SalariesService } from './salaries.service';
import { CongesAbsencesService } from '../../core/services/conges-absences.service';
import { TenantService } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';

const mockSvc  = { getOne: vi.fn().mockReturnValue(of(null)), updateRH: vi.fn().mockReturnValue(of({})), updateRole: vi.fn().mockReturnValue(of({})), updatePrixVente: vi.fn() };
let connecte: any = { id: 1, role: 'ADMIN' };
const mockAuth = {
  currentUser: vi.fn(() => connecte),
  isAdmin: vi.fn(() => connecte.role === 'ADMIN'),
  isExpert: vi.fn(() => connecte.role === 'EXPERT_COMPTABLE'),
  isChefAntenne: vi.fn(() => false),
  isChefMission: vi.fn(() => false),
};
const julie = { id: 7, firstName: 'Julie', lastName: 'R', role: 'COLLABORATEUR', site: 'EST', prixVenteHoraire: '20.00', salaireBase: null, devise: 'EUR', iban: null };
const mockCSvc = { mesDemandes: vi.fn().mockReturnValue(of([])), getSoldes: vi.fn().mockReturnValue(of([])), findAll: vi.fn().mockReturnValue(of([])) };
const mockTenant = { poleFlag1: vi.fn().mockReturnValue('🔵'), poleLabel1: vi.fn().mockReturnValue('Pôle EST'), poleFlag2: vi.fn().mockReturnValue('🟠'), poleLabel2: vi.fn().mockReturnValue('Pôle OUEST'), intervenantLabel1: vi.fn().mockReturnValue('Collaborateur Réunion'), intervenantLabel2: vi.fn().mockReturnValue('Collaborateur Madagascar'), poleFlag: vi.fn(), poleLabel: vi.fn() };
const mockSnack  = { open: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [SalariesDetailComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'rh/salaries/:id', component: SalariesDetailComponent }]),
      provideAnimations(),
      { provide: SalariesService,       useValue: mockSvc },
      { provide: CongesAbsencesService, useValue: mockCSvc },
      { provide: TenantService,         useValue: mockTenant },
      { provide: MatSnackBar,           useValue: mockSnack },
      { provide: AuthService,           useValue: mockAuth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SalariesDetailComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('SalariesDetailComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connecte = { id: 1, role: 'ADMIN' };
    mockSvc.getOne.mockReturnValue(of(null));
    mockCSvc.findAll.mockReturnValue(of([]));
    mockCSvc.getSoldes.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('editVisible est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.editVisible()).toBe(false);
  });

  it('saving est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.saving()).toBe(false);
  });

  it('anneeConges est l\'année courante', async () => {
    const { comp } = await createComponent();
    expect(comp.anneeConges()).toBe(new Date().getFullYear());
  });

  describe('prix de vente horaire (PV Col)', () => {
    const ouvrirPaie = async () => {
      mockSvc.getOne.mockReturnValue(of(julie));
      const r = await createComponent();
      r.comp.profilTab.set('paie');
      r.fixture.detectChanges();
      return r;
    };

    it("charge le tarif du collaborateur et le rend modifiable par l'ADMIN", async () => {
      const { comp, fixture } = await ouvrirPaie();
      expect(comp.prixVente).toBe(20);
      expect(fixture.nativeElement.querySelector('input.pv-input')).not.toBeNull();
    });

    it('enregistre le nouveau tarif', async () => {
      mockSvc.updatePrixVente.mockReturnValue(of({ ...julie, prixVenteHoraire: 85 }));
      const { comp } = await ouvrirPaie();
      comp.prixVente = 85;
      comp.enregistrerPrixVente();
      expect(mockSvc.updatePrixVente).toHaveBeenCalledWith(7, 85);
      expect(comp.collab()!.prixVenteHoraire).toBe(85);
      expect(comp.pvMessage()).toBe('Enregistré');
    });

    it('un champ vidé efface le tarif, un montant négatif est refusé', async () => {
      mockSvc.updatePrixVente.mockReturnValue(of({ ...julie, prixVenteHoraire: null }));
      const { comp } = await ouvrirPaie();
      comp.prixVente = null;
      comp.enregistrerPrixVente();
      expect(mockSvc.updatePrixVente).toHaveBeenCalledWith(7, null);
      mockSvc.updatePrixVente.mockClear();
      comp.prixVente = -3;
      comp.enregistrerPrixVente();
      expect(mockSvc.updatePrixVente).not.toHaveBeenCalled();
      expect(comp.pvMessage()).toBe('Montant invalide');
    });

    it("le collaborateur voit son propre tarif en lecture seule", async () => {
      connecte = { id: 7, role: 'COLLABORATEUR' };
      const { fixture } = await ouvrirPaie();
      expect(fixture.nativeElement.querySelector('input.pv-input')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('20.00 € / h');
    });

    it('ne plante pas quand la fiche est introuvable', async () => {
      mockSvc.getOne.mockReturnValue(of(null));
      const { comp } = await createComponent();
      expect(comp.prixVente).toBeNull();
    });
  });
});
