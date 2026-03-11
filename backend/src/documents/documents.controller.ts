import {
  Controller, Get, Post, Delete, Param, UseGuards,
  ParseIntPipe, UseInterceptors, UploadedFile, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/documents')
export class DocumentsController {
  constructor(private service: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Uploader un document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  upload(
    @Param('clientId', ParseIntPipe) clientId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.service.upload(clientId, file, user);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des documents du client' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findByClient(clientId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Télécharger un document' })
  async download(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const doc = await this.service.findOne(id, clientId);
    const stream = createReadStream(doc.storagePath);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${doc.nom}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un document' })
  remove(@Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, clientId);
  }
}
