import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Créer un dossier client' })
  create(@Body() dto: CreateClientDto, @Req() req: any) {
    return this.clientsService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des dossiers clients (filtrée par responsable pour non-admin)' })
  @ApiQuery({ name: 'site', required: false, enum: ['REUNION', 'MADAGASCAR'] })
  @ApiQuery({ name: 'collaborateurId', required: false, type: Number })
  findAll(@Req() req: any, @Query('site') site?: string, @Query('collaborateurId') collaborateurId?: number) {
    return this.clientsService.findAll(req.user, site, collaborateurId ? +collaborateurId : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un dossier client' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.clientsService.findOneForUser(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE)
  @ApiOperation({ summary: 'Modifier un dossier client' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto, @Req() req: any) {
    return this.clientsService.update(id, dto, req.user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assigner un responsable Réunion à un dossier (ADMIN uniquement)' })
  assign(@Param('id', ParseIntPipe) id: number, @Body('responsableId') responsableId: number, @Req() req: any) {
    return this.clientsService.assign(id, responsableId, req.user.id);
  }

  @Patch(':id/assign-mg')
  @ApiOperation({ summary: 'Sous-assigner un collaborateur Madagascar (admin ou collaborateur Réunion)' })
  assignMg(
    @Param('id', ParseIntPipe) id: number,
    @Body('collaborateurMgId') collaborateurMgId: number | null,
    @Req() req: any,
  ) {
    return this.clientsService.assignMg(id, collaborateurMgId, req.user);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  @ApiOperation({ summary: 'Upload logo du client' })
  uploadLogo(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    return this.clientsService.uploadLogo(id, file);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Archiver un dossier client' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }
}
