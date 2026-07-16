import {
  Controller, Get, Patch, Post,
  Param, Body, Res, UseGuards, Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DossierTravailService } from './dossier-travail.service';
import { TypeCycle } from '../entities/cycle-revision.entity';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/dossier-travail')
export class DossierTravailController {
  constructor(private svc: DossierTravailService) {}

  /** GET ?exerciceId=X — retourne (ou crée) le dossier de travail */
  @Get()
  get(
    @Param('clientId') clientId: string,
    @Query('exerciceId') exerciceId: string,
  ) {
    return this.svc.findOrCreate(+clientId, +exerciceId);
  }

  /** PATCH — met à jour la note de synthèse */
  @Patch('note')
  updateNote(
    @Param('clientId') clientId: string,
    @Query('exerciceId') exerciceId: string,
    @Body() body: { noteSynthese: string },
  ) {
    return this.svc.updateNoteSynthese(+clientId, +exerciceId, body.noteSynthese);
  }

  /** PATCH /cycles/:type — met à jour un cycle */
  @Patch('cycles/:type')
  updateCycle(
    @Param('clientId') clientId: string,
    @Query('exerciceId') exerciceId: string,
    @Param('type') type: TypeCycle,
    @Body() body: { pourcentageCouverture?: number; diligences?: string; conclusion?: string },
  ) {
    return this.svc.updateCycle(+clientId, +exerciceId, type, body);
  }

  /** POST /cycles/:type/ia — interroge l'IA sur un cycle */
  @Post('cycles/:type/ia')
  async cycleIa(
    @Param('clientId') clientId: string,
    @Query('exerciceId') exerciceId: string,
    @Param('type') type: TypeCycle,
    @Body() body: { question: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    await this.svc.queryCycleIa(+clientId, +exerciceId, type, body.question, res);
  }
}
