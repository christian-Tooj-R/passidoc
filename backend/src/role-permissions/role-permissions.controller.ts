import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { RolePermissionsService } from './role-permissions.service';

@ApiTags('Role Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('role-permissions')
export class RolePermissionsController {
  constructor(private service: RolePermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer les permissions de tous les rôles' })
  findAll() {
    return this.service.findAll();
  }

  @Patch(':role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les permissions d\'un rôle (ADMIN)' })
  update(@Param('role') role: string, @Body('menuItems') menuItems: string[]) {
    return this.service.upsert(role, menuItems);
  }
}
