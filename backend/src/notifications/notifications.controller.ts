import {
  Controller, Get, Patch, Delete, Param, Query,
  Req, Sse, UnauthorizedException, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private service: NotificationsService,
    private jwtService: JwtService,
  ) {}

  @Sse('stream')
  stream(@Query('token') token: string, @Req() req: any): Observable<MessageEvent> {
    if (!token) throw new UnauthorizedException();
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException();
    }
    const { subject, cleanup } = this.service.subscribe(payload.sub);
    req.on('close', cleanup);
    return subject.asObservable();
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: any) {
    return this.service.findForUser(req.user.id);
  }

  @Patch('read-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  markAllRead(@Req() req: any) {
    return this.service.markAllRead(req.user.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  dismiss(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.dismiss(id, req.user.id);
  }
}
