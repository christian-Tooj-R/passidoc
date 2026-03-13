import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Client } from '../entities/client.entity';
import { ConversationIA, MessageRole } from '../entities/conversation-ia.entity';

@Injectable()
export class AiAssistantService {
  private ollamaUrl: string;
  private ollamaModel: string;

  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(ConversationIA)
    private convRepo: Repository<ConversationIA>,
    private config: ConfigService,
  ) {
    this.ollamaUrl = config.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    this.ollamaModel = config.get<string>('OLLAMA_MODEL') || 'mistral';
  }

  async getHistory(clientId: number) {
    return this.convRepo.find({
      where: { client: { id: clientId } },
      order: { createdAt: 'ASC' },
      take: 50,
    });
  }

  async clearHistory(clientId: number) {
    await this.convRepo.delete({ client: { id: clientId } });
  }

  async chatStream(
    clientId: number,
    messages: { role: string; content: string }[],
    user: any,
    res: Response,
  ) {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: [
        'ficheIdentite',
        'fluxMensuels',
        'fournisseurs',
        'synthesesCloture',
        'analyseStrategique',
        'missions',
        'objectifs',
        'controleInterne',
      ],
    });

    if (!client) {
      res.status(404).end('Client introuvable');
      return;
    }

    const systemPrompt = this.buildSystemPrompt(client);

    // Save user message
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === 'user') {
      await this.convRepo.save(
        this.convRepo.create({
          role: MessageRole.USER,
          contenu: lastUserMessage.content,
          client: { id: clientId } as Client,
          user: user ? { id: user.id } : undefined,
        }),
      );
    }

    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    let ollamaResponse: globalThis.Response;
    try {
      ollamaResponse = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          messages: ollamaMessages,
          stream: true,
        }),
      });
    } catch {
      res.write("⚠️ Impossible de contacter Ollama. Vérifiez qu'il est bien démarré avec `ollama serve`.");
      res.end();
      return;
    }

    if (!ollamaResponse.ok) {
      res.write(`⚠️ Erreur Ollama (${ollamaResponse.status}). Modèle "${this.ollamaModel}" disponible ?`);
      res.end();
      return;
    }

    let fullResponse = '';
    const reader = ollamaResponse.body!.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullResponse += parsed.message.content;
              res.write(parsed.message.content);
            }
          } catch {
            // ignore malformed JSON chunks
          }
        }
      }
    } finally {
      res.end();
    }

    // Save assistant response
    if (fullResponse.trim()) {
      await this.convRepo.save(
        this.convRepo.create({
          role: MessageRole.ASSISTANT,
          contenu: fullResponse,
          client: { id: clientId } as Client,
          user: user ? { id: user.id } : undefined,
        }),
      );
    }
  }

  private buildSystemPrompt(client: Client): string {
    const fi = client.ficheIdentite;
    const analyse = client.analyseStrategique;
    const objectifs = client.objectifs;
    const ci = client.controleInterne;
    const missions = client.missions || [];
    const fournisseurs = client.fournisseurs || [];
    const syntheses = client.synthesesCloture || [];
    const fluxMensuels = client.fluxMensuels || [];

    const lines: string[] = [];

    lines.push(`Tu es l'assistant dossier permanent du cabinet AFYM Audit Expertise.`);
    lines.push(`Tu connais parfaitement le dossier client "${client.nom}" (site : ${client.site === 'REUNION' ? 'La Réunion' : 'Madagascar'}).`);
    lines.push(`Score de santé de passation actuel : ${client.santePassation}%.`);
    lines.push(`Tu réponds exclusivement en français, de façon concise et professionnelle.`);
    lines.push(`Tu ne divulgues jamais de données en dehors du contexte de ce dossier.`);
    lines.push(`\n=== FICHE IDENTITÉ ===`);

    if (fi) {
      if (fi.raisonSociale) lines.push(`Raison sociale : ${fi.raisonSociale}`);
      if (fi.formeJuridique) lines.push(`Forme juridique : ${fi.formeJuridique}`);
      if (fi.siren) lines.push(`SIREN : ${fi.siren}`);
      if (fi.siret) lines.push(`SIRET : ${fi.siret}`);
      if (fi.adresse) lines.push(`Adresse : ${fi.adresse}`);
      if (fi.activite) lines.push(`Activité : ${fi.activite}`);
      if (fi.capital) lines.push(`Capital : ${fi.capital.toLocaleString('fr-FR')} €`);
      if (fi.dateCreation) lines.push(`Date création : ${fi.dateCreation}`);
      if (fi.entrepriseFamiliale) lines.push(`Entreprise familiale : ${fi.entrepriseFamiliale}`);
      if (fi.surfaceCommerciale) lines.push(`Surface commerciale : ${fi.surfaceCommerciale} m²`);
      if (fi.reglementations?.length) lines.push(`Réglementations spécifiques : ${fi.reglementations.join(', ')}`);

      if (fi.gerants?.length) {
        lines.push(`\nGérants :`);
        fi.gerants.forEach((g) => {
          lines.push(`  - ${g.nom}, ${g.age} ans, ${g.situationFamiliale || ''}, ${g.nbEnfants || 0} enfant(s), ${g.parts || 0}% des parts`);
        });
      }
      if (fi.salaries?.length) {
        lines.push(`\nSalariés (${fi.salaries.length}) :`);
        fi.salaries.forEach((s) => {
          lines.push(`  - ${s.nom} — ${s.poste} (${s.typeContrat})`);
        });
      }
    } else {
      lines.push(`Fiche identité non renseignée.`);
    }

    if (analyse) {
      lines.push(`\n=== ANALYSE STRATÉGIQUE ===`);
      if (analyse.forces?.length) lines.push(`Forces : ${analyse.forces.join(' | ')}`);
      if (analyse.faiblesses?.length) lines.push(`Faiblesses : ${analyse.faiblesses.join(' | ')}`);
      if (analyse.opportunites?.length) lines.push(`Opportunités : ${analyse.opportunites.join(' | ')}`);
      if (analyse.menaces?.length) lines.push(`Menaces : ${analyse.menaces.join(' | ')}`);
      if (fi?.evolutionSecteur) lines.push(`Évolution secteur : ${fi.evolutionSecteur}`);
      if (analyse.businessModelCanvas) lines.push(`BMC : ${analyse.businessModelCanvas}`);
    }

    // KPIs depuis la synthèse la plus récente
    const derniereSynthese = syntheses.sort((a, b) => b.exercice - a.exercice)[0];
    if (derniereSynthese) {
      lines.push(`\n=== PERFORMANCES FINANCIÈRES (Exercice ${derniereSynthese.exercice}) ===`);
      if (derniereSynthese.ca) lines.push(`CA : ${derniereSynthese.ca.toLocaleString('fr-FR')} €`);
      if (derniereSynthese.caPrecedent) lines.push(`CA N-1 : ${derniereSynthese.caPrecedent.toLocaleString('fr-FR')} €`);
      if (derniereSynthese.ebe) lines.push(`EBE : ${derniereSynthese.ebe.toLocaleString('fr-FR')} €`);
      if (derniereSynthese.resultatNet) lines.push(`Résultat net : ${derniereSynthese.resultatNet.toLocaleString('fr-FR')} €`);
      if (derniereSynthese.commentaireFinancier) lines.push(`Commentaire : ${derniereSynthese.commentaireFinancier}`);
    }

    if (missions.length) {
      lines.push(`\n=== MISSIONS ===`);
      missions.forEach((m) => {
        lines.push(`  [${m.type}] ${m.titre}${m.honoraires ? ` — ${m.honoraires.toLocaleString('fr-FR')} €` : ''}${m.raisonRefus ? ` (Refus : ${m.raisonRefus})` : ''}`);
      });
    }

    if (objectifs) {
      lines.push(`\n=== OBJECTIFS CLIENT ===`);
      if (objectifs.objectifs12mois) lines.push(`Court terme (12 mois) : ${objectifs.objectifs12mois}`);
      if (objectifs.objectifs3a5ans) lines.push(`Moyen terme (3-5 ans) : ${objectifs.objectifs3a5ans}`);
      if (objectifs.objectifsLongTerme) lines.push(`Long terme : ${objectifs.objectifsLongTerme}`);
      if (objectifs.attentesClient) lines.push(`Attentes vis-à-vis du cabinet : ${objectifs.attentesClient}`);
      if (objectifs.qualiteRelation) lines.push(`Qualité de la relation : ${objectifs.qualiteRelation}`);
    }

    if (ci) {
      lines.push(`\n=== CONTRÔLE INTERNE ===`);
      if (ci.processOk?.length) lines.push(`Process OK : ${ci.processOk.map((p) => p.description).join(' | ')}`);
      if (ci.processDefaillants?.length) lines.push(`Process défaillants : ${ci.processDefaillants.map((p) => p.description).join(' | ')}`);
      if (ci.outilsPilotage?.length) lines.push(`Outils utilisés : ${ci.outilsPilotage.map((o) => o.nom).join(', ')}`);
      if (ci.noteGenerale) lines.push(`Note générale : ${ci.noteGenerale}`);
    }

    if (fournisseurs.length) {
      lines.push(`\n=== FOURNISSEURS PRINCIPAUX ===`);
      fournisseurs.slice(0, 10).forEach((f) => {
        lines.push(`  - ${f.nom}${f.email ? ` (${f.email})` : ''}${f.categorie ? ` — ${f.categorie}` : ''}`);
      });
    }

    if (syntheses.length) {
      const derniere = syntheses[syntheses.length - 1];
      lines.push(`\n=== DERNIÈRE SYNTHÈSE DE CLÔTURE (exercice ${derniere.exercice}) ===`);
      if (derniere.pointsIS) lines.push(`Points IS : ${derniere.pointsIS}`);
      if (derniere.pointsEBE) lines.push(`Points EBE : ${derniere.pointsEBE}`);
      if (derniere.notesSynthese) lines.push(`Notes : ${derniere.notesSynthese}`);
    }

    if (fluxMensuels.length) {
      const manquants = fluxMensuels.filter((f) => f.statut === 'MANQUANT' || !f.statut || f.statut === 'EN_RETARD');
      if (manquants.length) {
        lines.push(`\n=== FLUX MENSUELS ===`);
        lines.push(`Fichiers manquants ou en retard : ${manquants.length}`);
      }
    }

    return lines.join('\n');
  }
}
