import { Controller, Get, Query, Req, Sse, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';

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
}
