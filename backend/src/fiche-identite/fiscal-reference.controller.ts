import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FISCAL_REFERENCE } from './fiscal-reference';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Fiscal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fiscal-reference')
export class FiscalReferenceController {
  @Get()
  get() {
    return FISCAL_REFERENCE;
  }
}
