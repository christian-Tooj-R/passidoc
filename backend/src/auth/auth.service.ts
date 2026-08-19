import {
  Injectable, UnauthorizedException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { User } from '../entities/user.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(TenantConfig) private tenantRepo: Repository<TenantConfig>,
    @InjectRepository(PasswordResetToken) private resetTokenRepo: Repository<PasswordResetToken>,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  async login(dto: LoginDto, tenantId?: number) {
    const where: any = { email: dto.email };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.userRepo.findOne({ where });
    if (!user || !user.isActive) throw new UnauthorizedException('Identifiants invalides');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Identifiants invalides');

    if (user.isTwoFactorEnabled) {
      return { requires2FA: true, userId: user.id };
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    return {
      access_token: this.generateToken(user),
      tenantSlug: tenant?.slug ?? null,
      user: this.sanitize(user),
    };
  }

  async verify2FA(userId: number, token: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw new BadRequestException('2FA non configuré');

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) throw new UnauthorizedException('Code 2FA invalide');
    return { access_token: this.generateToken(user), user: this.sanitize(user) };
  }

  async setup2FA(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const secret = speakeasy.generateSecret({
      name: `${this.config.get('TOTP_APP_NAME')} (${user.email})`,
    });

    await this.userRepo.update(userId, { twoFactorSecret: secret.base32 });

    const qrCode = await qrcode.toDataURL(secret.otpauth_url as string);
    return { qrCode, secret: secret.base32 };
  }

  async enable2FA(userId: number, token: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!valid) throw new BadRequestException('Code invalide');
    await this.userRepo.update(userId, { isTwoFactorEnabled: true });
    return { message: '2FA activé avec succès' };
  }

  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.sanitize(user);
  }

  async sendEmailVerification(email: string, tenantId: number, firstName: string): Promise<void> {
    await this.resetTokenRepo.delete({ email: email.toLowerCase(), tenantId });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.resetTokenRepo.save(
      this.resetTokenRepo.create({ email: email.toLowerCase(), code, tenantId, expiresAt }),
    );
    await this.mailService.sendEmailVerificationCode({ to: email, firstName, code });
  }

  async resendEmailVerification(email: string, tenantId?: number): Promise<{ message: string }> {
    const where: any = { email: email.toLowerCase(), isActive: false };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.userRepo.findOne({ where });
    if (user) {
      await this.sendEmailVerification(user.email, user.tenantId!, user.firstName);
    }
    return { message: 'Si ce compte existe et n\'est pas encore activé, un nouveau code a été envoyé.' };
  }

  async verifyEmail(email: string, code: string, tenantId?: number): Promise<{ message: string }> {
    const token = await this.resetTokenRepo.findOne({
      where: { email: email.toLowerCase(), code, used: false },
    });
    if (!token || token.expiresAt < new Date()) {
      throw new BadRequestException('Code invalide ou expiré');
    }
    if (tenantId && token.tenantId !== tenantId) {
      throw new BadRequestException('Code invalide ou expiré');
    }
    await this.userRepo.update({ email: token.email, tenantId: token.tenantId }, { isActive: true });
    await this.resetTokenRepo.update(token.id, { used: true });
    return { message: 'Compte activé. Vous pouvez maintenant vous connecter.' };
  }

  async forgotPassword(email: string, tenantId?: number): Promise<{ message: string }> {
    const where: any = { email: email.toLowerCase() };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.userRepo.findOne({ where });

    // Réponse identique que l'user existe ou non (sécurité)
    if (user) {
      await this.resetTokenRepo.delete({ email: user.email, tenantId: user.tenantId });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await this.resetTokenRepo.save(
        this.resetTokenRepo.create({ email: user.email, code, tenantId: user.tenantId, expiresAt }),
      );

      await this.mailService.sendPasswordResetCode({
        to: user.email,
        firstName: user.firstName,
        code,
      });
    }

    return { message: 'Si cet email existe, un code vous a été envoyé.' };
  }

  async resetPassword(email: string, code: string, newPassword: string, tenantId?: number): Promise<{ message: string }> {
    const token = await this.resetTokenRepo.findOne({
      where: { email: email.toLowerCase(), code, used: false },
    });

    if (!token || token.expiresAt < new Date()) {
      throw new BadRequestException('Code invalide ou expiré');
    }
    if (tenantId && token.tenantId !== tenantId) {
      throw new BadRequestException('Code invalide ou expiré');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update({ email: token.email, tenantId: token.tenantId }, { password: hashed });
    await this.resetTokenRepo.update(token.id, { used: true });

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  private generateToken(user: User) {
    return this.jwtService.sign({ sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId });
  }

  private sanitize(user: User) {
    const { password, twoFactorSecret, ...safe } = user;
    return safe;
  }
}
