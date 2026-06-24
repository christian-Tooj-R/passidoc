import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Req, HttpCode, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur (admin)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Liste tous les utilisateurs' })
  findAll() {
    return this.usersService.findAll();
  }

  /* ── Thème de l'utilisateur connecté ──────────────────────── */

  @Get('me/theme')
  @ApiOperation({ summary: 'Récupérer les préférences d\'apparence de l\'utilisateur connecté' })
  getMyTheme(@Req() req: any) {
    return this.usersService.getTheme(req.user.id);
  }

  @Patch('me/theme')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sauvegarder les préférences d\'apparence' })
  @ApiBody({ schema: { type: 'object', description: 'ThemePrefs JSON' } })
  updateMyTheme(@Req() req: any, @Body() prefs: Record<string, any>) {
    return this.usersService.saveTheme(req.user.id, prefs);
  }

  /* ─────────────────────────────────────────────────────────── */

  @Get('salaries')
  @ApiOperation({ summary: 'Liste des collaborateurs (vue RH)' })
  @ApiQuery({ name: 'site', required: false, enum: ['REUNION', 'MADAGASCAR'] })
  findSalaries(@Query('site') site?: string) {
    return this.usersService.findSalaries(site);
  }

  @Get('salaries/:id')
  @ApiOperation({ summary: 'Détail d\'un collaborateur (vue RH)' })
  findOneSalarie(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/rh')
  @ApiOperation({ summary: 'Mettre à jour les informations RH d\'un collaborateur' })
  updateRH(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { poste?: string; typeContrat?: string; dateEntree?: string; dateSortie?: string; telephone?: string; firstName?: string; lastName?: string; site?: string },
  ) {
    return this.usersService.updateRH(id, dto);
  }

  @Get('assignable')
  @ApiOperation({ summary: 'Utilisateurs assignables selon le rôle courant' })
  getAssignable(@Req() req: any) {
    return this.usersService.getAssignable(req.user);
  }

  @Get('my-team')
  @ApiOperation({ summary: 'Mon équipe (référent ou collaborateurs MG)' })
  getMyTeam(@Req() req: any) {
    return this.usersService.getMyTeam(req.user);
  }

  @Patch(':id/referent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Définir le collaborateur Réunion d\'un utilisateur Madagascar' })
  setReferent(
    @Param('id', ParseIntPipe) id: number,
    @Body('referentId') referentId: number | null,
    @Req() req: any,
  ) {
    return this.usersService.setReferent(id, referentId, req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Détail d\'un utilisateur' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Désactiver un utilisateur' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
