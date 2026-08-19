import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { ClientsService } from '../../core/services/clients.service';
import { FluxMensuelService } from '../../core/services/flux-mensuel.service';
import { TasksService } from '../../core/services/tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { TenantService } from '../../core/services/tenant.service';
import { Client } from '../../core/models/client.model';

const makeClient = (id: number, nom: string, site: 'REUNION' | 'MADAGASCAR', score: number): Client =>
  ({ id, nom, site, santePassation: score } as Client);

const mockClientsService = { getAll: vi.fn().mockReturnValue(of([])) };
const mockFluxService    = { getAlertesGlobales: vi.fn().mockReturnValue(of([])) };
const mockTasksService   = { getAllGlobal: vi.fn().mockReturnValue(of([])) };
const mockAuth           = { currentUser: vi.fn().mockReturnValue({ firstName: 'Sophie' }) };
const mockTheme          = { prefs: vi.fn().mockReturnValue({ panelStyleId: 'light' }) };
const mockTenant         = {
  poleFlag1:  vi.fn().mockReturnValue('🇷🇪'),
  poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2:  vi.fn().mockReturnValue('🇲🇬'),
  poleLabel2: vi.fn().mockReturnValue('Madagascar'),
};

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: ClientsService,    useValue: mockClientsService },
      { provide: FluxMensuelService, useValue: mockFluxService },
      { provide: TasksService,      useValue: mockTasksService },
      { provide: AuthService,       useValue: mockAuth },
      { provide: ThemeService,      useValue: mockTheme },
      { provide: TenantService,     useValue: mockTenant },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(DashboardComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('DashboardComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientsService.getAll.mockReturnValue(of([]));
    mockFluxService.getAlertesGlobales.mockReturnValue(of([]));
    mockTasksService.getAllGlobal.mockReturnValue(of([]));
    mockTheme.prefs.mockReturnValue({ panelStyleId: 'light' });
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  describe('chargement données', () => {
    it('charge la liste clients au init', async () => {
      await createComponent();
      expect(mockClientsService.getAll).toHaveBeenCalled();
    });

    it('charge les alertes globales au init', async () => {
      await createComponent();
      expect(mockFluxService.getAlertesGlobales).toHaveBeenCalled();
    });

    it('charge les tâches globales au init', async () => {
      await createComponent();
      expect(mockTasksService.getAllGlobal).toHaveBeenCalled();
    });

    it('popule clients avec les données reçues', async () => {
      const clients = [makeClient(1, 'SARL Test', 'REUNION', 85)];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      expect(comp.clients).toHaveLength(1);
      expect(comp.clients[0].nom).toBe('SARL Test');
    });
  });

  describe('getInitials', () => {
    it('retourne les initiales d\'un nom simple', async () => {
      const { comp } = await createComponent();
      expect(comp.getInitials('SARL TEST')).toBe('ST');
    });

    it('retourne les initiales pour un seul mot', async () => {
      const { comp } = await createComponent();
      expect(comp.getInitials('Unimot')).toBe('U');
    });
  });

  describe('getScoreLabel', () => {
    it('score >= 80 → Transmissible', async () => {
      const { comp } = await createComponent();
      expect(comp.getScoreLabel(80)).toBe('Transmissible');
      expect(comp.getScoreLabel(95)).toBe('Transmissible');
    });

    it('score 50-79 → Partiellement renseigné', async () => {
      const { comp } = await createComponent();
      expect(comp.getScoreLabel(50)).toBe('Partiellement renseigné');
      expect(comp.getScoreLabel(75)).toBe('Partiellement renseigné');
    });

    it('score < 50 → Risque de perte', async () => {
      const { comp } = await createComponent();
      expect(comp.getScoreLabel(30)).toContain('Risque');
    });
  });

  describe('dossiersTransmissibles / dossiersPartiels / dossiersEnAlerte', () => {
    it('compte correctement les dossiers par catégorie', async () => {
      const clients = [
        makeClient(1, 'A', 'REUNION', 90),   // transmissible
        makeClient(2, 'B', 'REUNION', 65),   // partiel
        makeClient(3, 'C', 'MADAGASCAR', 30), // alerte
        makeClient(4, 'D', 'MADAGASCAR', 80), // transmissible
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      expect(comp.dossiersTransmissibles).toBe(2);
      expect(comp.dossiersPartiels).toBe(1);
      expect(comp.dossiersEnAlerte).toBe(1);
    });
  });

  describe('filterSite', () => {
    it('filtre par site REUNION', async () => {
      const clients = [
        makeClient(1, 'RE Client', 'REUNION', 80),
        makeClient(2, 'MG Client', 'MADAGASCAR', 70),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      comp.filterSite('REUNION');
      expect(comp.filteredClients).toHaveLength(1);
      expect(comp.filteredClients[0].nom).toBe('RE Client');
    });

    it('filtre par site MADAGASCAR', async () => {
      const clients = [
        makeClient(1, 'RE Client', 'REUNION', 80),
        makeClient(2, 'MG Client', 'MADAGASCAR', 70),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      comp.filterSite('MADAGASCAR');
      expect(comp.filteredClients).toHaveLength(1);
    });

    it('filtre vide montre tous les clients', async () => {
      const clients = [
        makeClient(1, 'A', 'REUNION', 80),
        makeClient(2, 'B', 'MADAGASCAR', 60),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      comp.filterSite('REUNION');
      comp.filterSite('');
      expect(comp.filteredClients).toHaveLength(2);
    });
  });

  describe('poleStats', () => {
    it('calcule correctement le score moyen par pôle', async () => {
      const clients = [
        makeClient(1, 'A', 'REUNION', 80),
        makeClient(2, 'B', 'REUNION', 60),
        makeClient(3, 'C', 'MADAGASCAR', 40),
      ];
      mockClientsService.getAll.mockReturnValue(of(clients));
      const { comp } = await createComponent();
      expect(comp.poleStats.reunion.avg).toBe(70);
      expect(comp.poleStats.reunion.total).toBe(2);
      expect(comp.poleStats.madagascar.total).toBe(1);
    });

    it('retourne 0 pour un pôle sans dossiers', async () => {
      mockClientsService.getAll.mockReturnValue(of([]));
      const { comp } = await createComponent();
      expect(comp.poleStats.reunion.avg).toBe(0);
      expect(comp.poleStats.madagascar.avg).toBe(0);
    });
  });

  describe('buildCollabStats', () => {
    it('construit les statistiques collaborateur depuis les tâches', async () => {
      const { comp } = await createComponent();
      const tasks: any[] = [
        { assignee: { firstName: 'Sophie', lastName: 'Martin' }, statut: 'TERMINEE', client: { nom: 'SARL A' } },
        { assignee: { firstName: 'Sophie', lastName: 'Martin' }, statut: 'EN_COURS', client: { nom: 'SARL A' } },
        { assignee: null, statut: 'A_FAIRE', client: null },
      ];
      comp.buildCollabStats(tasks);
      expect(comp.collabStats).toHaveLength(1);
      expect(comp.collabStats[0].name).toBe('Sophie Martin');
      expect(comp.collabStats[0].total).toBe(2);
      expect(comp.collabStats[0].terminees).toBe(1);
    });

    it('ignore les tâches sans assignee', async () => {
      const { comp } = await createComponent();
      const tasks: any[] = [
        { assignee: null, statut: 'A_FAIRE', client: null },
      ];
      comp.buildCollabStats(tasks);
      expect(comp.collabStats).toHaveLength(0);
    });

    it('calcule le taux de complétion', async () => {
      const { comp } = await createComponent();
      const tasks: any[] = [
        { assignee: { firstName: 'Jean', lastName: 'D' }, statut: 'TERMINEE', client: null },
        { assignee: { firstName: 'Jean', lastName: 'D' }, statut: 'TERMINEE', client: null },
        { assignee: { firstName: 'Jean', lastName: 'D' }, statut: 'A_FAIRE', client: null },
        { assignee: { firstName: 'Jean', lastName: 'D' }, statut: 'A_FAIRE', client: null },
      ];
      comp.buildCollabStats(tasks);
      expect(comp.collabStats[0].taux).toBe(50);
    });
  });

  describe('selectCollab', () => {
    it('met à jour selectedCollab', async () => {
      const { comp } = await createComponent();
      comp.collabStats = [{ name: 'Sophie Martin', total: 2, terminees: 1, enCours: 1, taux: 50, dossiers: [] }];
      comp.selectCollab('Sophie Martin');
      expect(comp.selectedCollab).toBe('Sophie Martin');
    });
  });

  describe('typeLabel / moisLabel', () => {
    it('typeLabel retourne le libellé humain', async () => {
      const { comp } = await createComponent();
      expect(comp.typeLabel('TVA')).toBe('TVA');
      expect(comp.typeLabel('RELEVE_BANCAIRE')).toBe('Relevé bancaire');
    });

    it('moisLabel retourne le mois correct', async () => {
      const { comp } = await createComponent();
      expect(comp.moisLabel(1)).toBe('Jan');
      expect(comp.moisLabel(12)).toBe('Déc');
      expect(comp.moisLabel(0)).toBe('');
    });
  });

  describe('alertesExpanded', () => {
    it('alertesVisible retourne les 5 premiers par défaut', async () => {
      const { comp } = await createComponent();
      comp.alertes = Array(8).fill({ statut: 'MANQUANT', client: null, type: 'TVA', mois: 1, annee: 2025 });
      expect(comp.alertesVisible).toHaveLength(5);
    });

    it('alertesVisible retourne tout si alertesExpanded=true', async () => {
      const { comp } = await createComponent();
      comp.alertes = Array(8).fill({ statut: 'MANQUANT', client: null, type: 'TVA', mois: 1, annee: 2025 });
      comp.alertesExpanded = true;
      expect(comp.alertesVisible).toHaveLength(8);
    });
  });

  describe('firstName', () => {
    it('retourne le prénom de l\'utilisateur connecté', async () => {
      const { comp } = await createComponent();
      expect(comp.firstName).toBe('Sophie');
    });
  });

  describe('metrics', () => {
    it('retourne un tableau de 5 métriques', async () => {
      const { comp } = await createComponent();
      expect(comp.metrics).toHaveLength(5);
    });
  });
});
