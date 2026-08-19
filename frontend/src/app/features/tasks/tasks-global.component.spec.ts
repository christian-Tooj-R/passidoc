import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { TasksGlobalComponent } from './tasks-global.component';
import { TasksService } from '../../core/services/tasks.service';
import { ClientsService } from '../../core/services/clients.service';
import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';

const newNotif$ = new Subject<any>();

// Collab connecté : id = 1
const CURRENT_USER = { id: 1, firstName: 'Sophie', lastName: 'M', role: 'COLLABORATEUR' };

const mockTasks   = {
  getAll:      vi.fn().mockReturnValue(of([])),
  getAllGlobal: vi.fn().mockReturnValue(of([])),
  update:      vi.fn().mockReturnValue(of({})),
  delete:      vi.fn().mockReturnValue(of({})),
  prendreTache: vi.fn().mockReturnValue(of({})),
};
const mockClients = { getAll: vi.fn().mockReturnValue(of([])) };
const mockUsers   = { getAll: vi.fn().mockReturnValue(of([])), getAssignable: vi.fn().mockReturnValue(of([])) };
const mockAuth    = {
  currentUser:       vi.fn().mockReturnValue(CURRENT_USER),
  isAdmin:           vi.fn().mockReturnValue(false),
  hasFullVisibility: vi.fn().mockReturnValue(false),
};
const mockTenant  = {
  poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'),
  poleFlag: vi.fn(), poleLabel: vi.fn(),
};
const mockToast   = { success: vi.fn(), error: vi.fn() };
const mockConfirm = { confirm: vi.fn().mockReturnValue(of(true)) };
const mockDialog  = { open: vi.fn().mockReturnValue({ afterClosed: () => of(null) }) };
const mockNotif   = { newNotif$ };

