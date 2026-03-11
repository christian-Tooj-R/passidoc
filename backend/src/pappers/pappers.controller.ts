import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PappersService } from './pappers.service';

@ApiTags('Pappers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pappers')
export class PappersController {
  constructor(private service: PappersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Rechercher une entreprise par nom ou SIREN' })
  search(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return [];
    return this.service.search(q.trim());
  }
}
