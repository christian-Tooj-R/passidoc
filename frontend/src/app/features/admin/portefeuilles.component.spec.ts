import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { PortefeuillesComponent } from './portefeuilles.component';
import { UsersService } from '../../core/services/users.service';
import { ClientsService } from '../../core/services/clients.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';

const mockUsers   = { getAll: vi.fn().mockReturnValue(of([])), getAssignable: vi.fn().mockReturnValue(of([])) };
const mockClients = { getAll:     vi.fn().mockReturnValue(of([])), update: vi.fn().mockReturnValue(of({})) };
const mockAuth    = { currentUser: vi.fn().mockReturnValue({ id: 1, role: 'ADMIN' }), isAdmin: vi.fn().mockReturnValue(true), hasFullVisibility: vi.fn().mockReturnValue(true) };
const mockTenant  = {
  poleFlag1:  vi.fn().mockReturnValue('🇷🇪'),
  poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2:  vi.fn().mockReturnValue('🇲🇬'),
  poleLabel2: vi.fn().mockReturnValue('Madagascar'),
};
const mockToast   = { success: vi.fn(), error: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [PortefeuillesComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: UsersService,   useValue: mockUsers },
      { provide: ClientsService, useValue: mockClients },
      { provide: AuthService,    useValue: mockAuth },
      { provide: TenantService,  useValue: mockTenant },
      { provide: ToastService,   useValue: mockToast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PortefeuillesComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('PortefeuillesComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge les utilisateurs au init', async () => {
    await createComponent();
    expect(mockUsers.getAssignable).toHaveBeenCalled();
  });

  it('charge les clients au init', async () => {
    await createComponent();
    expect(mockClients.getAll).toHaveBeenCalled();
  });
});
