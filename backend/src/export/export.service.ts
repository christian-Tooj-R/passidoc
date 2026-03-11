import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PdfPrinter from 'pdfmake';
import { Client } from '../entities/client.entity';
import { StatutDepot } from '../entities/flux-mensuel.entity';

@Injectable()
export class ExportService {
  constructor(@InjectRepository(Client) private clientRepo: Repository<Client>) {}

  async generateNotePassation(clientId: number): Promise<Buffer> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['ficheIdentite', 'fluxMensuels', 'fournisseurs', 'synthesesCloture'],
    });
    if (!client) throw new NotFoundException('Client introuvable');

    const fiche = client.ficheIdentite;
    const synthese = client.synthesesCloture?.[0];
    const fluxEnRetard = client.fluxMensuels?.filter(
      (f) => f.statut === StatutDepot.MANQUANT || f.statut === StatutDepot.EN_RETARD,
    );

    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    const printer = new PdfPrinter(fonts);

    const docDefinition: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      content: [
        { text: 'NOTE DE PASSATION', style: 'title' },
        { text: `Dossier : ${client.nom}`, style: 'subtitle' },
        { text: `Site : ${client.site}`, margin: [0, 0, 0, 10] },
        { text: `Score de passation : ${client.santePassation}%`, style: 'score' },
        { text: '\n' },

        { text: '1. IDENTITÉ', style: 'section' },
        {
          table: {
            widths: ['40%', '60%'],
            body: [
              ['Raison sociale', fiche?.raisonSociale || 'Non renseigné'],
              ['SIREN', fiche?.siren || 'Non renseigné'],
              ['SIRET', fiche?.siret || 'Non renseigné'],
              ['Forme juridique', fiche?.formeJuridique || 'Non renseigné'],
              ['Activité', fiche?.activite || 'Non renseigné'],
              ['Adresse', fiche?.adresse || 'Non renseigné'],
            ],
          },
          margin: [0, 5, 0, 15],
        },

        { text: '2. GÉRANTS', style: 'section' },
        ...(fiche?.gerants?.map((g) => ({
          text: `• ${g.nom} — ${g.age} ans, ${g.situationFamiliale}`,
          margin: [10, 2, 0, 2],
        })) || [{ text: 'Aucun gérant renseigné', italics: true }]),
        { text: '\n' },

        { text: '3. ANALYSE FINANCIÈRE (DERNIER EXERCICE)', style: 'section' },
        synthese
          ? {
              table: {
                widths: ['40%', '60%'],
                body: [
                  ['Exercice', synthese.exercice.toString()],
                  ['Points IS', synthese.pointsIS || '-'],
                  ['Points EBE', synthese.pointsEBE || '-'],
                  ['Notes de synthèse', synthese.notesSynthese || '-'],
                  ['Zones d\'exonération', synthese.zonesExoneration?.join(', ') || '-'],
                  ['Zones de risque', synthese.zonesRisque?.join(', ') || '-'],
                ],
              },
              margin: [0, 5, 0, 15],
            }
          : { text: 'Aucune synthèse disponible', italics: true },
        { text: '\n' },

        { text: '4. ALERTES FLUX MENSUELS', style: 'section' },
        fluxEnRetard?.length > 0
          ? {
              ul: fluxEnRetard.map((f) => `${f.type} — ${f.mois}/${f.annee} (${f.statut})`),
              margin: [0, 5, 0, 15],
            }
          : { text: 'Aucune alerte en cours ✓', color: 'green' },
        { text: '\n' },

        { text: '5. FOURNISSEURS PRINCIPAUX', style: 'section' },
        client.fournisseurs?.length > 0
          ? {
              table: {
                widths: ['40%', '60%'],
                body: [
                  [{ text: 'Nom', bold: true }, { text: 'Email', bold: true }],
                  ...client.fournisseurs.map((f) => [f.nom, f.email]),
                ],
              },
              margin: [0, 5, 0, 15],
            }
          : { text: 'Aucun fournisseur renseigné', italics: true },

        { text: '\n\n' },
        { text: `Généré le ${new Date().toLocaleDateString('fr-FR')}`, alignment: 'right', italics: true, fontSize: 8 },
      ],
      styles: {
        title: { fontSize: 20, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
        subtitle: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        score: { fontSize: 12, bold: true, color: '#2563eb', alignment: 'center', margin: [0, 0, 0, 20] },
        section: { fontSize: 12, bold: true, margin: [0, 10, 0, 5], decoration: 'underline' },
      },
    };

    const doc = printer.createPdfKitDocument(docDefinition);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
