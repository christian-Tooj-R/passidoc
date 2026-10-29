/**
 * En-tête — destination d'un clic sur une notification de la cloche.
 */
import { vi, describe, it, expect } from 'vitest';
import { HeaderComponent } from './header.component';
import { TaskNotification } from '../../core/services/notification-stream.service';

function entete() {
  const router = { navigate: vi.fn() };
  const notifStream = { nonVuesCount: () => 0, markRead: vi.fn(), marquerVues: vi.fn() };
  const alertes = { nonVuesCount: () => 0, marquerVues: vi.fn() };
  const comp = new HeaderComponent(
    {} as any, alertes as any, notifStream as any, {} as any, router as any, {} as any,
  );
  return { comp, router, notifStream, alertes };
}

const notif = (type: string, clientId: number | null = 12): TaskNotification =>
  ({ id: 1, type, message: '', titre: '', clientId, createdAt: new Date(), read: false } as TaskNotification);

describe('HeaderComponent — clic sur une notification', () => {
  it.each([
    ['BUDGET_DOSSIER_ATTENTION', ['/clients', 12], { queryParams: { tab: 'rentabilite' } }],
    ['BUDGET_DOSSIER_DEPASSE',   ['/clients', 12], { queryParams: { tab: 'rentabilite' } }],
    ['MISSION_RELANCE',          ['/clients', 12], { queryParams: { tab: 'missions' } }],
    ['CLIENT_ASSIGNED',          ['/clients', 12], { queryParams: {} }],
  ])('%s ouvre le bon onglet du dossier', (type, chemin, options) => {
    const { comp, router } = entete();
    comp.navigateTo(notif(type));
    expect(router.navigate).toHaveBeenCalledWith(chemin, options);
  });

  it.each(['TASK_ASSIGNED', 'TASK_DEADLINE', 'TASK_MENTIONED', 'TASK_INTER_SERVICE'])(
    '%s ouvre les tâches du module Travail (le dossier n\'a plus d\'onglet Tâches), même sans dossier', (type) => {
      const { comp, router } = entete();
      comp.navigateTo(notif(type, null));
      expect(router.navigate).toHaveBeenCalledWith(['/travail/taches']);
    });

  it('la notification ouverte est marquée lue (sur le serveur)', () => {
    const { comp, notifStream } = entete();
    comp.navigateTo(notif('CLIENT_ASSIGNED'));
    expect(notifStream.markRead).toHaveBeenCalledWith(1);
  });

  it('ouvrir la cloche vide le badge sans tout marquer comme lu ; la refermer ne fait rien', () => {
    const { comp, notifStream, alertes } = entete();
    const clic = { stopPropagation: vi.fn() } as any;
    comp.toggleBell(clic);
    expect(notifStream.marquerVues).toHaveBeenCalledTimes(1);
    expect(alertes.marquerVues).toHaveBeenCalledTimes(1);
    comp.toggleBell(clic);
    expect(notifStream.marquerVues).toHaveBeenCalledTimes(1);
  });

  it('icône « savings » pour les alertes de budget', () => {
    const { comp } = entete();
    expect(comp.typeIcon('BUDGET_DOSSIER_DEPASSE')).toBe('savings');
  });
});
