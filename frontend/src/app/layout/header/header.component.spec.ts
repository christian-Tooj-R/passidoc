/**
 * En-tête — destination d'un clic sur une notification de la cloche.
 */
import { vi, describe, it, expect } from 'vitest';
import { HeaderComponent } from './header.component';
import { TaskNotification } from '../../core/services/notification-stream.service';

function entete() {
  const router = { navigate: vi.fn() };
  const comp = new HeaderComponent(
    {} as any, { count: () => 0 } as any, { unreadCount: () => 0 } as any, {} as any, router as any, {} as any,
  );
  return { comp, router };
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

  it('icône « savings » pour les alertes de budget', () => {
    const { comp } = entete();
    expect(comp.typeIcon('BUDGET_DOSSIER_DEPASSE')).toBe('savings');
  });
});
