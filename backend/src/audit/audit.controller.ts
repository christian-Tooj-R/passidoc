import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  findByClient(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.audit.findByClient(clientId);
  }
}
