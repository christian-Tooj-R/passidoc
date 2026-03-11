import { Controller, Post, Body, Get, UseGuards, HttpCode } from '@nestjs/common';
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
  constructor(private authService: AuthService) {}

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
