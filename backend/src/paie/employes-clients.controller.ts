import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { EmployesClientsService } from './employes-clients.service';
import { CreateEmployeClientDto, UpdateEmployeClientDto } from './dto/employe-client.dto';

@ApiTags('Paie — Employés clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('paie/employes-clients')
export class EmployesClientsController {
  constructor(private service: EmployesClientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: "Créer un employé d'un client" })
  create(@Body() dto: CreateEmployeClientDto, @Req() req: any) {
    return this.service.create(dto, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: "Lister les employés d'un client" })
  findByClient(@Query('clientId', ParseIntPipe) clientId: number, @Req() req: any) {
    return this.service.findByClient(clientId, req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un employé client' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION)
  @ApiOperation({ summary: 'Modifier un employé client' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeClientDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Supprimer un employé client' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.tenantId);
  }
}
