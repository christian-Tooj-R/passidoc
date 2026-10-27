import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CongesAbsencesComponent } from './conges-absences.component';
import { CongesAbsencesService } from '../../core/services/conges-absences.service';
import { SalariesService } from '../salaries/salaries.service';
import { TenantService } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';

const mockConges  = {
  findAll: vi.fn().mockReturnValue(of([])),
  getStats: vi.fn().mockReturnValue(of({})),
  create: vi.fn().mockReturnValue(of({})),
  approuver: vi.fn().mockReturnValue(of({})),
  refuser: vi.fn().mockReturnValue(of({})),
  getSoldes: vi.fn().mockReturnValue(of([])),
  mesSoldes: vi.fn().mockReturnValue(of([])),
  annuler: vi.fn().mockReturnValue(of({})),
};
const mockSalaries = { list: vi.fn().mockReturnValue(of([])) };
const mockTenant  = {
  poleFlag1: vi.fn().mockReturnValue('🔵'), poleLabel1: vi.fn().mockReturnValue('Pôle EST'),
  poleFlag2: vi.fn().mockReturnValue('🟠'), poleLabel2: vi.fn().mockReturnValue('Pôle OUEST'), intervenantLabel1: vi.fn().mockReturnValue('Collaborateur Réunion'), intervenantLabel2: vi.fn().mockReturnValue('Collaborateur Madagascar'),
  poleFlag: vi.fn(), poleLabel: vi.fn(),
};
const mockSnack   = { open: vi.fn() };
// Le composant est derrière authGuard : un utilisateur connecté existe toujours.
const COLLAB = { id: 7, firstName: 'Sophie', lastName: 'Martin', role: 'COLLABORATEUR' };
const ADMIN  = { id: 1, firstName: 'Alvin', lastName: 'Paquiry', role: 'ADMIN' };
let connecte: any = COLLAB;
const mockAuth = {
  currentUser: vi.fn(() => connecte),
  isAdmin: vi.fn(() => connecte?.role === 'ADMIN'),
};

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [CongesAbsencesComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: CongesAbsencesService, useValue: mockConges },
      { provide: SalariesService,       useValue: mockSalaries },
      { provide: TenantService,         useValue: mockTenant },
      { provide: MatSnackBar,           useValue: mockSnack },
      { provide: AuthService,           useValue: mockAuth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CongesAbsencesComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('CongesAbsencesComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connecte = COLLAB;
    mockConges.findAll.mockReturnValue(of([]));
    mockConges.getStats.mockReturnValue(of({}));
    mockConges.mesSoldes.mockReturnValue(of([]));
    mockConges.getSoldes.mockReturnValue(of([]));
    mockSalaries.list.mockReturnValue(of([]));
  });

  describe('visibilité des soldes (ADMIN = tout le monde, sinon soi-même)', () => {
    it('un collaborateur ne charge que ses propres soldes', async () => {
      mockConges.mesSoldes.mockReturnValue(of([{ typeConge: 'CONGES_PAYES', joursAcquis: 25, solde: 12 }]));
      const { comp } = await createComponent();
      expect(mockConges.mesSoldes).toHaveBeenCalled();
      expect(mockSalaries.list).not.toHaveBeenCalled();
      expect(comp.allSoldes()).toEqual([
        { userId: 7, name: 'Sophie Martin', initials: 'SM', soldes: { CONGES_PAYES: 12 } },
      ]);
    });

    it("l'ADMIN charge les soldes de toute l'équipe", async () => {
      connecte = ADMIN;
      mockSalaries.list.mockReturnValue(of([{ id: 3, firstName: 'Jean', lastName: 'Dupont' }, { id: 4, firstName: 'Lova', lastName: 'R' }]));
      const { comp } = await createComponent();
      expect(mockConges.mesSoldes).not.toHaveBeenCalled();
      expect(mockConges.getSoldes).toHaveBeenCalledTimes(2);
      expect(comp.allSoldes().map(r => r.userId).sort()).toEqual([3, 4]);
    });
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les données au init', async () => {
    await createComponent();
    expect(mockConges.findAll).toHaveBeenCalled();
  });

  it('annee est l\'année courante par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.annee()).toBe(new Date().getFullYear());
  });

  it('showNewForm est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.showNewForm()).toBe(false);
  });

  it('statutFiltre est EN_ATTENTE par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.statutFiltre()).toBe('EN_ATTENTE');
  });

  it('loading est false après chargement', async () => {
    const { comp } = await createComponent();
    expect(comp.loading()).toBe(false);
  });

  describe('changeAnnee', () => {
    it('incrémente l\'année et recharge les données', async () => {
      const { comp } = await createComponent();
      const before = comp.annee();
      vi.clearAllMocks();
      mockConges.findAll.mockReturnValue(of([]));
      mockConges.getStats.mockReturnValue(of({}));
      comp.changeAnnee(1);
      expect(comp.annee()).toBe(before + 1);
      expect(mockConges.findAll).toHaveBeenCalled();
    });
  });

  describe('demandesFiltrees', () => {
    it('filtre par statutFiltre', async () => {
      const demandes = [
        { id: 1, statut: 'EN_ATTENTE', type: 'CONGE_PAYE', collaborateur: { firstName: 'Sophie', lastName: 'M', site: 'EST' } },
        { id: 2, statut: 'APPROUVE',   type: 'CONGE_PAYE', collaborateur: { firstName: 'Jean',   lastName: 'D', site: 'EST' } },
      ];
      mockConges.findAll.mockReturnValue(of(demandes));
      const { comp } = await createComponent();
      comp.statutFiltre.set('EN_ATTENTE');
      expect(comp.demandesFiltrees()).toHaveLength(1);
    });
  });
});
