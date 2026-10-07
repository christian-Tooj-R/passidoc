import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { BackupService } from './backup.service';

@ApiTags('Export / Sauvegarde')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('backup')
export class BackupController {
  constructor(private service: BackupService) {}

  @Get('export-sql')
  @ApiOperation({ summary: '[Admin] Exporter toutes les données du tenant en fichier .sql' })
  async exportSql(@Req() req: any, @Res() res: Response) {
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="passidoc-export-${date}.sql"`);
    await this.service.exportSql(req.user.tenantId, res);
  }
}
