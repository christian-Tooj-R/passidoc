import {
  Controller, Get, Post, Delete,
  Param, Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DossierMessagesService } from './dossier-messages.service';

@ApiTags('Fil de discussion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/messages')
export class DossierMessagesController {
  constructor(private svc: DossierMessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer le fil de discussion du dossier' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number, @Req() req: any) {
    return this.svc.findByClient(clientId, req.user?.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Envoyer un message dans le fil' })
  create(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() body: { contenu: string },
    @Req() req: any,
  ) {
    return this.svc.create(clientId, req.user.id, body.contenu, req.user?.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer son propre message' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.svc.remove(id, req.user.id, req.user?.tenantId);
  }
}
