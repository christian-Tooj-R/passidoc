import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { HelpService } from './help.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('help')
@UseGuards(JwtAuthGuard)
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Post('chat')
  async chat(
    @Body() body: { messages: { role: string; content: string }[] },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    await this.helpService.chatStream(body.messages || [], res);
  }
}
