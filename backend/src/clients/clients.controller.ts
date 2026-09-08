import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query, Req, Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.COLLABORATEUR)
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

  @Get(':id/fiche/photos/stream')
  @Public()
  @ApiOperation({ summary: 'Proxy de streaming pour les photos du bucket MinIO (privé)' })
  async streamPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    try {
      const decoded = decodeURIComponent(url ?? '');
      const objectName = decoded
        .replace(/.*passidoc-logos\//, '')
        .replace(/.*\/uploads\//, '');
      const { stream, mime } = await this.clientsService.streamPhoto(objectName);
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      stream.pipe(res);
    } catch {
      res.status(404).send('Photo introuvable');
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un dossier client' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.clientsService.findOneForUser(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION, UserRole.COLLABORATEUR, UserRole.GERANT_MADAGASCAR)
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

  @Patch(':id/assign-directeur')
  @ApiOperation({ summary: 'Assigner un directeur à un dossier' })
  assignDirecteur(
    @Param('id', ParseIntPipe) id: number,
    @Body('directeurId') directeurId: number | null,
    @Req() req: any,
  ) {
    return this.clientsService.assignDirecteur(id, directeurId, req.user);
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
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION, UserRole.COLLABORATEUR, UserRole.GERANT_MADAGASCAR)
  @UseInterceptors(FileInterceptor('logo', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  @ApiOperation({ summary: 'Upload logo du client' })
  uploadLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Fichier image requis (jpeg/png/webp, max 2 Mo)');
    return this.clientsService.uploadLogo(id, file, req.user);
  }

  @Post(':id/fiche/photos')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION, UserRole.COLLABORATEUR, UserRole.GERANT_MADAGASCAR)
  @UseInterceptors(FileInterceptor('photo', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  @ApiOperation({ summary: 'Upload une photo dans la galerie fiche identité' })
  uploadFichePhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Fichier image requis (jpeg/png/webp, max 5 Mo)');
    return this.clientsService.uploadFichePhoto(id, file, req.user);
  }

  @Delete(':id/fiche/photos')
  @ApiOperation({ summary: 'Supprimer une photo de la galerie fiche identité' })
  deleteFichePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Body('photoUrl') photoUrl: string,
    @Req() req: any,
  ) {
    return this.clientsService.deleteFichePhoto(id, photoUrl, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archiver un dossier client' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.clientsService.remove(id, req.user);
  }
}
