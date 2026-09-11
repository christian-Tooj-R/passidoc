import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAssistantTravailService } from './ai-assistant-travail.service';

/**
 * Assistant IA scopé à l'utilisateur connecté (module Travail — pas de
 * clientId). Voir AiAssistantTravailService pour le détail du périmètre et
 * du choix de non-persistance de l'historique.
 */
@UseGuards(JwtAuthGuard)
@Controller('me/ai')
export class AiAssistantTravailController {
  constructor(private service: AiAssistantTravailService) {}

  @Get('context')
  async getContext(@Req() req: any) {
    return this.service.getContextSummary(req.user);
  }

  @Post('chat')
  async chat(
    @Body() body: { messages: { role: string; content: string }[] },
    @Req() req: any,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    await this.service.chatStream(req.user, body.messages, res);
  }
}
