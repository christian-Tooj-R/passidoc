import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { AdminComponent } from './admin.component';
import { UsersService } from '../../core/services/users.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';

const mockUsers = {
  getAll: vi.fn().mockReturnValue(of([])),
  update: vi.fn().mockReturnValue(of({})),
};
const mockTenant = {
  poleFlag1:  vi.fn().mockReturnValue('🇷🇪'),
  poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2:  vi.fn().mockReturnValue('🇲🇬'),
  poleLabel2: vi.fn().mockReturnValue('Madagascar'),
  poleFlag:   vi.fn().mockReturnValue('🇷🇪'),
  poleLabel:  vi.fn().mockReturnValue('Réunion'),
};
const mockToast = { success: vi.fn(), error: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [AdminComponent],
    providers: [
      provideAnimations(),
      { provide: UsersService,  useValue: mockUsers },
      { provide: TenantService, useValue: mockTenant },
      { provide: ToastService,  useValue: mockToast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('AdminComponent (Utilisateurs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers.getAll.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les utilisateurs au init', async () => {
    await createComponent();
    expect(mockUsers.getAll).toHaveBeenCalled();
  });

  it('users est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.users).toHaveLength(0);
  });

  it('popule users avec les données reçues', async () => {
    const data = [{ id: 1, firstName: 'Sophie', lastName: 'M', role: 'COLLABORATEUR', site: 'REUNION' }];
    mockUsers.getAll.mockReturnValue(of(data));
    const { comp } = await createComponent();
    expect(comp.users).toHaveLength(1);
  });

  describe('countRole', () => {
    it('compte les utilisateurs par rôle', async () => {
      mockUsers.getAll.mockReturnValue(of([
        { id: 1, role: 'ADMIN',          site: 'REUNION' },
        { id: 2, role: 'COLLABORATEUR',  site: 'REUNION' },
        { id: 3, role: 'COLLABORATEUR',  site: 'MADAGASCAR' },
      ]));
      const { comp } = await createComponent();
      expect(comp.countRole('ADMIN')).toBe(1);
      expect(comp.countRole('COLLABORATEUR')).toBe(2);
    });
  });

  describe('countSite', () => {
    it('compte les utilisateurs par site', async () => {
      mockUsers.getAll.mockReturnValue(of([
        { id: 1, site: 'REUNION' },
        { id: 2, site: 'REUNION' },
        { id: 3, site: 'MADAGASCAR' },
      ]));
      const { comp } = await createComponent();
      expect(comp.countSite('REUNION')).toBe(2);
      expect(comp.countSite('MADAGASCAR')).toBe(1);
    });
  });

  describe('roleLabel', () => {
    it('retourne un libellé humain pour ADMIN', async () => {
      const { comp } = await createComponent();
      expect(comp.roleLabel('ADMIN')).toBeTruthy();
    });

    it('retourne un libellé humain pour COLLABORATEUR', async () => {
      const { comp } = await createComponent();
      expect(comp.roleLabel('COLLABORATEUR')).toBeTruthy();
    });
  });
});
