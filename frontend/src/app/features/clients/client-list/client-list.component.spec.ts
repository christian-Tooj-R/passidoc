import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientListComponent } from './client-list.component';
import { ClientsService } from '../../../core/services/clients.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { NotificationStreamService } from '../../../core/services/notification-stream.service';

const makeClient = (id: number, nom: string, site: 'REUNION' | 'MADAGASCAR', score: number) =>
  ({ id, nom, site, santePassation: score, completude: score } as any);

const newNotif$ = new Subject<any>();

const mockClientsService = {
  getAll: vi.fn().mockReturnValue(of([])),
  delete: vi.fn().mockReturnValue(of({})),
};
const mockAuth = {
  currentUser: vi.fn().mockReturnValue({ id: 1, firstName: 'Sophie' }),
  isAdmin: vi.fn().mockReturnValue(false),
  canCreateDossier: vi.fn().mockReturnValue(true),
};
const mockTenant = {
  poleFlag1:  vi.fn().mockReturnValue('🇷🇪'),
  poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2:  vi.fn().mockReturnValue('🇲🇬'),
  poleLabel2: vi.fn().mockReturnValue('Madagascar'),
};
const mockNotifStream = { newNotif$ };
const mockDialog  = { open: vi.fn().mockReturnValue({ afterClosed: () => of(null) }) };
const mockSnack   = { open: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [ClientListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: ClientsService,           useValue: mockClientsService },
      { provide: AuthService,              useValue: mockAuth },
      { provide: TenantService,            useValue: mockTenant },
      { provide: NotificationStreamService, useValue: mockNotifStream },
      { provide: MatDialog,                useValue: mockDialog },
      { provide: MatSnackBar,              useValue: mockSnack },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ClientListComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('ClientListComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientsService.getAll.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  describe('signaux initiaux', () => {
    it('sortKey est "nom" par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.sortKey()).toBe('nom');
    });

    it('sortDir est "asc" par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.sortDir()).toBe('asc');
    });

    it('viewMode est "grid" par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.viewMode()).toBe('grid');
    });

    it('healthFilter est vide par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.healthFilter()).toBe('');
    });

    it('siteFilter est vide par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.siteFilter()).toBe('');
    });

    it('mesDossiers est false par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.mesDossiers()).toBe(false);
    });
  });

  describe('chargement', () => {
    it('appelle ClientsService.getAll au init', async () => {
      await createComponent();
      expect(mockClientsService.getAll).toHaveBeenCalled();
    });

    it('popule clients avec les données reçues', async () => {
      const clients = [makeClient(1, 'SARL Test', 'REUNION', 80)];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      expect(comp.clients()).toHaveLength(1);
    });

    it('loading passe à false après chargement', async () => {
      const { comp } = await createComponent();
      expect(comp.loading()).toBe(false);
    });
  });

  describe('setSort', () => {
    it('change la clé de tri', async () => {
      const { comp } = await createComponent();
      comp.setSort('score');
      expect(comp.sortKey()).toBe('score');
    });

    it('inverse la direction si même clé', async () => {
      const { comp } = await createComponent();
      comp.setSort('nom'); // déjà 'nom' → inverse
      expect(comp.sortDir()).toBe('desc');
    });

    it('remet asc quand on change de clé', async () => {
      const { comp } = await createComponent();
      comp.setSort('nom');
      comp.setSort('score');
      expect(comp.sortDir()).toBe('asc');
    });
  });

  describe('countByHealth', () => {
    it('compte les dossiers "ok" (score >= 80)', async () => {
      const clients = [
        makeClient(1, 'A', 'REUNION', 85),
        makeClient(2, 'B', 'REUNION', 60),
        makeClient(3, 'C', 'MADAGASCAR', 30),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      expect(comp.countByHealth('ok')).toBe(1);
    });

    it('compte les dossiers "partial" (50 ≤ score < 80)', async () => {
      const clients = [
        makeClient(1, 'A', 'REUNION', 85),
        makeClient(2, 'B', 'REUNION', 60),
        makeClient(3, 'C', 'MADAGASCAR', 30),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      expect(comp.countByHealth('partial')).toBe(1);
    });

    it('compte les dossiers "alert" (score < 50)', async () => {
      const clients = [
        makeClient(1, 'A', 'REUNION', 85),
        makeClient(2, 'B', 'REUNION', 60),
        makeClient(3, 'C', 'MADAGASCAR', 30),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      expect(comp.countByHealth('alert')).toBe(1);
    });
  });

  describe('getInitials', () => {
    it('retourne les initiales d\'un nom à deux mots', async () => {
      const { comp } = await createComponent();
      expect(comp.getInitials('SARL Test')).toBe('ST');
    });

    it('retourne une initiale pour un seul mot', async () => {
      const { comp } = await createComponent();
      expect(comp.getInitials('Unimot')).toBe('U');
    });
  });

  describe('getStatusLabel', () => {
    it('score >= 80 → Complet', async () => {
      const { comp } = await createComponent();
      expect(comp.getStatusLabel(80)).toBe('Complet');
    });

    it('score 50-79 → En cours', async () => {
      const { comp } = await createComponent();
      expect(comp.getStatusLabel(65)).toBe('En cours');
    });

    it('score < 50 → Incomplet', async () => {
      const { comp } = await createComponent();
      expect(comp.getStatusLabel(30)).toBe('Incomplet');
    });
  });

  describe('toggleMesDossiers', () => {
    it('passe mesDossiers à true', async () => {
      const { comp } = await createComponent();
      comp.toggleMesDossiers();
      expect(comp.mesDossiers()).toBe(true);
    });

    it('revient à false au second appel', async () => {
      const { comp } = await createComponent();
      comp.toggleMesDossiers();
      comp.toggleMesDossiers();
      expect(comp.mesDossiers()).toBe(false);
    });
  });

  describe('activeFilterCount', () => {
    it('vaut 0 sans filtre', async () => {
      const { comp } = await createComponent();
      expect(comp.activeFilterCount()).toBe(0);
    });

    it('vaut 1 avec siteFilter actif', async () => {
      const { comp } = await createComponent();
      comp.siteFilter.set('REUNION');
      expect(comp.activeFilterCount()).toBe(1);
    });

    it('vaut 2 avec siteFilter + collabFilter', async () => {
      const { comp } = await createComponent();
      comp.siteFilter.set('REUNION');
      comp.collabFilter.set(42);
      expect(comp.activeFilterCount()).toBe(2);
    });
  });

  describe('filteredClients — filtres calculés', () => {
    it('filtre par siteFilter REUNION', async () => {
      const clients = [
        makeClient(1, 'RE Client', 'REUNION', 80),
        makeClient(2, 'MG Client', 'MADAGASCAR', 70),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      comp.siteFilter.set('REUNION');
      expect(comp.filteredClients()).toHaveLength(1);
      expect(comp.filteredClients()[0].nom).toBe('RE Client');
    });

    it('filtre par healthFilter ok', async () => {
      const clients = [
        makeClient(1, 'A', 'REUNION', 85),
        makeClient(2, 'B', 'REUNION', 40),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      comp.healthFilter.set('ok');
      expect(comp.filteredClients()).toHaveLength(1);
    });

    it('mesDossiers = true : ne montre que les clients où l\'user est responsable/directeur/collaborateurMg', async () => {
      // currentUser.id = 1 (cf. mockAuth)
      const user1  = { id: 1,  firstName: 'Sophie', lastName: 'M' };
      const user99 = { id: 99, firstName: 'Jean',   lastName: 'D' };
      const clients = [
        { ...makeClient(1, 'Mon cabinet',     'REUNION', 80), responsable: user1 },
        { ...makeClient(2, 'Pas le mien',     'REUNION', 80), responsable: user99 },
        { ...makeClient(3, 'Je suis directeur','REUNION', 80), directeur: user1 },
      ] as any[];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      comp.mesDossiers.set(true);
      const result = comp.filteredClients();
      expect(result).toHaveLength(2);
      expect(result.map((c: any) => c.nom)).toContain('Mon cabinet');
      expect(result.map((c: any) => c.nom)).toContain('Je suis directeur');
      expect(result.map((c: any) => c.nom)).not.toContain('Pas le mien');
    });
  });

  describe('resetFilters', () => {
    it('réinitialise tous les filtres', async () => {
      const { comp } = await createComponent();
      comp.siteFilter.set('REUNION');
      comp.healthFilter.set('ok');
      comp.mesDossiers.set(true);
      comp.resetFilters();
      expect(comp.siteFilter()).toBe('');
      expect(comp.healthFilter()).toBe('');
      expect(comp.mesDossiers()).toBe(false);
    });
  });
});
