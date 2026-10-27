import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { Task } from '../entities/task.entity';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { NotificationsService } from '../notifications/notifications.service';

const mockUser: Partial<User> = {
  id: 1,
  email: 'collab@afym.re',
  firstName: 'Marie',
  lastName: 'Martin',
  role: UserRole.COLLABORATEUR,
  site: UserSite.EST,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const saisieRepo = { update: jest.fn().mockResolvedValue({ affected: 0 }) };
const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([mockUser]),
  create: jest.fn().mockReturnValue(mockUser),
  save: jest.fn(async (u: any) => u),
  update: jest.fn().mockResolvedValue({}),
  manager: { getRepository: jest.fn((entity: any) => (entity === SaisieTemps ? saisieRepo : null)) },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(Task), useValue: {} },
        { provide: NotificationsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
    mockRepo.findOne.mockResolvedValue(mockUser);
  });

  describe('findAll', () => {
    it('doit retourner la liste des utilisateurs sans mot de passe', async () => {
      const result = await service.findAll();
      result.forEach((u: any) => expect(u.password).toBeUndefined());
    });
  });

  describe('create', () => {
    it('doit lever ConflictException si l\'email existe déjà', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      await expect(
        service.create({
          email: 'collab@afym.re',
          firstName: 'Test',
          lastName: 'Test',
          password: 'password123',
          role: UserRole.COLLABORATEUR,
          site: UserSite.EST,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('doit créer un utilisateur avec mot de passe hashé', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await service.create({
        email: 'nouveau@afym.re',
        firstName: 'Nouveau',
        lastName: 'User',
        password: 'password123',
        role: UserRole.COLLABORATEUR,
        site: UserSite.EST,
      });
      const savedUser = mockRepo.save.mock.calls[0][0] as any;
      expect(savedUser.password).not.toBe('password123');
    });
  });

  describe('remove', () => {
    it('doit désactiver un utilisateur sans le supprimer', async () => {
      await service.remove(1);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { isActive: false });
    });

    it('doit lever NotFoundException si l\'utilisateur est introuvable', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll — tarif de vente des collègues', () => {
    const equipe = [
      { ...mockUser, id: 1, password: 'h', prixVenteHoraire: 100 },
      { ...mockUser, id: 2, password: 'h', prixVenteHoraire: 20 },
    ];

    it("l'ADMIN voit le prix de vente horaire de tout le monde", async () => {
      mockRepo.find.mockResolvedValue(equipe);
      const res: any[] = await service.findAll({ id: 9, role: UserRole.ADMIN, tenantId: 1 } as User);
      expect(res.map(u => u.prixVenteHoraire)).toEqual([100, 20]);
      res.forEach(u => expect(u.password).toBeUndefined());
    });

    it('un collaborateur ne voit que le sien', async () => {
      mockRepo.find.mockResolvedValue(equipe);
      const res: any[] = await service.findAll({ id: 2, role: UserRole.COLLABORATEUR, tenantId: 1 } as User);
      expect(res.find(u => u.id === 1).prixVenteHoraire).toBeNull();
      expect(res.find(u => u.id === 2).prixVenteHoraire).toBe(20);
    });
  });

  describe('updatePrixVente — taux figé sur les saisies', () => {
    it('premier tarif : les saisies sans taux prennent le nouveau tarif', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, prixVenteHoraire: null });
      const res: any = await service.updatePrixVente(1, 80, 1);
      expect(saisieRepo.update).toHaveBeenCalledWith({ collaborateurId: 1, tauxHoraire: IsNull() }, { tauxHoraire: 80 });
      expect(res.prixVenteHoraire).toBe(80);
    });

    it("changement de tarif : les saisies non figées gardent l'ANCIEN tarif", async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, prixVenteHoraire: '60.00' });
      await service.updatePrixVente(1, 90, 1);
      expect(saisieRepo.update).toHaveBeenCalledWith({ collaborateurId: 1, tauxHoraire: IsNull() }, { tauxHoraire: 60 });
      expect((mockRepo.save.mock.calls[0][0] as any).prixVenteHoraire).toBe(90);
    });

    it('effacer le tarif fige les saisies au tarif qui s’appliquait', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, prixVenteHoraire: 45 });
      await service.updatePrixVente(1, null, 1);
      expect(saisieRepo.update).toHaveBeenCalledWith({ collaborateurId: 1, tauxHoraire: IsNull() }, { tauxHoraire: 45 });
      expect((mockRepo.save.mock.calls[0][0] as any).prixVenteHoraire).toBeNull();
    });

    it("ne touche aucune saisie quand il n'y a ni ancien ni nouveau tarif", async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, prixVenteHoraire: null });
      await service.updatePrixVente(1, null, 1);
      expect(saisieRepo.update).not.toHaveBeenCalled();
    });

    it('refuse un tarif négatif ou non numérique', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser });
      await expect(service.updatePrixVente(1, -5, 1)).rejects.toThrow(BadRequestException);
      await expect(service.updatePrixVente(1, NaN, 1)).rejects.toThrow(BadRequestException);
      expect(saisieRepo.update).not.toHaveBeenCalled();
    });

    it('cherche le collaborateur dans le tenant du demandeur', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.updatePrixVente(1, 50, 2)).rejects.toThrow(NotFoundException);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 1, tenantId: 2 } });
    });
  });
});
