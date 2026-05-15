import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyseStrategiqueService } from './analyse-strategique.service';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/clients/:clientId/analyse')
export class AnalyseStrategiqueController {
  constructor(private service: AnalyseStrategiqueService) {}

  @Get()
  findOne(@Param('clientId') clientId: string) {
    return this.service.findByClient(+clientId);
  }

  @Patch()
  upsert(@Param('clientId') clientId: string, @Body() dto: Partial<AnalyseStrategique>) {
    return this.service.upsert(+clientId, dto);
  }
}
