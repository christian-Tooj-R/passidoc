import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { PointageConfigComponent } from './pointage-config.component';
import { PointageService } from '../../core/services/pointage.service';
import { GeoLocationService } from '../../core/services/geo-location.service';
import { TenantService } from '../../core/services/tenant.service';

const mockPointage = {
  getSiteLocations: vi.fn().mockReturnValue(of([])),
  getSiteLocation:  vi.fn().mockReturnValue(of(null)),
  saveSiteLocation: vi.fn().mockReturnValue(of({})),
};
const mockGeo = { getCurrentPosition: vi.fn() };
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
    imports: [PointageConfigComponent],
    providers: [
      provideAnimations(),
      { provide: PointageService,    useValue: mockPointage },
      { provide: GeoLocationService, useValue: mockGeo },
      { provide: TenantService,      useValue: mockTenant },
      { provide: MatSnackBar,        useValue: mockSnack },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PointageConfigComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('PointageConfigComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les sites au init', async () => {
    await createComponent();
    expect(mockPointage.getSiteLocation).toHaveBeenCalled();
  });

  it('affiche les deux sites (Réunion et Madagascar)', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('REUNION');
    expect(el.textContent).toContain('MADAGASCAR');
  });
});
