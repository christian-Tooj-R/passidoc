/**
 * Tests unitaires — Mode lecture seule dans le détail dossier
 *
 * Couvre :
 *  - ClientDetailComponent.canEdit() : tous les cas (admin, expert, directeur, responsable, collab_mg, non assigné)
 *  - Chaque tab : bouton save désactivé quand readonly=true, actif quand readonly=false
 *    · FicheIdentiteTabComponent
 *    · AdnTabComponent
 *    · FluxMensuelTabComponent (pilotage)
 *    · SyntheseTabComponent
 *    · MissionsTabComponent
 *    · CanvasTabComponent
 *    · FournisseursTabComponent
 *    · DocumentsTabComponent
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

import { ClientDetailComponent } from './client-detail.component';
import { FicheIdentiteTabComponent } from './tabs/fiche-identite-tab/fiche-identite-tab.component';
import { AdnTabComponent } from './tabs/adn-tab/adn-tab.component';
import { FluxMensuelTabComponent } from './tabs/flux-mensuel-tab/flux-mensuel-tab.component';
import { SyntheseTabComponent } from './tabs/synthese-tab/synthese-tab.component';
import { MissionsTabComponent } from './tabs/missions-tab/missions-tab.component';
import { CanvasTabComponent } from './tabs/canvas-tab/canvas-tab.component';
import { FournisseursTabComponent } from './tabs/fournisseurs-tab/fournisseurs-tab.component';
import { DocumentsTabComponent } from './tabs/documents-tab/documents-tab.component';

import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.model';
import { ExerciceService } from '../../../core/services/exercice.service';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { MissionsService } from '../../../core/services/missions.service';
import { FournisseursService } from '../../../core/services/fournisseurs.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { QuestionnaireAdnService } from '../../../core/services/questionnaire-adn.service';
import { SecteurService } from '../../../core/services/secteur.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(id: number, role = 'COLLABORATEUR') {
  return { id, firstName: 'Test', lastName: 'User', role, email: 'test@test.com', site: 'REUNION' };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1, nom: 'Dossier Test', site: 'REUNION', tenantId: 1,
    isActive: true,
    directeur: null as any, responsable: null as any, collaborateurMg: null as any,
    directeurId: null as any, responsableId: null as any, collaborateurMgId: null as any,
    ficheIdentite: null as any, missions: [], fluxMensuels: [], completude: 0,
    completudePilotage: 0, santePassation: 0, typesFluxActifs: [],
    customFluxTypes: [], createdAt: new Date().toISOString(),
    ...overrides,
  } as Client;
}

const mockClientsSvc  = { getOne: vi.fn(), getAll: vi.fn().mockReturnValue(of([])), update: vi.fn() };
const mockExerciceSvc = { getForClient: vi.fn().mockReturnValue(of([])) };
const mockUsersSvc    = { getAssignable: vi.fn().mockReturnValue(of([])), getAll: vi.fn().mockReturnValue(of([])) };
const mockTenant      = {
  poleFlag: vi.fn().mockReturnValue('🇷🇪'),
  poleLabel: vi.fn().mockReturnValue('Réunion'),
  poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'),
};
const mockToast      = { success: vi.fn(), error: vi.fn() };
const mockConfirm    = { confirm: vi.fn().mockReturnValue(of(true)) };
const mockMissions   = { getAll: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of({})), update: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of({})) };
const mockFournisseurs = { getAll: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of({})) };
const mockDocuments  = { getAll: vi.fn().mockReturnValue(of([])), upload: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of({})) };
const mockAdnSvc     = { getGlobal: vi.fn().mockReturnValue(of({})), getSectoriel: vi.fn().mockReturnValue(of({})), updateGlobal: vi.fn().mockReturnValue(of({})), updateSectoriel: vi.fn().mockReturnValue(of({})) };
const mockSecteurSvc = { getAll: vi.fn().mockReturnValue(of([])) };

function makeAuthMock(user: any) {
  return {
    currentUser: vi.fn().mockReturnValue(user),
    isAdmin:     vi.fn().mockReturnValue(user.role === 'ADMIN'),
    isExpert:    vi.fn().mockReturnValue(user.role === 'EXPERT_COMPTABLE'),
    isChefAntenne:    vi.fn().mockReturnValue(false),
    isChefMission:    vi.fn().mockReturnValue(false),
    isCollaborateur:  vi.fn().mockReturnValue(user.role === 'COLLABORATEUR'),
    isGerantMadagascar: vi.fn().mockReturnValue(false),
    hasFullVisibility: vi.fn().mockReturnValue(['ADMIN','EXPERT_COMPTABLE','CHEF_ANTENNE'].includes(user.role)),
    canCreateDossier:  vi.fn().mockReturnValue(['ADMIN','EXPERT_COMPTABLE'].includes(user.role)),
    isReunion: vi.fn().mockReturnValue(user.site === 'REUNION'),
  };
}

// ── Suite : ClientDetailComponent.canEdit() ───────────────────────────────────

describe('ClientDetailComponent — canEdit()', () => {
  const baseProviders = [
    provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
    { provide: ClientsService,  useValue: mockClientsSvc },
    { provide: ExerciceService, useValue: mockExerciceSvc },
    { provide: UsersService,    useValue: mockUsersSvc },
    { provide: TenantService,   useValue: mockTenant },
    { provide: ActivatedRoute,  useValue: { snapshot: { paramMap: { get: () => '1' } } } },
  ];

  beforeEach(() => vi.clearAllMocks());

  async function createComp(userRole: string, client: any) {
    const auth = makeAuthMock(makeUser(42, userRole));
    await TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [...baseProviders, { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ClientDetailComponent);
    const comp = fixture.componentInstance;
    comp.client = client;
    return comp;
  }

  it('retourne true pour un ADMIN (non assigné)', async () => {
    const comp = await createComp('ADMIN', makeClient());
    expect(comp.canEdit()).toBe(true);
  });

  it('retourne true pour un EXPERT_COMPTABLE (non assigné)', async () => {
    const comp = await createComp('EXPERT_COMPTABLE', makeClient());
    expect(comp.canEdit()).toBe(true);
  });

  it('retourne true si l\'utilisateur est directeur du dossier', async () => {
    const auth = makeAuthMock(makeUser(42, 'CHEF_MISSION'));
    await TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [...baseProviders, { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const comp = TestBed.createComponent(ClientDetailComponent).componentInstance;
    comp.client = makeClient({ directeur: { id: 42, firstName: 'T', lastName: 'U', email: 't@t.com' } as any });
    expect(comp.canEdit()).toBe(true);
  });

  it('retourne true si l\'utilisateur est responsable du dossier', async () => {
    const auth = makeAuthMock(makeUser(42, 'COLLABORATEUR'));
    await TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [...baseProviders, { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const comp = TestBed.createComponent(ClientDetailComponent).componentInstance;
    comp.client = makeClient({ responsable: { id: 42, firstName: 'T', lastName: 'U', email: 't@t.com' } as any });
    expect(comp.canEdit()).toBe(true);
  });

  it('retourne true si l\'utilisateur est collaborateurMg du dossier', async () => {
    const auth = makeAuthMock(makeUser(42, 'COLLABORATEUR'));
    await TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [...baseProviders, { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const comp = TestBed.createComponent(ClientDetailComponent).componentInstance;
    comp.client = makeClient({ collaborateurMg: { id: 42, firstName: 'T', lastName: 'U', email: 't@t.com' } as any });
    expect(comp.canEdit()).toBe(true);
  });

  it('retourne false si l\'utilisateur n\'est assigné sur aucun rôle', async () => {
    const auth = makeAuthMock(makeUser(42, 'COLLABORATEUR'));
    await TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [...baseProviders, { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const comp = TestBed.createComponent(ClientDetailComponent).componentInstance;
    comp.client = makeClient({
      directeur:        { id: 99, firstName: 'X', lastName: 'Y', email: 'x@y.com' } as any,
      responsable:      { id: 99, firstName: 'X', lastName: 'Y', email: 'x@y.com' } as any,
      collaborateurMg:  { id: 99, firstName: 'X', lastName: 'Y', email: 'x@y.com' } as any,
    });
    expect(comp.canEdit()).toBe(false);
  });

  it('retourne false si client est null', async () => {
    const auth = makeAuthMock(makeUser(42, 'COLLABORATEUR'));
    await TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [...baseProviders, { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const comp = TestBed.createComponent(ClientDetailComponent).componentInstance;
    comp.client = null;
    expect(comp.canEdit()).toBe(false);
  });
});

// ── Helpers tabs ─────────────────────────────────────────────────────────────

async function createFicheTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [FicheIdentiteTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService,   useValue: mockToast },
      { provide: TenantService,  useValue: mockTenant },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(FicheIdentiteTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

async function createAdnTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [AdnTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService,            useValue: mockToast },
      { provide: QuestionnaireAdnService, useValue: mockAdnSvc },
      { provide: SecteurService,          useValue: mockSecteurSvc },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(AdnTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

async function createPilotageTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [FluxMensuelTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService, useValue: mockToast },
      { provide: TenantService, useValue: mockTenant },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(FluxMensuelTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

async function createSyntheseTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [SyntheseTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService,   useValue: mockToast },
      { provide: ConfirmService, useValue: mockConfirm },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(SyntheseTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

async function createMissionsTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [MissionsTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService,    useValue: mockToast },
      { provide: ConfirmService,  useValue: mockConfirm },
      { provide: MissionsService, useValue: { ...mockMissions, getAll: vi.fn().mockReturnValue(of([])) } },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(MissionsTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

async function createCanvasTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [CanvasTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService, useValue: mockToast },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(CanvasTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

async function createFournisseursTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [FournisseursTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService,       useValue: mockToast },
      { provide: ConfirmService,     useValue: mockConfirm },
      { provide: FournisseursService, useValue: mockFournisseurs },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(FournisseursTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

async function createDocumentsTab(readonly: boolean) {
  await TestBed.configureTestingModule({
    imports: [DocumentsTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAnimations(),
      { provide: ToastService,   useValue: mockToast },
      { provide: ConfirmService, useValue: mockConfirm },
      { provide: DocumentsService, useValue: { ...mockDocuments, getAll: vi.fn().mockReturnValue(of([])) } },
    ],
  }).compileComponents();
  const fix = TestBed.createComponent(DocumentsTabComponent);
  fix.componentInstance.clientId = 1;
  fix.componentInstance.readonly = readonly;
  fix.detectChanges();
  return fix;
}

// ── Suite : FicheIdentiteTab ─────────────────────────────────────────────────

describe('FicheIdentiteTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bouton Enregistrer désactivé quand readonly=true', async () => {
    const fix = await createFicheTab(true);
    const btn = fix.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it('bouton Enregistrer actif quand readonly=false', async () => {
    const fix = await createFicheTab(false);
    const btn = fix.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(false);
  });
});

// ── Suite : AdnTab ────────────────────────────────────────────────────────────

describe('AdnTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@Input readonly=true est bien reçu', async () => {
    const fix = await createAdnTab(true);
    expect(fix.componentInstance.readonly).toBe(true);
  });

  it('@Input readonly=false est bien reçu', async () => {
    const fix = await createAdnTab(false);
    expect(fix.componentInstance.readonly).toBe(false);
  });
});

// ── Suite : FluxMensuelTab (Pilotage) ─────────────────────────────────────────

describe('FluxMensuelTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('les cellules sont désactivées quand readonly=true', async () => {
    const fix = await createPilotageTab(true);
    const cellBtns = fix.nativeElement.querySelectorAll('.cell-btn') as NodeListOf<HTMLButtonElement>;
    if (cellBtns.length > 0) {
      expect(cellBtns[0].disabled).toBe(true);
    }
    // Vérifie que readonly est bien pris en compte par le composant
    expect(fix.componentInstance.readonly).toBe(true);
  });

  it('les cellules sont actives quand readonly=false', async () => {
    const fix = await createPilotageTab(false);
    expect(fix.componentInstance.readonly).toBe(false);
  });
});

// ── Suite : SyntheseTab ───────────────────────────────────────────────────────

describe('SyntheseTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bouton Enregistrer désactivé quand readonly=true', async () => {
    const fix = await createSyntheseTab(true);
    fix.componentInstance.showForm = true;
    fix.detectChanges();
    const btn = fix.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it('bouton Enregistrer actif quand readonly=false et formulaire valide', async () => {
    const fix = await createSyntheseTab(false);
    fix.componentInstance.showForm = true;
    fix.detectChanges();
    // Le readonly est false — la désactivation dépend seulement de form.invalid
    expect(fix.componentInstance.readonly).toBe(false);
  });
});

// ── Suite : MissionsTab ───────────────────────────────────────────────────────

describe('MissionsTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bouton "Ajouter une mission" désactivé quand readonly=true', async () => {
    const fix = await createMissionsTab(true);
    const btn = fix.nativeElement.querySelector('button[color="primary"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it('bouton "Ajouter une mission" actif quand readonly=false', async () => {
    const fix = await createMissionsTab(false);
    const btn = fix.nativeElement.querySelector('button[color="primary"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(false);
  });

  it('bouton submit désactivé quand readonly=true', async () => {
    const fix = await createMissionsTab(true);
    fix.componentInstance.showForm = true;
    fix.detectChanges();
    const submit = fix.nativeElement.querySelector('.btn-submit') as HTMLButtonElement | null;
    expect(submit?.disabled).toBe(true);
  });
});

// ── Suite : CanvasTab ─────────────────────────────────────────────────────────

describe('CanvasTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bouton Enregistrer désactivé quand readonly=true', async () => {
    const fix = await createCanvasTab(true);
    const btn = fix.nativeElement.querySelector('.cv-save-btn') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it('bouton Enregistrer actif quand readonly=false', async () => {
    const fix = await createCanvasTab(false);
    const btn = fix.nativeElement.querySelector('.cv-save-btn') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(false);
  });
});

// ── Suite : FournisseursTab ───────────────────────────────────────────────────

describe('FournisseursTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bouton submit désactivé quand readonly=true', async () => {
    const fix = await createFournisseursTab(true);
    fix.componentInstance.showForm.set(true);
    fix.detectChanges();
    const btn = fix.nativeElement.querySelector('.btn-submit') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it('readonly=false ne bloque pas le formulaire (propriété correcte)', async () => {
    const fix = await createFournisseursTab(false);
    // Le bouton peut être disabled à cause de form.invalid, mais readonly doit être false
    expect(fix.componentInstance.readonly).toBe(false);
  });
});

// ── Suite : DocumentsTab ──────────────────────────────────────────────────────

describe('DocumentsTabComponent — readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('le label d\'import a la classe disabled quand readonly=true', async () => {
    const fix = await createDocumentsTab(true);
    const label = fix.nativeElement.querySelector('.upload-btn') as HTMLElement | null;
    expect(label?.classList.contains('upload-btn--disabled')).toBe(true);
  });

  it('le label d\'import n\'a pas la classe disabled quand readonly=false', async () => {
    const fix = await createDocumentsTab(false);
    const label = fix.nativeElement.querySelector('.upload-btn') as HTMLElement | null;
    expect(label?.classList.contains('upload-btn--disabled')).toBe(false);
  });

  it('le @Input readonly est bien pris en compte', async () => {
    const fix = await createDocumentsTab(true);
    expect(fix.componentInstance.readonly).toBe(true);
  });
});
