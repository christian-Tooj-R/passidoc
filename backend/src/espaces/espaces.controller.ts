import {
  Controller, Get, Post, Delete, Patch, Param, ParseIntPipe,
  UseGuards, Body, UploadedFile, UseInterceptors, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { EspacesService } from './espaces.service';

@ApiTags('Espaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('espaces')
export class EspacesController {
  constructor(private svc: EspacesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste mes espaces avec leurs documents' })
  findAll(@CurrentUser() user: User) {
    return this.svc.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un espace' })
  create(
    @Body('nom') nom: string,
    @Body('couleur') couleur: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.create(nom, user.id, couleur ?? null);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un espace et tous ses documents' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.svc.remove(id, user.id);
  }

  @Patch(':id/couleur')
  @ApiOperation({ summary: "Changer la couleur d'un espace" })
  updateCouleur(
    @Param('id', ParseIntPipe) id: number,
    @Body('couleur') couleur: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateCouleur(id, couleur ?? null, user.id);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Documents dans un espace' })
  findDocs(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.svc.findDocs(id, user.id);
  }

  @Post(':id/documents/upload')
  @ApiOperation({ summary: 'Ajouter un document dans un espace' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'espaces', req.params['id'] as string);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const ext = path.extname(originalName);
          const base = path.basename(originalName, ext).replace(/[^a-z0-9.\-_]/gi, '_').slice(0, 60);
          cb(null, `${Date.now()}-${base}${ext}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadDoc(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.svc.addDoc(id, user.id, file);
  }

  @Delete(':id/documents/:docId')
  @ApiOperation({ summary: 'Supprimer un document' })
  removeDoc(
    @Param('id', ParseIntPipe) id: number,
    @Param('docId', ParseIntPipe) docId: number,
    @CurrentUser() user: User,
  ) {
    return this.svc.removeDoc(id, docId, user.id);
  }

  @Get(':id/documents/:docId/download')
  @ApiOperation({ summary: 'Télécharger un document' })
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Param('docId', ParseIntPipe) docId: number,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, doc } = await this.svc.getDocStream(id, docId, user.id);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.nom)}`,
    });
    return new StreamableFile(stream);
  }
}
