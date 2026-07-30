import {
  Controller, Post, Get, Delete,
  Param, Body, Req, Res, UseGuards, ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAssistantService } from './ai-assistant.service';
import { ClientsService } from '../clients/clients.service';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/ai')
export class AiAssistantController {
  constructor(
    private service: AiAssistantService,
    private clientsService: ClientsService,
  ) {}

  private async assertClientTenant(clientId: number, tenantId?: number) {
    if (!tenantId) return;
    const client = await this.clientsService.findOne(clientId);
    if (client.tenantId && client.tenantId !== tenantId) {
      throw new ForbiddenException('Accès refusé');
    }
  }

  @Get('context')
  async getContext(@Param('clientId') clientId: string, @Req() req: any) {
    await this.assertClientTenant(+clientId, req.user?.tenantId);
    return this.service.getContextSummary(+clientId);
  }

  @Get('history')
  async getHistory(@Param('clientId') clientId: string, @Req() req: any) {
    await this.assertClientTenant(+clientId, req.user?.tenantId);
    return this.service.getHistory(+clientId);
  }

  @Delete('history')
  async clearHistory(@Param('clientId') clientId: string, @Req() req: any) {
    await this.assertClientTenant(+clientId, req.user?.tenantId);
    return this.service.clearHistory(+clientId);
  }

  @Post('chat')
  async chat(
    @Param('clientId') clientId: string,
    @Body() body: { messages: { role: string; content: string }[] },
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.assertClientTenant(+clientId, req.user?.tenantId);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    await this.service.chatStream(+clientId, body.messages, req.user, res);
  }
}
