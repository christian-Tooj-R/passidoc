import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { SetupService } from './setup.service';
import { SetupDto } from './setup.dto';
import { TenantConfig } from '../entities/tenant-config.entity';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

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
}
