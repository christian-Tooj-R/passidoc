import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, User } from '../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantConfig } from '../entities/tenant-config.entity';

@ApiTags('Tenant')
@Controller('tenant')
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Get('config')
  @ApiOperation({ summary: 'Récupère la configuration du cabinet (public)' })
  getConfig(@Req() req: Request & { tenant?: TenantConfig | null }) {
    return this.tenantService.getConfig(req.tenant?.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('config')
  @ApiOperation({ summary: 'Modifie la configuration du cabinet (admin)' })
  updateConfig(@CurrentUser() user: User, @Body() dto: any) {
    return this.tenantService.updateConfig(user.tenantId, dto);
  }
}
