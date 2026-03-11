import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ObjectifsService } from './objectifs.service';
import { ObjectifsClient } from '../entities/objectifs-client.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/clients/:clientId/objectifs')
export class ObjectifsController {
  constructor(private service: ObjectifsService) {}

  @Get()
  findOne(@Param('clientId') clientId: string) {
    return this.service.findByClient(+clientId);
  }

  @Patch()
  upsert(@Param('clientId') clientId: string, @Body() dto: Partial<ObjectifsClient>) {
    return this.service.upsert(+clientId, dto);
  }
}
