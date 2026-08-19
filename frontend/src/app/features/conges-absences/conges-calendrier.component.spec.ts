import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { CongesCalendrierComponent } from './conges-calendrier.component';
import { CongesAbsencesService } from '../../core/services/conges-absences.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';

const mockConges = {
  findAll:       vi.fn().mockReturnValue(of([])),
  getCalendrier: vi.fn().mockReturnValue(of([])),
  mesSoldes:     vi.fn().mockReturnValue(of([])),
  approuver:     vi.fn().mockReturnValue(of({})),
  refuser:       vi.fn().mockReturnValue(of({})),
};
const mockAuth = {
  currentUser: vi.fn().mockReturnValue({ id: 1, firstName: 'Sophie', role: 'COLLABORATEUR' }),
  isAdmin: vi.fn().mockReturnValue(false),
  hasFullVisibility: vi.fn().mockReturnValue(false),
};
const mockTenant = {
  poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'),
  poleFlag: vi.fn(), poleLabel: vi.fn(),
};

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [CongesCalendrierComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: CongesAbsencesService, useValue: mockConges },
      { provide: AuthService,           useValue: mockAuth },
      { provide: TenantService,         useValue: mockTenant },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(CongesCalendrierComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('CongesCalendrierComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConges.findAll.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge le calendrier au init', async () => {
    await createComponent();
    expect(mockConges.getCalendrier).toHaveBeenCalled();
  });

  it('mois est le mois courant par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.mois()).toBe(new Date().getMonth() + 1);
  });

  it('annee est l\'année courante par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.annee()).toBe(new Date().getFullYear());
  });

  it('loading est false après init', async () => {
    const { comp } = await createComponent();
    expect(comp.loading()).toBe(false);
  });
});
