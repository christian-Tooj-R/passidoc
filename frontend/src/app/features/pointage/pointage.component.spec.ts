import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PointageComponent } from './pointage.component';
import { PointageService } from '../../core/services/pointage.service';
import { AuthService } from '../../core/services/auth.service';
import { GeoLocationService } from '../../core/services/geo-location.service';
import { TenantService } from '../../core/services/tenant.service';

const mockPointage = {
  getMonStatut:    vi.fn().mockReturnValue(of(null)),
  getHistorique:   vi.fn().mockReturnValue(of([])),
  getSiteLocation: vi.fn().mockReturnValue(of(null)),
  pointer:         vi.fn().mockReturnValue(of({})),
  getJournee:      vi.fn().mockReturnValue(of([])),
};
const mockAuth = {
  currentUser: vi.fn().mockReturnValue({ id: 1, firstName: 'Sophie', role: 'COLLABORATEUR', site: 'REUNION' }),
  isAdmin: vi.fn().mockReturnValue(false),
  hasFullVisibility: vi.fn().mockReturnValue(false),
};
const mockGeo  = { getCurrentPosition: vi.fn() };
const mockTenant = {
  poleFlag1:  vi.fn().mockReturnValue('🇷🇪'),
  poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2:  vi.fn().mockReturnValue('🇲🇬'),
  poleLabel2: vi.fn().mockReturnValue('Madagascar'),
  poleFlag:   vi.fn().mockReturnValue('🇷🇪'),
  poleLabel:  vi.fn().mockReturnValue('Réunion'),
};
const mockSnack = { open: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [PointageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      provideNativeDateAdapter(),
      { provide: PointageService,    useValue: mockPointage },
      { provide: AuthService,        useValue: mockAuth },
      { provide: GeoLocationService, useValue: mockGeo },
      { provide: TenantService,      useValue: mockTenant },
      { provide: MatSnackBar,        useValue: mockSnack },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PointageComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('PointageComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPointage.getMonStatut.mockReturnValue(of(null));
    mockPointage.getHistorique.mockReturnValue(of([]));
    mockPointage.getSiteLocation.mockReturnValue(of(null));
    mockPointage.getJournee.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge le statut au init', async () => {
    await createComponent();
    expect(mockPointage.getMonStatut).toHaveBeenCalled();
  });

  it('etat vaut absent sans statut', async () => {
    const { comp } = await createComponent();
    expect(comp.etat()).toBe('absent');
  });

  it('etat vaut present si statut.etat est present', async () => {
    mockPointage.getMonStatut.mockReturnValue(of({ etat: 'present', pointage: null }));
    const { comp } = await createComponent();
    expect(comp.etat()).toBe('present');
  });

  it('isAdmin délègue à AuthService.isAdmin', async () => {
    mockAuth.isAdmin.mockReturnValue(true);
    const { comp } = await createComponent();
    expect(comp.isAdmin()).toBe(true);
  });

  describe('minToStr', () => {
    it('convertit 0 min en 0h00', async () => {
      const { comp } = await createComponent();
      expect(comp.minToStr(0)).toBe('0h00');
    });

    it('convertit 90 min en 1h30', async () => {
      const { comp } = await createComponent();
      expect(comp.minToStr(90)).toBe('1h30');
    });

    it('convertit 65 min en 1h05', async () => {
      const { comp } = await createComponent();
      expect(comp.minToStr(65)).toBe('1h05');
    });
  });
});
