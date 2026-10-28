import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { Task, TaskStatut } from '../entities/task.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SaisieTempsService } from '../saisie-temps/saisie-temps.service';

const admin = { id: 1, tenantId: 1, role: UserRole.ADMIN, firstName: 'Ada', lastName: 'Admin', timezone: 'Indian/Reunion' } as User;
const julie = { id: 7, tenantId: 1, role: UserRole.COLLABORATEUR, firstName: 'Julie', lastName: 'R', timezone: 'Indian/Antananarivo' } as User;

const repo = { findOne: jest.fn(), update: jest.fn(), find: jest.fn().mockResolvedValue([]) };
const userRepo = { findOne: jest.fn() };
const saisies = { saisirDepuisTache: jest.fn() };

describe('TasksService — saisie automatique à la fin d’une tâche', () => {
  let service: TasksService;
  let tache: Partial<Task>;

  beforeEach(async () => {
    jest.clearAllMocks();
    tache = {
      id: 12, taskId: 'T-2026-012', titre: 'TVA septembre', type: 'TVA' as any, clientId: 4, tenantId: 1,
      statut: TaskStatut.EN_COURS, assigneeId: 7, estFacturable: true,
      tempsTotalSecondes: 600, debutEnCours: new Date(Date.now() - 30 * 60_000),
    };
    repo.findOne.mockImplementation(async () => ({ ...tache }));
    userRepo.findOne.mockResolvedValue(julie);
    saisies.saisirDepuisTache.mockResolvedValue({ creee: true, saisieId: 90, dureeHeures: 0.67, date: '2026-10-27', collaborateur: 'Julie R' });
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: NotificationsService, useValue: { emit: jest.fn() } },
        { provide: SaisieTempsService, useValue: saisies },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('saisit le temps chronométré (cumul + séance en cours) au nom de l’assigné', async () => {
    const res: any = await service.update(12, { statut: TaskStatut.TERMINEE, dateFinLocale: '2026-10-27', heureFinLocale: '16:00' }, admin);

    const [t, total, collab, fin] = saisies.saisirDepuisTache.mock.calls[0];
    expect(t).toMatchObject({ id: 12, taskId: 'T-2026-012', titre: 'TVA septembre', type: 'TVA', clientId: 4, estFacturable: true });
    expect(total).toBeGreaterThanOrEqual(600 + 1800);
    expect(total).toBeLessThan(600 + 1800 + 5);
    expect(collab).toBe(julie);
    expect(fin).toEqual({ date: '2026-10-27', heure: '16:00' });
    expect(res.saisieAuto).toMatchObject({ creee: true, saisieId: 90 });
    // Les champs « fin locale » ne sont pas des colonnes de la tâche.
    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('dateFinLocale');
    expect(repo.update.mock.calls[0][1]).toMatchObject({ statut: TaskStatut.TERMINEE, debutEnCours: null });
  });

  it('sans assigné : au nom de celui qui termine, horodatée dans son fuseau', async () => {
    tache = { ...tache, assigneeId: undefined, statut: TaskStatut.EN_PAUSE, debutEnCours: undefined };
    await service.update(12, { statut: TaskStatut.TERMINEE }, admin);
    const [, total, collab, fin] = saisies.saisirDepuisTache.mock.calls[0];
    expect(total).toBe(600);
    expect(collab).toBe(admin);
    expect(fin.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fin.heure).toMatch(/^\d{2}:\d{2}$/);
  });

  it('aucune saisie si la tâche était déjà terminée ou ne se termine pas', async () => {
    tache = { ...tache, statut: TaskStatut.TERMINEE };
    const dejaFinie: any = await service.update(12, { statut: TaskStatut.TERMINEE }, admin);
    tache = { ...tache, statut: TaskStatut.A_FAIRE };
    const autre: any = await service.update(12, { titre: 'Renommée' }, admin);
    expect(saisies.saisirDepuisTache).not.toHaveBeenCalled();
    expect(dejaFinie.saisieAuto).toBeUndefined();
    expect(autre.saisieAuto).toBeUndefined();
  });
});
