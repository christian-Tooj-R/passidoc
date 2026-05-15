import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotesService } from './notes.service';

@ApiTags('Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private service: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les notes de l\'utilisateur' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une note' })
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une note' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() body: any,
  ) {
    return this.service.update(id, req.user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une note' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.id);
  }
}
