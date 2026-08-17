import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { MailService } from '../mail/mail.service';

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

const mockTenantRepo = {
  findOne: jest.fn(),
};

const mockResetTokenRepo = {
  findOne: jest.fn(),
  delete: jest.fn(),
  save:   jest.fn(),
  create: jest.fn((v: any) => v),
  update: jest.fn(),
};

const mockMailService = {
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
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
        { provide: getRepositoryToken(User),               useValue: mockRepo },
        { provide: getRepositoryToken(TenantConfig),       useValue: mockTenantRepo },
        { provide: getRepositoryToken(PasswordResetToken), useValue: mockResetTokenRepo },
        { provide: JwtService,    useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: MailService,   useValue: mockMailService },
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

  describe('forgotPassword', () => {
    it('envoie un email et crée un token si l\'utilisateur existe', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, tenantId: 1 });
      mockResetTokenRepo.delete.mockResolvedValue(undefined);
      mockResetTokenRepo.save.mockResolvedValue(undefined);

      const result = await service.forgotPassword('test@afym.re', 1);

      expect(mockResetTokenRepo.delete).toHaveBeenCalledWith({ email: 'test@afym.re', tenantId: 1 });
      expect(mockResetTokenRepo.save).toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetCode).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@afym.re', firstName: 'Jean' }),
      );
      expect(result.message).toContain('Si cet email existe');
    });

    it('répond la même chose si l\'email est inconnu (sécurité)', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('inconnu@test.com', 1);

      expect(mockResetTokenRepo.save).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetCode).not.toHaveBeenCalled();
      expect(result.message).toContain('Si cet email existe');
    });

    it('le code généré est bien à 6 chiffres', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, tenantId: 1 });
      mockResetTokenRepo.delete.mockResolvedValue(undefined);

      let capturedToken: any;
      mockResetTokenRepo.save.mockImplementation((t: any) => { capturedToken = t; });

      await service.forgotPassword('test@afym.re', 1);

      expect(capturedToken.code).toMatch(/^\d{6}$/);
    });

    it('le token expire dans 15 minutes', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, tenantId: 1 });
      mockResetTokenRepo.delete.mockResolvedValue(undefined);

      let capturedToken: any;
      mockResetTokenRepo.save.mockImplementation((t: any) => { capturedToken = t; });

      const before = new Date(Date.now() + 14 * 60 * 1000);
      await service.forgotPassword('test@afym.re', 1);
      const after = new Date(Date.now() + 16 * 60 * 1000);

      expect(capturedToken.expiresAt.getTime()).toBeGreaterThan(before.getTime());
      expect(capturedToken.expiresAt.getTime()).toBeLessThan(after.getTime());
    });
  });

  describe('resetPassword', () => {
    const validToken: Partial<PasswordResetToken> = {
      id: 42,
      email: 'test@afym.re',
      code: '123456',
      tenantId: 1,
      used: false,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // valide 10 min
    };

    it('réinitialise le mot de passe avec un code valide', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue(validToken);
      mockRepo.update.mockResolvedValue(undefined);
      mockResetTokenRepo.update.mockResolvedValue(undefined);

      const result = await service.resetPassword('test@afym.re', '123456', 'NouveauMdp123!', 1);

      expect(mockRepo.update).toHaveBeenCalled();
      expect(mockResetTokenRepo.update).toHaveBeenCalledWith(42, { used: true });
      expect(result.message).toContain('succès');
    });

    it('lève BadRequestException si le code est inconnu', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('test@afym.re', '000000', 'NouveauMdp!', 1))
        .rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le token est expiré', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue({
        ...validToken,
        expiresAt: new Date(Date.now() - 1000), // déjà expiré
      });

      await expect(service.resetPassword('test@afym.re', '123456', 'NouveauMdp!', 1))
        .rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le tenantId ne correspond pas', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue({ ...validToken, tenantId: 99 });

      await expect(service.resetPassword('test@afym.re', '123456', 'NouveauMdp!', 1))
        .rejects.toThrow(BadRequestException);
    });

    it('le nouveau mot de passe est stocké hashé', async () => {
      mockResetTokenRepo.findOne.mockResolvedValue(validToken);
      mockResetTokenRepo.update.mockResolvedValue(undefined);

      let capturedHash: string | undefined;
      mockRepo.update.mockImplementation((_where: any, data: any) => {
        capturedHash = data.password;
      });

      await service.resetPassword('test@afym.re', '123456', 'NouveauMdp123!', 1);

      expect(capturedHash).toBeDefined();
      expect(capturedHash).not.toBe('NouveauMdp123!');
      const isHashed = await bcrypt.compare('NouveauMdp123!', capturedHash!);
      expect(isHashed).toBe(true);
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
