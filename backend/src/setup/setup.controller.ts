import { Controller, Get, Post, Patch, Body, Req, Headers, ForbiddenException, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SetupService } from './setup.service';
import { SetupDto } from './setup.dto';
import { TenantConfig } from '../entities/tenant-config.entity';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(
    private setupService: SetupService,
    private config: ConfigService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Vérifie si le sous-domaine courant est configuré (public)' })
  getStatus(@Req() req: Request & { tenant?: TenantConfig | null; tenantSlug?: string }) {
    return this.setupService.getStatus(req.tenantSlug);
  }

  @Post()
  @ApiOperation({ summary: 'Configure un nouveau tenant (public)' })
  setup(@Body() dto: SetupDto) {
    return this.setupService.setup(dto);
  }

  @Patch(':slug/activate')
  @ApiOperation({ summary: 'Marque un tenant comme configuré (requiert x-reset-token)' })
  async activate(
    @Param('slug') slug: string,
    @Headers('x-reset-token') token: string,
  ) {
    const secret = this.config.get<string>('RESET_SECRET');
    if (!secret || !token || token !== secret) {
      throw new ForbiddenException('Token invalide');
    }
    return this.setupService.activate(slug);
  }

  @Get('recover')
  @ApiOperation({ summary: 'Récupère l\'email admin d\'un tenant (requiert secret)' })
  async recoverAdmin(@Query('secret') secret: string) {
    const expected = this.config.get<string>('RECOVER_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException('Secret invalide');
    return this.setupService.recoverAdmin('afym-audit-expertise');
  }

  @Post('recover')
  @ApiOperation({ summary: 'Reset le mot de passe admin d\'un tenant (requiert secret)' })
  async resetAdminPassword(
    @Query('secret') secret: string,
    @Body('newPassword') newPassword: string,
  ) {
    const expected = this.config.get<string>('RECOVER_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException('Secret invalide');
    if (!newPassword || newPassword.length < 8) throw new ForbiddenException('Mot de passe trop court (min 8 chars)');
    return this.setupService.resetAdminPassword('afym-audit-expertise', newPassword);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Vide toute la base de données (requiert x-reset-token)' })
  async reset(@Headers('x-reset-token') token: string) {
    const secret = this.config.get<string>('RESET_SECRET');
    if (!secret || !token || token !== secret) {
      throw new ForbiddenException('Token de réinitialisation invalide');
    }
    return this.setupService.resetDatabase();
  }
}
