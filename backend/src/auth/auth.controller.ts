import { Controller, Post, Body, Get, UseGuards, HttpCode, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // Endpoint de bootstrap — créé le premier admin si aucun user n'existe
  @Post('seed')
  @HttpCode(201)
  async seed() {
    const hash = await bcrypt.hash('admin', 10);
    const existing = await this.userRepo.findOne({ where: { email: 'admin@passidoc.com' } });
    if (existing) {
      await this.userRepo.update(existing.id, { password: hash });
      return { message: 'Mot de passe réinitialisé : admin@passidoc.com / admin' };
    }
    const user = this.userRepo.create({
      firstName: 'Admin', lastName: 'Passidoc', email: 'admin@passidoc.com',
      password: hash, role: 'ADMIN' as any, site: 'REUNION' as any, isActive: true,
    });
    await this.userRepo.save(user);
    return { message: 'Admin créé : admin@passidoc.com / admin' };
  }

  // Reset one-time : aro@afym.eu → rakotomamonjy
  @Post('reset-aro')
  @HttpCode(200)
  async resetAro() {
    const user = await this.userRepo.findOne({ where: { email: 'aro@afym.eu' } });
    if (!user) return { message: 'Utilisateur aro@afym.eu introuvable' };
    const hash = await bcrypt.hash('rakotomamonjy', 10);
    await this.userRepo.update(user.id, { password: hash });
    return { message: 'Mot de passe réinitialisé : aro@afym.eu / rakotomamonjy' };
  }

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Créer un compte (auto-inscription)' })
  async register(@Body() dto: {
    firstName: string; lastName: string;
    email: string; password: string; site: string;
  }) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Cet email est déjà utilisé');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      firstName: dto.firstName, lastName: dto.lastName,
      email: dto.email, password: hashed,
      site: dto.site as any, role: 'COLLABORATEUR' as any, isActive: true,
    });
    const saved = await this.userRepo.save(user);
    const { password, twoFactorSecret, ...safe } = saved as any;
    return safe;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 tentatives / minute
  @ApiOperation({ summary: 'Connexion utilisateur' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 tentatives / minute
  @ApiOperation({ summary: 'Vérification code 2FA après login' })
  verify2fa(@Body() dto: Verify2faDto & { userId: number }) {
    return this.authService.verify2FA(dto.userId, dto.token);
  }

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir le QR code pour configurer le 2FA' })
  setup2fa(@CurrentUser() user: User) {
    return this.authService.setup2FA(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activer le 2FA après scan du QR code' })
  enable2fa(@CurrentUser() user: User, @Body() dto: Verify2faDto) {
    return this.authService.enable2FA(user.id, dto.token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté' })
  me(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }
}
