import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

export interface PappersResult {
  siren: string;
  nomEntreprise: string;
  formeJuridique: string;
  adresse: string;
  siret: string;
  codeNaf: string;
  libelleNaf: string;
  dirigeants: { nom: string; prenom: string; qualite: string; dateNaissance?: string }[];
  dateClotureExercice?: string; // Format "MM-DD", ex: "12-31"
}

@Injectable()
export class PappersService {
  private readonly pappersKey: string | undefined;

  constructor(private config: ConfigService) {
    this.pappersKey = config.get<string>('PAPPERS_API_KEY');
  }

  // ── Dispatch : Pappers.fr (si clé) ou API gouv (fallback) ──────────────────

  async search(q: string): Promise<PappersResult[]> {
    return this.pappersKey
      ? this.searchPappers(q)
      : this.searchGouv(q);
  }

  async getBySiren(siren: string): Promise<PappersResult | null> {
    return this.pappersKey
      ? this.getBySirenPappers(siren)
      : this.getBySirenGouv(siren);
  }

  // ── Pappers.fr API (api.pappers.fr) ────────────────────────────────────────

  private async searchPappers(q: string): Promise<PappersResult[]> {
    try {
      const path = `/v2/recherche?q=${encodeURIComponent(q)}&api_token=${this.pappersKey}&bases=entreprises&par_page=10`;
      const data = await this.get('api.pappers.fr', path);
      return (data.resultats || []).map((r: any) => this.mapPappers(r));
    } catch {
      return this.searchGouv(q); // fallback
    }
  }

  private async getBySirenPappers(siren: string): Promise<PappersResult | null> {
    try {
      const path = `/v2/entreprise?siren=${siren}&api_token=${this.pappersKey}`;
      const data = await this.get('api.pappers.fr', path);
      return data.siren ? this.mapPappers(data) : null;
    } catch {
      return this.getBySirenGouv(siren);
    }
  }

  private mapPappers(r: any): PappersResult {
    const siege = r.siege ?? {};
    return {
      siren: r.siren ?? '',
      nomEntreprise: r.nom_entreprise ?? '',
      formeJuridique: r.forme_juridique ?? '',
      adresse: [siege.adresse_ligne_1, siege.code_postal, siege.ville].filter(Boolean).join(' '),
      siret: siege.siret ?? '',
      codeNaf: r.code_naf ?? '',
      libelleNaf: r.libelle_code_naf ?? '',
      dirigeants: (r.dirigeants || []).slice(0, 5).map((d: any) => ({
        nom: d.nom ?? '',
        prenom: d.prenom ?? '',
        qualite: d.qualite ?? '',
        dateNaissance: d.date_de_naissance ?? undefined,
      })),
      dateClotureExercice: this.parsePappersDate(r.date_cloture_exercice_comptable),
    };
  }

  /**
   * Pappers renvoie "31-12" (JJ-MM) → on convertit en "MM-DD"
   */
  private parsePappersDate(raw: string | undefined): string | undefined {
    if (!raw || raw.length < 5) return undefined;
    const parts = raw.split('-');
    if (parts.length === 2) return `${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return undefined;
  }

  // ── API Gouvernement (fallback sans clé) ───────────────────────────────────

  private async searchGouv(q: string): Promise<PappersResult[]> {
    const path = `/search?q=${encodeURIComponent(q)}&page=1&per_page=10&is_open=true`;
    try {
      const data = await this.get('recherche-entreprises.api.gouv.fr', path);
      return (data.results || []).map((r: any) => this.mapGouv(r));
    } catch {
      return [];
    }
  }

  private async getBySirenGouv(siren: string): Promise<PappersResult | null> {
    const path = `/search?q=${encodeURIComponent(siren)}&page=1&per_page=1`;
    try {
      const data = await this.get('recherche-entreprises.api.gouv.fr', path);
      const r = data.results?.[0];
      return r ? this.mapGouv(r) : null;
    } catch {
      return null;
    }
  }

  private mapGouv(r: any): PappersResult {
    return {
      siren: r.siren ?? '',
      nomEntreprise: r.nom_complet ?? r.nom_raison_sociale ?? '',
      formeJuridique: r.nature_juridique_libelle ?? '',
      adresse: r.siege?.adresse ?? [
        r.siege?.adresse_ligne_1,
        r.siege?.code_postal,
        r.siege?.commune,
      ].filter(Boolean).join(' ') ?? '',
      siret: r.siege?.siret ?? '',
      codeNaf:    r.activite_principale         ?? r.siege?.activite_principale         ?? '',
      libelleNaf: r.activite_principale_libelle ?? r.siege?.activite_principale_libelle ?? '',
      dirigeants: (r.dirigeants || []).slice(0, 5).map((d: any) => ({
        nom: d.nom ?? '',
        prenom: d.prenoms ?? d.prenom ?? '',
        qualite: d.qualite ?? '',
        dateNaissance: d.date_de_naissance ?? undefined,
      })),
      dateClotureExercice: undefined, // L'API gouv ne retourne pas ce champ
    };
  }

  // ── HTTP helper ────────────────────────────────────────────────────────────

  private get(hostname: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname,
        path,
        family: 4,
        headers: { 'User-Agent': 'passidoc/1.0' },
        timeout: 8000,
      };
      const req = https.get(options, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(e); }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
    });
  }
}
