import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake');
import { BulletinPaie } from '../entities/bulletin-paie.entity';
import { EmployeClient } from '../entities/employe-client.entity';
import { VariablePaie, StatutVariablePaie } from '../entities/variable-paie.entity';
import { Client } from '../entities/client.entity';
import { MoteurCalculPaieService, ResultatCalculPaie } from './moteur-calcul-paie.service';
import { RubriquesPaieService } from './rubriques-paie.service';
import { ParametresPaieService } from './parametres-paie.service';

@Injectable()
export class BulletinsPaieService {
  constructor(
    @InjectRepository(BulletinPaie) private repo: Repository<BulletinPaie>,
    @InjectRepository(EmployeClient) private employeRepo: Repository<EmployeClient>,
    @InjectRepository(VariablePaie) private variableRepo: Repository<VariablePaie>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private moteur: MoteurCalculPaieService,
    private rubriquesService: RubriquesPaieService,
    private parametresService: ParametresPaieService,
  ) {}

  private async chargerContexte(employeClientId: number, mois: number, annee: number, tenantId: number) {
    const employe = await this.employeRepo.findOne({ where: { id: employeClientId, tenantId } });
    if (!employe) throw new NotFoundException(`Employé client ${employeClientId} introuvable`);

    const variable = await this.variableRepo.findOne({ where: { employeClientId, mois, annee } });
    const rubriques = await this.rubriquesService.findByRegime(employe.regimePaieCode, tenantId);
    const parametres = await this.parametresService.findByRegime(employe.regimePaieCode, tenantId);

    return { employe, variable, rubriques, parametres };
  }

  /** Aperçu du calcul, sans persister. Utilisé par le front avant génération définitive. */
  async calculer(
    employeClientId: number,
    mois: number,
    annee: number,
    tenantId: number,
  ): Promise<ResultatCalculPaie & { employeClientId: number; mois: number; annee: number }> {
    const { employe, variable, rubriques, parametres } = await this.chargerContexte(
      employeClientId,
      mois,
      annee,
      tenantId,
    );
    const resultat = this.moteur.calculer(employe, variable, rubriques, parametres);
    return { ...resultat, employeClientId, mois, annee };
  }

  /** Calcule et persiste un bulletin figé (snapshot) pour la période donnée. */
  async generer(employeClientId: number, mois: number, annee: number, tenantId: number): Promise<BulletinPaie> {
    const { employe, variable, rubriques, parametres } = await this.chargerContexte(
      employeClientId,
      mois,
      annee,
      tenantId,
    );
    const resultat = this.moteur.calculer(employe, variable, rubriques, parametres);

    const bulletin = this.repo.create({
      tenantId,
      employeClientId,
      variablePaieId: variable?.id ?? null,
      mois,
      annee,
      regimePaieCode: employe.regimePaieCode,
      salaireBase: resultat.salaireBase,
      totalBrut: resultat.totalBrut,
      totalCotisationsSalariales: resultat.totalCotisationsSalariales,
      totalCotisationsPatronales: resultat.totalCotisationsPatronales,
      netImposable: resultat.netImposable,
      netAPayer: resultat.netAPayer,
      detailRubriques: resultat.detailRubriques,
    });
    const saved = await this.repo.save(bulletin);

    if (variable) {
      variable.statut = StatutVariablePaie.BULLETIN_GENERE;
      await this.variableRepo.save(variable);
    }

    return saved;
  }

  findByEmploye(employeClientId: number, tenantId: number): Promise<BulletinPaie[]> {
    return this.repo.find({
      where: { employeClientId, tenantId },
      order: { annee: 'DESC', mois: 'DESC' },
    });
  }

  findByClient(clientId: number, tenantId: number): Promise<BulletinPaie[]> {
    return this.repo
      .createQueryBuilder('b')
      .innerJoin(EmployeClient, 'e', 'e.id = b.employeClientId')
      .where('e.clientId = :clientId', { clientId })
      .andWhere('b.tenantId = :tenantId', { tenantId })
      .orderBy('b.annee', 'DESC')
      .addOrderBy('b.mois', 'DESC')
      .getMany();
  }

  async findOne(id: number, tenantId: number): Promise<BulletinPaie> {
    const bulletin = await this.repo.findOne({ where: { id, tenantId } });
    if (!bulletin) throw new NotFoundException(`Bulletin ${id} introuvable`);
    return bulletin;
  }

