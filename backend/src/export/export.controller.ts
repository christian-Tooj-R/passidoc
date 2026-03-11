import { Controller, Get, Param, Res, UseGuards, ParseIntPipe } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients/:clientId/export')
export class ExportController {
  constructor(private service: ExportService) {}

  @Get('pdf')
  @ApiOperation({ summary: 'Générer la Note de Passation en PDF' })
  async exportPdf(@Param('clientId', ParseIntPipe) clientId: number, @Res() res: Response) {
    const buffer = await this.service.generateNotePassation(clientId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="note-passation-${clientId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
