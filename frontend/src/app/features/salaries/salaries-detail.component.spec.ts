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

const mockSvc  = { getOne: vi.fn().mockReturnValue(of(null)), updateRH: vi.fn().mockReturnValue(of({})), updateRole: vi.fn().mockReturnValue(of({})) };
const mockCSvc = { mesDemandes: vi.fn().mockReturnValue(of([])), getSoldes: vi.fn().mockReturnValue(of([])), findAll: vi.fn().mockReturnValue(of([])) };
const mockTenant = { poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'), poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'), poleFlag: vi.fn(), poleLabel: vi.fn() };
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
});
