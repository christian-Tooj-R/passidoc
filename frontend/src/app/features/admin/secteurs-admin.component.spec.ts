import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { SecteursAdminComponent } from './secteurs-admin.component';
import { SecteurService } from '../../core/services/secteur.service';
import { ToastService } from '../../core/services/toast.service';

const mockSecteur = {
  getAll:  vi.fn().mockReturnValue(of([])),
  create:  vi.fn().mockReturnValue(of({})),
  update:  vi.fn().mockReturnValue(of({})),
  delete:  vi.fn().mockReturnValue(of({})),
};
const mockToast = { success: vi.fn(), error: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [SecteursAdminComponent],
    providers: [
      provideAnimations(),
      { provide: SecteurService, useValue: mockSecteur },
      { provide: ToastService,   useValue: mockToast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SecteursAdminComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('SecteursAdminComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecteur.getAll.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les secteurs au init', async () => {
    await createComponent();
    expect(mockSecteur.getAll).toHaveBeenCalled();
  });

  it('popule la liste de secteurs', async () => {
    const data = [{ id: 1, nom: 'BTP', code: 'BTP' }];
    mockSecteur.getAll.mockReturnValue(of(data));
    const { comp } = await createComponent();
    expect(comp.secteurs()).toHaveLength(1);
  });
});
