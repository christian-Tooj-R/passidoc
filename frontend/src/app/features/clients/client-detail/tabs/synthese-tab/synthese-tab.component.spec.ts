import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { SyntheseTabComponent } from './synthese-tab.component';
import { SyntheseService } from '../../../../../core/services/synthese.service';
import { FiscalReferenceService } from '../../../../../core/services/fiscal-reference.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';

const mockSynthese   = { getAll: vi.fn().mockReturnValue(of([])), update: vi.fn().mockReturnValue(of({})) };
const mockFiscalRef  = { get: vi.fn().mockResolvedValue({
  REUNION:    { zonesExoneration: [], zonesRisque: [], taux: [] },
  MADAGASCAR: { zonesExoneration: [], zonesRisque: [], taux: [] },
}) };
const mockToast      = { success: vi.fn(), error: vi.fn() };
const mockConfirm    = { confirm: vi.fn().mockReturnValue(of(true)) };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [SyntheseTabComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      { provide: SyntheseService,       useValue: mockSynthese },
      { provide: FiscalReferenceService, useValue: mockFiscalRef },
      { provide: ToastService,          useValue: mockToast },
      { provide: ConfirmService,        useValue: mockConfirm },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SyntheseTabComponent);
  const comp    = fixture.componentInstance;
  comp.clientId = 1;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('SyntheseTabComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSynthese.getAll.mockReturnValue(of([]));
    mockFiscalRef.get.mockResolvedValue({
      REUNION:    { zonesExoneration: [], zonesRisque: [], taux: [] },
      MADAGASCAR: { zonesExoneration: [], zonesRisque: [], taux: [] },
    });
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('clientId est transmis via @Input', async () => {
    const { comp } = await createComponent();
    expect(comp.clientId).toBe(1);
  });
});
