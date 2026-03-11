import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User, UserRole, UserSite } from '../entities/user.entity';

const mockUser: User = {
  id: 1,
  email: 'test@afym.re',
  password: '',
  firstName: 'Jean',
  lastName: 'Dupont',
  role: UserRole.COLLABORATEUR,
  site: UserSite.REUNION,
  isTwoFactorEnabled: false,
  twoFactorSecret: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      TOTP_APP_NAME: 'Passidoc',
      JWT_SECRET: 'secret',
      JWT_EXPIRES_IN: '7d',
    };
    return map[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('doit retourner un token si les identifiants sont valides', async () => {
      const hashedPwd = await bcrypt.hash('password123', 10);
      mockRepo.findOne.mockResolvedValue({ ...mockUser, password: hashedPwd });

      const result = await service.login({ email: 'test@afym.re', password: 'password123' });

      expect(result.access_token).toBe('mock-token');
      expect(result.user.email).toBe('test@afym.re');
      expect(result.user.password).toBeUndefined();
    });

    it('doit lever UnauthorizedException si l\'utilisateur est inconnu', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'inconnu@test.com', password: 'pass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('doit lever UnauthorizedException si le mot de passe est incorrect', async () => {
      const hashedPwd = await bcrypt.hash('correctpass', 10);
      mockRepo.findOne.mockResolvedValue({ ...mockUser, password: hashedPwd });

      await expect(service.login({ email: 'test@afym.re', password: 'wrongpass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('doit retourner requires2FA si le 2FA est activé', async () => {
      const hashedPwd = await bcrypt.hash('password123', 10);
      mockRepo.findOne.mockResolvedValue({
        ...mockUser,
        password: hashedPwd,
        isTwoFactorEnabled: true,
      });

      const result = await service.login({ email: 'test@afym.re', password: 'password123' });

      expect(result.requires2FA).toBe(true);
      expect(result.userId).toBe(1);
      expect(result.access_token).toBeUndefined();
    });

    it('doit lever UnauthorizedException si le compte est désactivé', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login({ email: 'test@afym.re', password: 'any' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('doit retourner le profil sans mot de passe', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, password: 'hashed' });
      const result = await service.getProfile(1);
      expect(result.email).toBe('test@afym.re');
      expect((result as any).password).toBeUndefined();
    });

    it('doit lever NotFoundException si l\'utilisateur n\'existe pas', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });
});
