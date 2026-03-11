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
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Identifiants invalides');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Identifiants invalides');

    if (user.isTwoFactorEnabled) {
      return { requires2FA: true, userId: user.id };
    }

    return { access_token: this.generateToken(user), user: this.sanitize(user) };
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

  private generateToken(user: User) {
    return this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  }

  private sanitize(user: User) {
    const { password, twoFactorSecret, ...safe } = user;
    return safe;
  }
}
