import { Controller, Get, Patch, Param, Query, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyseStrategiqueService } from './analyse-strategique.service';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/analyse')
export class AnalyseStrategiqueController {
  constructor(private service: AnalyseStrategiqueService) {}

  @Get()
  findOne(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('exerciceId', ParseIntPipe) exerciceId: number,
  ) {
    return this.service.findByExercice(clientId, exerciceId);
  }

  @Patch()
  upsert(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('exerciceId', ParseIntPipe) exerciceId: number,
    @Body() dto: Partial<AnalyseStrategique>,
  ) {
    return this.service.upsert(clientId, exerciceId, dto);
  }
}
