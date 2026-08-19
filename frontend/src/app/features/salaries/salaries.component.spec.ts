import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SalariesComponent } from './salaries.component';
import { SalariesService } from './salaries.service';
import { TenantService } from '../../core/services/tenant.service';

const mockSvc   = { list: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of({})), updateRH: vi.fn().mockReturnValue(of({})) };
const mockTenant = { poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'), poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'), poleFlag: vi.fn(), poleLabel: vi.fn() };
const mockSnack = { open: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [SalariesComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: SalariesService, useValue: mockSvc },
      { provide: TenantService,   useValue: mockTenant },
      { provide: MatSnackBar,     useValue: mockSnack },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SalariesComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('SalariesComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSvc.list.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les salariés au init', async () => {
    await createComponent();
    expect(mockSvc.list).toHaveBeenCalled();
  });

  it('loading passe à false après chargement', async () => {
    const { comp } = await createComponent();
    expect(comp.loading()).toBe(false);
  });

  it('formVisible est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.formVisible()).toBe(false);
  });

  it('search est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.search()).toBe('');
  });

  it('siteFiltre est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.siteFiltre()).toBe('');
  });

  it('statutFiltre est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.statutFiltre()).toBe('');
  });

  describe('stats', () => {
    it('retourne 0 actifs et 0 total sans données', async () => {
      const { comp } = await createComponent();
      expect(comp.stats().total).toBe(0);
    });

    it('compte correctement les actifs', async () => {
      mockSvc.list.mockReturnValue(of([
        { id: 1, dateSortie: null,         site: 'REUNION',    role: 'COLLABORATEUR', firstName: 'A', lastName: 'A' },
        { id: 2, dateSortie: '2023-01-01', site: 'REUNION',    role: 'COLLABORATEUR', firstName: 'B', lastName: 'B' },
        { id: 3, dateSortie: null,         site: 'MADAGASCAR', role: 'COLLABORATEUR', firstName: 'C', lastName: 'C' },
      ]));
      const { comp } = await createComponent();
      expect(comp.stats().actifs).toBe(2);
      expect(comp.stats().total).toBe(3);
    });
  });

  describe('listeFiltree', () => {
    it('filtre par siteFiltre', async () => {
      mockSvc.list.mockReturnValue(of([
        { id: 1, firstName: 'Sophie', lastName: 'M', site: 'REUNION',    isActive: true, role: 'COLLABORATEUR' },
        { id: 2, firstName: 'Jean',   lastName: 'D', site: 'MADAGASCAR', isActive: true, role: 'COLLABORATEUR' },
      ]));
      const { comp } = await createComponent();
      comp.siteFiltre.set('REUNION');
      expect(comp.listeFiltree()).toHaveLength(1);
      expect(comp.listeFiltree()[0].firstName).toBe('Sophie');
    });

    it('filtre par recherche textuelle', async () => {
      mockSvc.list.mockReturnValue(of([
        { id: 1, firstName: 'Sophie', lastName: 'Martin', site: 'REUNION', isActive: true, role: 'COLLABORATEUR' },
        { id: 2, firstName: 'Jean',   lastName: 'Dupont', site: 'REUNION', isActive: true, role: 'COLLABORATEUR' },
      ]));
      const { comp } = await createComponent();
      comp.search.set('sophie');
      expect(comp.listeFiltree()).toHaveLength(1);
    });
  });
});
