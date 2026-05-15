import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MissionsService } from './missions.service';
import { Mission } from '../entities/mission.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/clients/:clientId/missions')
export class MissionsController {
  constructor(private service: MissionsService) {}

  @Get()
  findAll(@Param('clientId') clientId: string) {
    return this.service.findAll(+clientId);
  }

  @Post()
  create(@Param('clientId') clientId: string, @Body() dto: Partial<Mission>) {
    return this.service.create(+clientId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Mission>) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