  private readonly MOIS_LABEL = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  async genererPdf(id: number, tenantId: number): Promise<Buffer> {
    const bulletin = await this.findOne(id, tenantId);
    const employe = await this.employeRepo.findOne({ where: { id: bulletin.employeClientId } });
    if (!employe) throw new NotFoundException('Employé introuvable pour ce bulletin');
    const client = await this.clientRepo.findOne({
      where: { id: employe.clientId },
      relations: ['ficheIdentite'],
    });

    pdfmake.addFonts({
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    // Les colonnes decimal remontent en string depuis Postgres (précision numérique) : on
    // force la conversion avant tout .toFixed() pour ne pas planter la génération du PDF.
    const n2 = (v: unknown): string => Number(v).toFixed(2);

    const fiche = client?.ficheIdentite as any;
    const lignesCotisations = bulletin.detailRubriques.filter((l) => l.imputation === 'COTISATION');
    const lignesAutres = bulletin.detailRubriques.filter((l) => l.imputation !== 'COTISATION');

    const tableBody: any[] = [
      [
        { text: 'Rubrique', bold: true },
        { text: 'Base', bold: true, alignment: 'right' },
        { text: 'Taux sal.', bold: true, alignment: 'right' },
        { text: 'Part salariale', bold: true, alignment: 'right' },
        { text: 'Taux pat.', bold: true, alignment: 'right' },
        { text: 'Part patronale', bold: true, alignment: 'right' },
      ],
    ];
    for (const l of [...lignesCotisations, ...lignesAutres]) {
      tableBody.push([
        l.libelle,
        { text: n2(l.base), alignment: 'right' },
        { text: l.tauxSalarial != null ? `${l.tauxSalarial}%` : '-', alignment: 'right' },
        { text: n2(l.montantSalarial), alignment: 'right' },
        { text: l.tauxPatronal != null ? `${l.tauxPatronal}%` : '-', alignment: 'right' },
        { text: n2(l.montantPatronal), alignment: 'right' },
      ]);
    }

    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 9 },
      content: [
        { text: 'BULLETIN DE PAIE', style: 'title' },
        { text: `${this.MOIS_LABEL[bulletin.mois - 1]} ${bulletin.annee}`, style: 'subtitle' },
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'EMPLOYEUR', bold: true, margin: [0, 0, 0, 3] },
                { text: client?.nom || '-' },
                { text: fiche?.siren ? `SIREN : ${fiche.siren}` : '' },
                { text: fiche?.adresse || '' },
              ],
            },
            {
              width: '50%',
              stack: [
                { text: 'SALARIÉ', bold: true, margin: [0, 0, 0, 3] },
                { text: `${employe.prenom} ${employe.nom}` },
                { text: `Matricule : ${employe.matricule}` },
                { text: `Poste : ${employe.poste || '-'}` },
                { text: `Régime : ${bulletin.regimePaieCode || '-'}` },
              ],
            },
          ],
          margin: [0, 10, 0, 15],
        },
        { text: 'DÉTAIL DES RUBRIQUES', style: 'section' },
        {
          table: { widths: ['*', 50, 45, 60, 45, 60], body: tableBody },
          layout: 'lightHorizontalLines',
          margin: [0, 5, 0, 15],
        },
        {
          table: {
            widths: ['60%', '40%'],
            body: [
              ['Salaire de base', { text: n2(bulletin.salaireBase) + ' €', alignment: 'right' }],
              [{ text: 'TOTAL BRUT', bold: true }, { text: n2(bulletin.totalBrut) + ' €', bold: true, alignment: 'right' }],
              ['Total cotisations salariales', { text: n2(bulletin.totalCotisationsSalariales) + ' €', alignment: 'right' }],
              ['Total cotisations patronales (charge employeur, non déduit du salarié)', { text: n2(bulletin.totalCotisationsPatronales) + ' €', alignment: 'right' }],
              ['Net imposable', { text: n2(bulletin.netImposable) + ' €', alignment: 'right' }],
              [{ text: 'NET À PAYER', bold: true, fontSize: 11 }, { text: n2(bulletin.netAPayer) + ' €', bold: true, fontSize: 11, alignment: 'right' }],
            ],
          },
          margin: [0, 0, 0, 20],
        },
        {
          text:
            "Ce bulletin est généré par Passidoc à partir de rubriques et taux paramétrables. " +
            "Les valeurs par défaut peuvent être des données d'exemple non certifiées — voir Doc/MODULE_PAIE_NOTES.md du dossier technique. " +
            "En cas de rupture du contrat de travail, le salarié doit recevoir un exemplaire de ce bulletin. " +
            "Ce document est à conserver sans limitation de durée.",
          italics: true,
          fontSize: 7,
          color: '#666',
        },
        { text: '\n' },
        { text: `Généré le ${new Date().toLocaleDateString('fr-FR')}`, alignment: 'right', italics: true, fontSize: 8 },
      ],
      styles: {
        title: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
        subtitle: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        section: { fontSize: 11, bold: true, margin: [0, 5, 0, 5], decoration: 'underline' },
      },
    };

    return pdfmake.createPdf(docDefinition).getBuffer();
  }
}
