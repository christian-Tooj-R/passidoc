import { Controller, Get, Patch, Param, Query, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControleInterneService } from './controle-interne.service';
import { ControleInterne } from '../entities/controle-interne.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/controle-interne')
export class ControleInterneController {
  constructor(private service: ControleInterneService) {}

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
    @Body() dto: Partial<ControleInterne>,
    @CurrentUser() user: User,
  ) {
    return this.service.upsert(clientId, exerciceId, dto, user);
  }
}
