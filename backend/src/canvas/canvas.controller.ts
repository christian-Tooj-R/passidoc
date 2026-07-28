import { Controller, Get, Patch, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CanvasService } from './canvas.service';

@ApiTags('Canvas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/canvas')
export class CanvasController {
  constructor(private service: CanvasService) {}

  @Get()
  find(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.service.findOrCreate(clientId);
  }

  @Patch()
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() body: Record<string, string>,
  ) {
    return this.service.update(clientId, body);
  }
}
