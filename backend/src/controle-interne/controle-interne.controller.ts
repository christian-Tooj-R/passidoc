import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControleInterneService } from './controle-interne.service';
import { ControleInterne } from '../entities/controle-interne.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/clients/:clientId/controle-interne')
export class ControleInterneController {
  constructor(private service: ControleInterneService) {}

  @Get()
  findOne(@Param('clientId') clientId: string) {
    return this.service.findByClient(+clientId);
  }

  @Patch()
  upsert(@Param('clientId') clientId: string, @Body() dto: Partial<ControleInterne>) {
    return this.service.upsert(+clientId, dto);
  }
}
