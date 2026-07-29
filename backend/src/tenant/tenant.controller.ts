import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Tenant')
@Controller('tenant')
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Get('config')
  @ApiOperation({ summary: 'Récupère la configuration du cabinet (public)' })
  getConfig() {
    return this.tenantService.getConfig();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('config')
  @ApiOperation({ summary: 'Modifie la configuration du cabinet (admin)' })
  updateConfig(@Body() dto: any) {
    return this.tenantService.updateConfig(dto);
  }
}
