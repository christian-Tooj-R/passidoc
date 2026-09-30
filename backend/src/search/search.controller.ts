import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@ApiTags('Recherche globale')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private service: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Recherche globale (dossiers clients, documents)' })
  search(@Query('q') q: string, @Req() req: any) {
    return this.service.search(q ?? '', req.user);
  }
}
