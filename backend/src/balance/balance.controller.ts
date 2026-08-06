import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Req, UseGuards,
  ParseIntPipe, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BalanceService } from './balance.service';

@ApiTags('Balance Comptable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/balance')
export class BalanceController {
  constructor(private svc: BalanceService) {}

  @Get()
  @ApiOperation({ summary: 'Balance mensuelle (attendu vs reçu) pour une année' })
  @ApiQuery({ name: 'annee', required: true, type: Number })
  getBalance(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.svc.getByAnnee(clientId, annee, req.user?.tenantId);
  }

  @Post('import-fec')
  @ApiOperation({ summary: 'Importer un fichier FEC pour extraire les pièces attendues' })
  @ApiQuery({ name: 'annee', required: true, type: Number })
  @UseInterceptors(FileInterceptor('fec', {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 Mo max
    fileFilter: (_req, file, cb) => {
      const ok = /\.(txt|csv|fec)$/i.test(file.originalname);
      cb(ok ? null : new BadRequestException('Format accepté : .txt, .csv, .fec'), ok);
    },
  }))
  importFec(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('annee', ParseIntPipe) annee: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Fichier FEC requis');
    return this.svc.importFec(clientId, annee, file.buffer, req.user?.tenantId);
  }

  @Patch(':mois')
  @ApiOperation({ summary: 'Mettre à jour le nombre de pièces reçues pour un mois' })
  updateRecu(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('mois', ParseIntPipe) mois: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Body() body: { nbFournisseursRecu?: number; nbClientsRecu?: number },
    @Req() req: any,
  ) {
    return this.svc.updateRecu(clientId, annee, mois, body, req.user?.tenantId);
  }

  @Delete()
  @ApiOperation({ summary: 'Supprimer les données FEC d\'une année (tests E2E)' })
  @ApiQuery({ name: 'annee', required: true, type: Number })
  resetBalance(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    return this.svc.resetBalance(clientId, annee, req.user?.tenantId);
  }

  @Post('analyse')
  @ApiOperation({ summary: 'Analyser les écarts avec l\'IA' })
  @ApiQuery({ name: 'annee', required: true, type: Number })
  async analyser(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('annee', ParseIntPipe) annee: number,
    @Req() req: any,
  ) {
    const analyse = await this.svc.analyserAvecIA(clientId, annee, req.user?.tenantId);
    return { analyse };
  }
}
