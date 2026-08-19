import { Controller, Post, Body, Get, UseGuards, HttpCode, ConflictException, ForbiddenException, Req } from '@nestjs/common';
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

  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Créer un compte (auto-inscription, tenant requis) — envoie un code de vérification par email' })
  async register(
    @Req() req: any,
    @Body() dto: { firstName: string; lastName: string; email: string; password: string; site: string; telephone?: string; poste?: string },
  ) {
    if (!req.tenant?.id) throw new ForbiddenException('Inscription impossible sans contexte tenant');
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Cet email est déjà utilisé');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      firstName: dto.firstName, lastName: dto.lastName,
      email: dto.email, password: hashed,
      site: dto.site as any, role: 'COLLABORATEUR' as any,
      isActive: false, tenantId: req.tenant.id,
      ...(dto.telephone ? { telephone: dto.telephone } : {}),
      ...(dto.poste     ? { poste:     dto.poste     } : {}),
    });
    await this.userRepo.save(user);
    await this.authService.sendEmailVerification(dto.email, req.tenant.id, dto.firstName);
    return { message: 'Code de vérification envoyé', email: dto.email };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Active le compte avec le code reçu par email' })
  verifyEmail(
    @Body() body: { email: string; code: string },
    @Req() req: any,
  ) {
    return this.authService.verifyEmail(body.email, body.code, req.tenant?.id);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Connexion utilisateur' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.tenant?.id);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
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

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Renvoie le code de vérification email pour un compte en attente' })
  resendVerification(@Body() body: { email: string }, @Req() req: any) {
    return this.authService.resendEmailVerification(body.email, req.tenant?.id);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Demande de réinitialisation de mot de passe — envoie un code par email' })
  forgotPassword(@Body() body: { email: string }, @Req() req: any) {
    return this.authService.forgotPassword(body.email, req.tenant?.id);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Réinitialise le mot de passe avec le code reçu par email' })
  resetPassword(
    @Body() body: { email: string; code: string; newPassword: string },
    @Req() req: any,
  ) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword, req.tenant?.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté' })
  me(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }
}
