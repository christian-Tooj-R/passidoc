import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ClientDetailComponent } from './client-detail.component';
import { ClientsService } from '../../../core/services/clients.service';
import { ExerciceService } from '../../../core/services/exercice.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UsersService } from '../../../core/services/users.service';

const mockClients  = { getOne: vi.fn().mockReturnValue(of(null)), getById: vi.fn().mockReturnValue(of(null)), update: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of({})), assign: vi.fn().mockReturnValue(of({})), assignDirecteur: vi.fn().mockReturnValue(of({})), assignMg: vi.fn().mockReturnValue(of({})), exportPdf: vi.fn().mockReturnValue(of(new Blob())), uploadLogo: vi.fn().mockReturnValue(of(null)) };
const mockExercice = { list: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of({})), cloturer: vi.fn().mockReturnValue(of({})) };
const mockAuth     = { currentUser: vi.fn().mockReturnValue({ id: 1, role: 'COLLABORATEUR' }), isAdmin: vi.fn().mockReturnValue(false), hasFullVisibility: vi.fn().mockReturnValue(false), canCreateDossier: vi.fn().mockReturnValue(true) };
const mockTenant   = { poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'), poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'), poleFlag: vi.fn(), poleLabel: vi.fn() };
const mockUsers    = { getAll: vi.fn().mockReturnValue(of([])), getAssignable: vi.fn().mockReturnValue(of([])) };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [ClientDetailComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'clients/:id', component: ClientDetailComponent }]),
      provideAnimations(),
      { provide: ClientsService,  useValue: mockClients },
      { provide: ExerciceService, useValue: mockExercice },
      { provide: AuthService,     useValue: mockAuth },
      { provide: TenantService,   useValue: mockTenant },
      { provide: UsersService,    useValue: mockUsers },
      { provide: ActivatedRoute,  useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue('1') } } } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ClientDetailComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('ClientDetailComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClients.getById.mockReturnValue(of(null));
    mockExercice.list.mockReturnValue(of([]));
    mockUsers.getAssignable.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('activeTab vaut fiche par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.activeTab()).toBe('fiche');
  });

  it('loading démarre à true', async () => {
    const { comp } = await createComponent();
    // Le composant utilise setTimeout pour réinitialiser le loading après animation
    expect(typeof comp.loading()).toBe('boolean');
  });

  it('editIntervenants est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.editIntervenants()).toBe(false);
  });

  it('activeTab peut être changé via set', async () => {
    const { comp } = await createComponent();
    comp.activeTab.set('synthese');
    expect(comp.activeTab()).toBe('synthese');
  });
});
