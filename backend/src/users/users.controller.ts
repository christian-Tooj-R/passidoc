import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Req, HttpCode, Query, ForbiddenException } from '@nestjs/common';
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
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, req.tenant?.id);
  }

  @Get()
  @ApiOperation({ summary: 'Liste les utilisateurs du tenant (tous rôles)' })
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user);
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
  @ApiQuery({ name: 'site', required: false, enum: ['EST', 'OUEST'] })
  async findSalaries(@Req() req: any, @Query('site') site?: string) {
    const list = await this.usersService.findSalaries(site, req.user?.tenantId);
    return list.map((u: any) => this.scopePaieFields(u, req.user));
  }

  @Get('salaries/:id')
  @ApiOperation({ summary: 'Détail d\'un collaborateur (vue RH)' })
  async findOneSalarie(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const u = await this.usersService.findOne(id, req.user?.tenantId);
    return this.scopePaieFields(u, req.user);
  }

  /** Masque les champs de paie (salaire, banque, IBAN) pour tout profil autre que l'ADMIN
   *  ou le collaborateur consultant sa propre fiche — évite l'exposition des salaires de
   *  toute l'équipe à un simple collaborateur consultant l'annuaire RH. */
  private scopePaieFields(u: any, requester: any) {
    const canSeePaie = requester?.role === UserRole.ADMIN || requester?.id === u.id;
    if (canSeePaie) return u;
    return { ...u, salaireBase: null, modePaiement: null, banque: null, iban: null };
  }

  @Patch(':id/rh')
  @ApiOperation({ summary: 'Mettre à jour les informations RH d\'un collaborateur' })
  updateRH(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { poste?: string; typeContrat?: string; dateEntree?: string; dateSortie?: string; telephone?: string; firstName?: string; lastName?: string; site?: string },
    @Req() req: any,
  ) {
    const role = req.user?.role;
    const isSelf = req.user?.id === id;
    const isManager = role === UserRole.ADMIN || role === UserRole.EXPERT_COMPTABLE || role === UserRole.CHEF_ANTENNE || role === UserRole.CHEF_MISSION;
    if (!isSelf && !isManager) {
      throw new ForbiddenException('Accès refusé');
    }
    return this.usersService.updateRH(id, dto, req.user?.tenantId);
  }

  @Get('task-counts')
  @Roles(UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE)
  getTaskCounts(@Req() req: any) { return this.usersService.getTaskCounts(req.user?.tenantId); }

  @Get('assignable')
  @ApiOperation({ summary: 'Utilisateurs assignables selon le rôle courant' })
  getAssignable(@Req() req: any) {
    return this.usersService.getAssignable(req.user);
  }

  @Get('my-team')
  @ApiOperation({ summary: 'Mon équipe (référent et collaborateurs supervisés)' })
  getMyTeam(@Req() req: any) {
    return this.usersService.getMyTeam(req.user);
  }

  @Get('org-chart')
  @ApiOperation({ summary: 'Organigramme complet en lecture seule (tous rôles authentifiés)' })
  getOrgChart(@Req() req: any) {
    return this.usersService.getOrgChart(req.user.tenantId);
  }

  @Patch(':id/referent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Définir le référent (autre pôle) d\'un utilisateur' })
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
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.usersService.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Désactiver un utilisateur' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usersService.remove(id, req.user.tenantId);
  }
}
