import { Controller, Get, Post, Patch, Body, Req, Headers, ForbiddenException, Param } from '@nestjs/common';
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
