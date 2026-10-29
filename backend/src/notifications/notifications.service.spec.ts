import { NotificationsService } from './notifications.service';

describe('NotificationsService — lecture depuis la cloche', () => {
  const repo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
  const service = new NotificationsService(repo as any);

  beforeEach(() => repo.update.mockClear());

  it('markRead ne touche que la notification de l\'utilisateur connecté', async () => {
    await service.markRead(42, 7);
    expect(repo.update).toHaveBeenCalledWith({ id: 42, userId: 7 }, { read: true });
  });

  it('markAllRead marque lues toutes ses notifications non lues', async () => {
    await service.markAllRead(7);
    expect(repo.update).toHaveBeenCalledWith({ userId: 7, read: false }, { read: true });
  });
});
