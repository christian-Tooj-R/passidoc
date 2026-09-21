import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SaisieTempsService } from './saisie-temps.service';
import { CreateSaisieTempsDto } from './dto/create-saisie-temps.dto';
import { UpdateSaisieTempsDto } from './dto/update-saisie-temps.dto';

@ApiTags('Saisie des temps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saisies-temps')
export class SaisieTempsController {
  constructor(private service: SaisieTempsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer une saisie de temps' })
  create(@Body() dto: CreateSaisieTempsDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get('moi')
  @ApiOperation({ summary: 'Mes saisies de temps' })
  findMoi(@Req() req: any, @Query('debut') debut?: string, @Query('fin') fin?: string) {
    return this.service.findByUser(req.user.id, debut, fin);
  }

  @Get('ratio-semaine')
  @ApiOperation({ summary: 'Ratio facturable/non-facturable de la semaine' })
  ratioSemaine(@Req() req: any, @Query('lundi') lundi: string) {
    return this.service.ratioSemaine(req.user.id, lundi);
  }

  @Get('tenant')
  @ApiOperation({ summary: 'Saisies de temps — soi-même par défaut, ou un collègue précis via collaborateurId (détail complet, y compris pour un collègue)' })
  findTenant(
    @Req() req: any,
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
    @Query('collaborateurId') collaborateurId?: string,
  ) {
    return this.service.findByTenant(
      req.user.tenantId, req.user.id, debut, fin,
      collaborateurId ? Number(collaborateurId) : undefined,
    );
  }

  @Get('planning')
  @ApiOperation({ summary: 'Planning de charge hebdomadaire' })
  getPlanning(
    @Req() req: any,
    @Query('debut') debut: string,
    @Query('fin') fin: string,
  ) {
    return this.service.getPlanning(debut, fin, req.user.tenantId);
  }

  @Post('valider-periode')
  @ApiOperation({ summary: 'Valider (verrouiller) une période de saisie' })
  validerPeriode(
    @Req() req: any,
    @Body() body: { semaine: number; annee: number; collaborateurId: number },
  ) {
    return this.service.validerPeriode(body.semaine, body.annee, body.collaborateurId, req.user);
  }

  @Get('budgets')
  @ApiOperation({ summary: 'Budgets missions par client et année' })
  getBudgets(
    @Req() req: any,
    @Query('clientId', ParseIntPipe) clientId: number,
    @Query('annee', ParseIntPipe) annee: number,
  ) {
    return this.service.findBudgets(clientId, annee, req.user.tenantId);
  }

  @Post('budgets')
  @ApiOperation({ summary: 'Créer/mettre à jour un budget mission' })
  createBudget(@Req() req: any, @Body() body: { clientId: number; missionCode: string; annee: number; heuresBudget: number }) {
    return this.service.createBudget({ ...body, tenantId: req.user.tenantId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une saisie de temps existante' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSaisieTempsDto, @Req() req: any) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une saisie de temps' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.id);
  }

  /**
   * Un non-ADMIN ne peut jamais voir les temps de quelqu'un d'autre via ces rapports —
   * on ignore tout collaborateurId fourni par le client et on force le sien. Politique
   * identique à celle déjà appliquée aux données RH sensibles (salaire, congés) :
   * ADMIN voit tout, tout le monde d'autre ne voit que soi-même.
   */
  private scopedCollaborateurId(req: any, requested?: string): number | undefined {
    if (req.user.role === UserRole.ADMIN) {
      return requested ? +requested : undefined;
    }
    return req.user.id;
  }

  @Get('rapport/jour')
  @ApiOperation({ summary: 'Rapport des temps passés par jour — soi-même par défaut, tout le monde réservé à ADMIN' })
  getRapportJour(
    @Req() req: any,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('collaborateurId') collaborateurId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.service.getRapportJour(
      req.user.tenantId, dateDebut, dateFin,
      this.scopedCollaborateurId(req, collaborateurId),
      clientId ? +clientId : undefined,
    );
  }

  @Get('rapport/semaine')
  @ApiOperation({ summary: 'Rapport des temps passés agrégé par semaine — soi-même par défaut, tout le monde réservé à ADMIN' })
  getRapportSemaine(
    @Req() req: any,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('collaborateurId') collaborateurId?: string,
  ) {
    return this.service.getRapportSemaine(
      req.user.tenantId, dateDebut, dateFin,
      this.scopedCollaborateurId(req, collaborateurId),
    );
  }

  @Get('rapport/mois')
  @ApiOperation({ summary: 'Rapport des temps passés agrégé par mois — soi-même par défaut, tout le monde réservé à ADMIN' })
  getRapportMois(
    @Req() req: any,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('collaborateurId') collaborateurId?: string,
  ) {
    return this.service.getRapportMois(
      req.user.tenantId, dateDebut, dateFin,
      this.scopedCollaborateurId(req, collaborateurId),
    );
  }

  @Get('incoherences')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Lister les incohérences pointage/saisie détectées' })
  getIncoherences(@Req() req: any) {
    return this.service.getIncoherences(req.user.tenantId);
  }
}
