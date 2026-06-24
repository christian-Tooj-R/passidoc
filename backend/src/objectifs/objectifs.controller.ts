import { Controller, Get, Patch, Param, Query, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ObjectifsService } from './objectifs.service';
import { ObjectifsClient } from '../entities/objectifs-client.entity';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/objectifs')
export class ObjectifsController {
  constructor(private service: ObjectifsService) {}

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
    @Body() dto: Partial<ObjectifsClient>,
  ) {
    return this.service.upsert(clientId, exerciceId, dto);
  }
}
