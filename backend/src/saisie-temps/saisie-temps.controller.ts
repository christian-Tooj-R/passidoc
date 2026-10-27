import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SaisieTempsService } from './saisie-temps.service';
import { SaisieTempsScheduler } from './saisie-temps.scheduler';
import { CreateSaisieTempsDto } from './dto/create-saisie-temps.dto';
import { UpdateSaisieTempsDto } from './dto/update-saisie-temps.dto';
import { BudgetDossierDto } from './dto/budget-dossier.dto';
import { AffairesService } from './affaires.service';
import { RentabiliteService } from './rentabilite.service';

/** "1,2,3" → [1, 2, 3] (valeurs non numériques ignorées). */
function listeIds(v?: string): number[] | undefined {
  const ids = (v ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
  return ids.length ? ids : undefined;
}

@ApiTags('Saisie des temps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saisies-temps')
export class SaisieTempsController {
  constructor(
    private service: SaisieTempsService,
    private scheduler: SaisieTempsScheduler,
    private affaires: AffairesService,
    private rentabilite: RentabiliteService,
  ) {}

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

  @Get('rapport/detail')
  @ApiOperation({ summary: 'Détail des temps passés façon Tempolia (saisies + absences, valorisées au PV collaborateur) — soi-même, tout le monde réservé à ADMIN' })
  getRapportDetail(
    @Req() req: any,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('collaborateurIds') collaborateurIds?: string,
    @Query('clientIds') clientIds?: string,
    @Query('absences') absences?: string,
  ) {
    const collaborateurs = req.user.role === UserRole.ADMIN ? listeIds(collaborateurIds) : [req.user.id];
    return this.service.getRapportDetail(req.user.tenantId, {
      dateDebut, dateFin,
      collaborateurIds: collaborateurs,
      clientIds: listeIds(clientIds),
      inclureAbsences: absences !== 'false',
    });
  }

  @Get('affaires')
  @ApiOperation({ summary: "Affaires (exercices) proposées pour un dossier — sélecteur de la saisie" })
  getAffaires(@Req() req: any, @Query('clientId', ParseIntPipe) clientId: number) {
    return this.affaires.lister(clientId, req.user.tenantId);
  }

  @Get('rentabilite')
  @ApiOperation({ summary: "Tableau de bord rentabilité / boni-mali par dossier pour les affaires clôturant l'année — ADMIN : tous les dossiers, sinon ses dossiers" })
  getRentabilite(
    @Req() req: any,
    @Query('annee') annee?: string,
    @Query('collaborateurId') collaborateurId?: string,
  ) {
    return this.rentabilite.tableauDeBord(req.user, {
      annee: annee ? +annee : undefined,
      collaborateurId: collaborateurId ? +collaborateurId : undefined,
    });
  }

  @Get('rentabilite/dossier/:clientId')
  @ApiOperation({ summary: "Rentabilité d'un dossier : historique par affaire et détail de l'affaire choisie" })
  getRentabiliteDossier(
    @Req() req: any,
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('affaire') affaire?: string,
  ) {
    return this.rentabilite.dossier(clientId, req.user, affaire);
  }

  @Post('rentabilite/dossier/:clientId/budget')
  @ApiOperation({ summary: "Créer/modifier le budget temps d'une affaire du dossier (ADMIN, expert-comptable ou intervenant du dossier)" })
  enregistrerBudgetDossier(
    @Req() req: any,
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: BudgetDossierDto,
  ) {
    return this.rentabilite.enregistrerBudget(clientId, req.user, dto);
  }

  @Delete('rentabilite/dossier/:clientId/budget/:affaire')
  @ApiOperation({ summary: "Supprimer le budget temps d'une affaire du dossier" })
  supprimerBudgetDossier(
    @Req() req: any,
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('affaire') affaire: string,
  ) {
    return this.rentabilite.supprimerBudget(clientId, affaire, req.user);
  }

  @Get('incoherences')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Lister les incohérences pointage/saisie détectées' })
  getIncoherences(@Req() req: any) {
    return this.service.getIncoherences(req.user.tenantId);
  }

  @Post('admin/alerte-heures-hebdo')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Déclencher manuellement l\'alerte hebdomadaire heures insuffisantes (semaine donnée ou dernière semaine écoulée)' })
  declencherAlerteHeuresHebdo(@Body() body?: { dateDebut?: string; dateFin?: string }) {
    if (body?.dateDebut && body?.dateFin) {
      return this.scheduler.verifierSemaine(body.dateDebut, body.dateFin).then(alertes => ({ alertes }));
    }
    return this.scheduler.alerterHeuresHebdomadaires().then(alertes => ({ alertes }));
  }
}
