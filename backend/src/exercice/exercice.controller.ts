import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExerciceService } from './exercice.service';

@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/exercices')
export class ExerciceController {
  constructor(private svc: ExerciceService) {}

  @Get()
  list(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.svc.findByClient(clientId);
  }

  @Get('current')
  current(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.svc.findCurrent(clientId);
  }

  @Post()
  create(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() body: { dateClotureExercice: string },
  ) {
    return this.svc.createForClient(clientId, body.dateClotureExercice);
  }

  @Patch(':id/cloturer')
  cloturer(
    @Param('clientId', ParseIntPipe) _clientId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.svc.cloturer(id, req.user.id);
  }
}
