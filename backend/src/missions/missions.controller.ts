import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MissionsService } from './missions.service';
import { Mission } from '../entities/mission.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/missions')
export class MissionsController {
  constructor(private service: MissionsService) {}

  @Get()
  findAll(@Param('clientId') clientId: string) {
    return this.service.findAll(+clientId);
  }

  @Post()
  create(@Param('clientId') clientId: string, @Body() dto: Partial<Mission>, @CurrentUser() user: User) {
    return this.service.create(+clientId, dto, user);
  }

  @Patch(':id')
  update(@Param('clientId') clientId: string, @Param('id') id: string, @Body() dto: Partial<Mission>, @CurrentUser() user: User) {
    return this.service.update(+clientId, +id, dto, user);
  }

  @Delete(':id')
  remove(@Param('clientId') clientId: string, @Param('id') id: string, @CurrentUser() user: User) {
    return this.service.remove(+clientId, +id, user);
  }
}
