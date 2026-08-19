import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, Subject } from 'rxjs';
import { EquipesComponent } from './equipes.component';
import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';

const newNotif$ = new Subject<any>();

const mockUsers = {
  getAll:         vi.fn().mockReturnValue(of([])),
  getTaskCounts:  vi.fn().mockReturnValue(of([])),
  create:         vi.fn().mockReturnValue(of({})),
  update:         vi.fn().mockReturnValue(of({})),
  delete:         vi.fn().mockReturnValue(of({})),
};
const mockAuth = {
  isAdmin:          vi.fn().mockReturnValue(true),
  hasFullVisibility: vi.fn().mockReturnValue(true),
  currentUser:      vi.fn().mockReturnValue({ id: 1, role: 'ADMIN' }),
};
const mockTenant = {
  poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'),
};
const mockToast  = { success: vi.fn(), error: vi.fn() };
const mockNotif  = { newNotif$ };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [EquipesComponent],
    providers: [
      provideAnimations(),
      provideRouter([]),
      { provide: UsersService,              useValue: mockUsers },
      { provide: AuthService,               useValue: mockAuth },
      { provide: TenantService,             useValue: mockTenant },
      { provide: ToastService,              useValue: mockToast },
      { provide: NotificationStreamService, useValue: mockNotif },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(EquipesComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('EquipesComponent', () => {
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

  it('users() est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.users()).toHaveLength(0);
  });

  it('popule users() avec les données reçues', async () => {
    const u = { id: 1, firstName: 'Anna', lastName: 'B', role: 'COLLABORATEUR', site: 'REUNION' };
    mockUsers.getAll.mockReturnValue(of([u]));
    const { comp } = await createComponent();
    expect(comp.users()).toHaveLength(1);
  });

  it('se recharge quand une notif TEAM_ASSIGNED arrive', async () => {
    const { comp } = await createComponent();
    const calls = mockUsers.getAll.mock.calls.length;
    newNotif$.next({ type: 'TEAM_ASSIGNED' });
    expect(mockUsers.getAll.mock.calls.length).toBeGreaterThan(calls);
  });
});
