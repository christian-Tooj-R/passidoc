import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole, UserSite } from '../entities/user.entity';

const mockUser: Partial<User> = {
  id: 1,
  email: 'collab@afym.re',
  firstName: 'Marie',
  lastName: 'Martin',
  role: UserRole.COLLABORATEUR,
  site: UserSite.REUNION,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([mockUser]),
  create: jest.fn().mockReturnValue(mockUser),
  save: jest.fn().mockResolvedValue(mockUser),
  update: jest.fn().mockResolvedValue({}),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
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
          site: UserSite.REUNION,
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
        site: UserSite.REUNION,
      });
      const savedUser = mockRepo.save.mock.calls[0][0];
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
});
