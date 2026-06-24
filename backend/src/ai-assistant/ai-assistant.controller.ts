import {
  Controller, Post, Get, Delete,
  Param, Body, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAssistantService } from './ai-assistant.service';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/ai')
export class AiAssistantController {
  constructor(private service: AiAssistantService) {}

  @Get('history')
  getHistory(@Param('clientId') clientId: string) {
    return this.service.getHistory(+clientId);
  }

  @Delete('history')
  clearHistory(@Param('clientId') clientId: string) {
    return this.service.clearHistory(+clientId);
  }

  @Post('chat')
  async chat(
    @Param('clientId') clientId: string,
    @Body() body: { messages: { role: string; content: string }[] },
    @Req() req: any,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    await this.service.chatStream(+clientId, body.messages, req.user, res);
  }
}
