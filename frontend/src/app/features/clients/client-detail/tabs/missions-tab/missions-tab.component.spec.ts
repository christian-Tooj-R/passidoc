import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MissionsTabComponent } from './missions-tab.component';
import { MissionsService } from '../../../../../core/services/missions.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';

const mockMissions = { getAll: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of({})), update: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of({})) };
const mockToast    = { success: vi.fn(), error: vi.fn() };
const mockConfirm  = { confirm: vi.fn().mockReturnValue(of(true)) };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [MissionsTabComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      { provide: MissionsService, useValue: mockMissions },
      { provide: ToastService,    useValue: mockToast },
      { provide: ConfirmService,  useValue: mockConfirm },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(MissionsTabComponent);
  const comp    = fixture.componentInstance;
  comp.clientId = 1;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('MissionsTabComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMissions.getAll.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les missions au init', async () => {
    await createComponent();
    expect(mockMissions.getAll).toHaveBeenCalledWith(1);
  });

  it('missions est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.missions).toHaveLength(0);
  });

  it('showForm est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.showForm).toBe(false);
  });
});
