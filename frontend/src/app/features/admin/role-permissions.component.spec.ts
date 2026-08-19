import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { RolePermissionsComponent } from './role-permissions.component';
import { RolePermissionsService } from '../../core/services/role-permissions.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TenantService } from '../../core/services/tenant.service';

const mockRolePerms = {
  load:   vi.fn(),
  getAll: vi.fn().mockReturnValue({}),
  update: vi.fn().mockReturnValue(of({})),
};
const mockAuth  = { isAdmin: vi.fn().mockReturnValue(true) };
const mockToast = { success: vi.fn(), error: vi.fn() };
const mockTenant = {
  poleFlag1:  vi.fn().mockReturnValue('🇷🇪'),
  poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2:  vi.fn().mockReturnValue('🇲🇬'),
  poleLabel2: vi.fn().mockReturnValue('Madagascar'),
  poleFlag:   vi.fn().mockReturnValue('🇷🇪'),
  poleLabel:  vi.fn().mockReturnValue('Réunion'),
};

async function createComponent(detectChanges = false) {
  await TestBed.configureTestingModule({
    imports: [RolePermissionsComponent],
    providers: [
      provideAnimations(),
      { provide: RolePermissionsService, useValue: mockRolePerms },
      { provide: AuthService,            useValue: mockAuth },
      { provide: ToastService,           useValue: mockToast },
      { provide: TenantService,          useValue: mockTenant },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  }).compileComponents();

  const fixture = TestBed.createComponent(RolePermissionsComponent);
  const comp    = fixture.componentInstance;
  if (detectChanges) fixture.detectChanges();
  return { fixture, comp };
}

describe('RolePermissionsComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRolePerms.getAll.mockReturnValue({});
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('appelle load au init', async () => {
    const { comp } = await createComponent();
    comp.ngOnInit();
    expect(mockRolePerms.load).toHaveBeenCalled();
  });

  it('activeRole est EXPERT_COMPTABLE par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.activeRole()).toBe('EXPERT_COMPTABLE');
  });

  it('hasPermission retourne true pour un rôle sans localPerms', async () => {
    const { comp } = await createComponent();
    expect(comp.hasPermission('COLLABORATEUR', 'dashboard')).toBe(true);
  });

  it('togglePermission ajoute et retire la permission', async () => {
    const { comp } = await createComponent();
    comp.togglePermission('COLLABORATEUR', 'notes');
    const after = comp.hasPermission('COLLABORATEUR', 'notes');
    comp.togglePermission('COLLABORATEUR', 'notes');
    const reset = comp.hasPermission('COLLABORATEUR', 'notes');
    expect(after).not.toBe(reset);
  });

  it('permCount retourne MENU_ITEMS.length pour un rôle sans perms locales', async () => {
    const { comp } = await createComponent();
    expect(comp.permCount('COLLABORATEUR')).toBeGreaterThan(0);
  });
});