// Helpers tâche
const makeTask = (id: number, titre: string, statut = 'A_FAIRE', assigneeId: number | null = null) => ({
  id,
  clientId: 10,
  titre,
  statut,
  priorite: 'NORMALE',
  type: 'TVA',
  client: { id: 10, nom: 'Cabinet Test' },
  assignee: assigneeId ? { id: assigneeId, firstName: 'User', lastName: String(assigneeId) } : null,
  dateEcheance: null,
  anyoneCanTake: false,
  taskId: `T${id}`,
  createdBy: null,
});

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [TasksGlobalComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: TasksService,              useValue: mockTasks },
      { provide: ClientsService,            useValue: mockClients },
      { provide: UsersService,              useValue: mockUsers },
      { provide: AuthService,               useValue: mockAuth },
      { provide: TenantService,             useValue: mockTenant },
      { provide: ToastService,              useValue: mockToast },
      { provide: ConfirmService,            useValue: mockConfirm },
      { provide: MatDialog,                 useValue: mockDialog },
      { provide: NotificationStreamService, useValue: mockNotif },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(TasksGlobalComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('TasksGlobalComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks.getAllGlobal.mockReturnValue(of([]));
    mockClients.getAll.mockReturnValue(of([]));
    mockUsers.getAssignable.mockReturnValue(of([]));
    mockAuth.currentUser.mockReturnValue(CURRENT_USER);
    mockAuth.isAdmin.mockReturnValue(false);
  });

  // ── Initialisation ─────────────────────────────────────────────────────────

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge toutes les tâches au init via getAllGlobal', async () => {
    await createComponent();
    expect(mockTasks.getAllGlobal).toHaveBeenCalled();
  });

  it('charge les clients et utilisateurs au init', async () => {
    await createComponent();
    expect(mockClients.getAll).toHaveBeenCalled();
    expect(mockUsers.getAssignable).toHaveBeenCalled();
  });

  it('tasks est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.tasks).toHaveLength(0);
  });

  it('popule tasks avec les données reçues (collab voit tout)', async () => {
    const tasks = [
      makeTask(1, 'Tâche A', 'A_FAIRE', 1),  // assignée au collab
      makeTask(2, 'Tâche B', 'A_FAIRE', 99),  // assignée à quelqu'un d'autre
      makeTask(3, 'Tâche C', 'EN_COURS', null), // non assignée
    ];
    mockTasks.getAllGlobal.mockReturnValue(of(tasks));
    const { comp } = await createComponent();
    // Le collab voit TOUTES les tâches par défaut
    expect(comp.tasks).toHaveLength(3);
    expect(comp.filteredTasks).toHaveLength(3);
  });

  // ── État initial des filtres ────────────────────────────────────────────────

  it('mesTachesOnly est false par défaut (toutes les tâches visibles)', async () => {
    const { comp } = await createComponent();
    expect(comp.mesTachesOnly).toBe(false);
  });

  it('viewMode est kanban par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.viewMode).toBe('kanban');
  });

  it('searchText est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.searchText).toBe('');
  });

  it('filterClientId est null par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.filterClientId).toBeNull();
  });

  it('filterAssigneeId est null par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.filterAssigneeId).toBeNull();
  });

  // ── Filtre "Mes tâches" (scénario collab clé) ──────────────────────────────

  describe('mesTachesOnly — filtre collab', () => {
    const tasks = () => [
      makeTask(1, 'Ma tâche 1',  'A_FAIRE', 1),   // au collab (id=1)
      makeTask(2, 'Ma tâche 2',  'EN_COURS', 1),  // au collab
      makeTask(3, 'Pas la mienne', 'A_FAIRE', 99), // à quelqu'un d'autre
      makeTask(4, 'Non assignée',  'A_FAIRE', null), // non assignée
    ];

    it('toggleMesTaches active le filtre', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of(tasks()));
      const { comp } = await createComponent();
      comp.toggleMesTaches();
      expect(comp.mesTachesOnly).toBe(true);
    });

    it('quand mesTachesOnly = true, seules les tâches du collab sont visibles', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of(tasks()));
      const { comp } = await createComponent();
      comp.toggleMesTaches();
      expect(comp.filteredTasks).toHaveLength(2);
      expect(comp.filteredTasks.every(t => t.assignee?.id === 1)).toBe(true);
    });

    it('toggleMesTaches deux fois remet à l\'état initial (toutes les tâches)', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of(tasks()));
      const { comp } = await createComponent();
      comp.toggleMesTaches();
      comp.toggleMesTaches();
      expect(comp.mesTachesOnly).toBe(false);
      expect(comp.filteredTasks).toHaveLength(4);
    });

    it('le kanban a autant de colonnes avec ou sans filtre', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of(tasks()));
      const { comp } = await createComponent();
      const colsBefore = comp.kanbanCols.length;
      comp.toggleMesTaches();
      expect(comp.kanbanCols.length).toBe(colsBefore);
    });
  });

  // ── myTaskCount ─────────────────────────────────────────────────────────────

  describe('myTaskCount', () => {
    it('compte les tâches actives assignées au collab', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        makeTask(1, 'Active',   'A_FAIRE',  1),
        makeTask(2, 'En cours', 'EN_COURS', 1),
        makeTask(3, 'Terminée', 'TERMINEE', 1), // ne doit pas compter
        makeTask(4, 'Autre collab', 'A_FAIRE', 99), // pas la mienne
      ]));
      const { comp } = await createComponent();
      expect(comp.myTaskCount).toBe(2);
    });

    it('myTaskCount = 0 si aucune tâche assignée au collab', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        makeTask(1, 'Autre', 'A_FAIRE', 99),
      ]));
      const { comp } = await createComponent();
      expect(comp.myTaskCount).toBe(0);
    });
  });

  // ── Filtre par assigné (dropdown "Assigné à") ──────────────────────────────

  describe('filterAssigneeId', () => {
    it('filtre par l\'id d\'un utilisateur spécifique', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        makeTask(1, 'Sophie', 'A_FAIRE', 1),
        makeTask(2, 'Jean',   'A_FAIRE', 2),
        makeTask(3, 'Marie',  'A_FAIRE', 2),
      ]));
      const { comp } = await createComponent();
      comp.filterAssigneeId = 2;
      comp.applyFilter();
      expect(comp.filteredTasks).toHaveLength(2);
      expect(comp.filteredTasks.every(t => t.assignee?.id === 2)).toBe(true);
    });
  });

  // ── Recherche texte (tableFilteredTasks) ──────────────────────────────────

  describe('tableFilteredTasks / searchText', () => {
    it('retourne toutes les tâches si searchText vide', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        makeTask(1, 'TVA Décembre', 'A_FAIRE', 1),
        makeTask(2, 'Paie Janvier', 'A_FAIRE', 1),
      ]));
      const { comp } = await createComponent();
      expect(comp.tableFilteredTasks).toHaveLength(2);
    });

    it('filtre par titre', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        makeTask(1, 'TVA Décembre', 'A_FAIRE', 1),
        makeTask(2, 'Paie Janvier', 'A_FAIRE', 1),
      ]));
      const { comp } = await createComponent();
      comp.searchText = 'tva';
      comp.onSearchChange();
      expect(comp.tableFilteredTasks).toHaveLength(1);
      expect(comp.tableFilteredTasks[0].titre).toBe('TVA Décembre');
    });

    it('la recherche est insensible à la casse', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([makeTask(1, 'TVA Décembre', 'A_FAIRE', 1)]));
      const { comp } = await createComponent();
      comp.searchText = 'décembre';
      comp.onSearchChange();
      expect(comp.tableFilteredTasks).toHaveLength(1);
    });

    it('retourne 0 si aucun match', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([makeTask(1, 'TVA', 'A_FAIRE', 1)]));
      const { comp } = await createComponent();
      comp.searchText = 'xxxxxxxx';
      comp.onSearchChange();
      expect(comp.tableFilteredTasks).toHaveLength(0);
    });
  });

  // ── Cumul de filtres (mesTachesOnly + type) ────────────────────────────────

  describe('cumul de filtres', () => {
    it('mesTachesOnly + filterType cumulent correctement', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        { ...makeTask(1, 'Ma TVA',  'A_FAIRE', 1),  type: 'TVA' },
        { ...makeTask(2, 'Ma Paie', 'A_FAIRE', 1),  type: 'PAIE' },
        { ...makeTask(3, 'TVA autre','A_FAIRE', 99), type: 'TVA' },
      ]));
      const { comp } = await createComponent();
      comp.mesTachesOnly = true;
      comp.filterType    = 'TVA';
      comp.applyFilter();
      expect(comp.filteredTasks).toHaveLength(1);
      expect(comp.filteredTasks[0].titre).toBe('Ma TVA');
    });
  });

  // ── Reset filtres ──────────────────────────────────────────────────────────

  describe('resetFilters', () => {
    it('remet tous les filtres à zéro et recharge la liste complète', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        makeTask(1, 'A', 'A_FAIRE', 1),
        makeTask(2, 'B', 'A_FAIRE', 99),
      ]));
      const { comp } = await createComponent();
      comp.mesTachesOnly = true; comp.applyFilter();
      expect(comp.filteredTasks).toHaveLength(1);

      comp.resetFilters();
      expect(comp.mesTachesOnly).toBe(false);
      expect(comp.filterClientId).toBeNull();
      expect(comp.filterAssigneeId).toBeNull();
      expect(comp.filterType).toBeNull();
      expect(comp.filteredTasks).toHaveLength(2);
    });
  });

  // ── Vue kanban ─────────────────────────────────────────────────────────────

  describe('kanban', () => {
    it('buildKanban répartit les tâches dans les bonnes colonnes', async () => {
      mockTasks.getAllGlobal.mockReturnValue(of([
        makeTask(1, 'A', 'A_FAIRE',  1),
        makeTask(2, 'B', 'EN_COURS', 1),
        makeTask(3, 'C', 'A_FAIRE',  1),
      ]));
      const { comp } = await createComponent();
      const aFaire  = comp.kanbanCols.find(c => c.statut === 'A_FAIRE');
      const enCours = comp.kanbanCols.find(c => c.statut === 'EN_COURS');
      expect(aFaire?.tasks).toHaveLength(2);
      expect(enCours?.tasks).toHaveLength(1);
    });
  });

  // ── Toggle vue kanban / tableau ────────────────────────────────────────────

  describe('viewMode', () => {
    it('bascule en vue liste', async () => {
      const { comp } = await createComponent();
      comp.viewMode = 'list';
      expect(comp.viewMode).toBe('list');
    });
  });

  // ── Rechargement sur notification ─────────────────────────────────────────

  it('recharge les tâches quand une notification TASK_ASSIGNED arrive', async () => {
    const { comp } = await createComponent();
    const callsBefore = mockTasks.getAllGlobal.mock.calls.length;
    newNotif$.next({ type: 'TASK_ASSIGNED' });
    expect(mockTasks.getAllGlobal.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  // ── Utilitaires ────────────────────────────────────────────────────────────

  describe('statutLabel', () => {
    it('traduit A_FAIRE en "À faire"', async () => {
      const { comp } = await createComponent();
      expect(comp.statutLabel('A_FAIRE')).toBe('À faire');
    });
    it('traduit EN_COURS en "En cours"', async () => {
      const { comp } = await createComponent();
      expect(comp.statutLabel('EN_COURS')).toBe('En cours');
    });
  });

  describe('prioriteLabel', () => {
    it('traduit HAUTE en "Haute"', async () => {
      const { comp } = await createComponent();
      expect(comp.prioriteLabel('HAUTE')).toBe('Haute');
    });
  });

  describe('isOverdue', () => {
    it('retourne false si pas de date', async () => {
      const { comp } = await createComponent();
      expect(comp.isOverdue(makeTask(1, 'A', 'A_FAIRE', 1) as any)).toBe(false);
    });

    it('retourne true si la date est passée', async () => {
      const { comp } = await createComponent();
      const t = { ...makeTask(1, 'A', 'A_FAIRE', 1), dateEcheance: '2020-01-01' } as any;
      expect(comp.isOverdue(t)).toBe(true);
    });

    it('retourne false si la tâche est terminée même si date passée', async () => {
      const { comp } = await createComponent();
      const t = { ...makeTask(1, 'A', 'TERMINEE', 1), dateEcheance: '2020-01-01' } as any;
      expect(comp.isOverdue(t)).toBe(false);
    });
  });
});
