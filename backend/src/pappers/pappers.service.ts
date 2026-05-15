import { Injectable } from '@nestjs/common';
import * as https from 'https';

export interface PappersResult {
  siren: string;
  nomEntreprise: string;
  formeJuridique: string;
  adresse: string;
  siret: string;
  dirigeants: { nom: string; prenom: string; qualite: string; dateNaissance?: string }[];
}

@Injectable()
export class PappersService {
  private readonly HOST = 'recherche-entreprises.api.gouv.fr';

  private get(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: this.HOST,
        path,
        family: 4, // forcer IPv4 (Node 22 essaie IPv6 en premier, bloqué sur ce serveur)
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

  async search(q: string): Promise<PappersResult[]> {
    const path = `/search?q=${encodeURIComponent(q)}&page=1&per_page=10&is_open=true`;
    try {
      const data = await this.get(path);
      return (data.results || []).map((r: any) => this.mapResult(r));
    } catch {
      return [];
    }
  }

  async getBySiren(siren: string): Promise<PappersResult | null> {
    const path = `/search?q=${encodeURIComponent(siren)}&page=1&per_page=1`;
    try {
      const data = await this.get(path);
      const r = data.results?.[0];
      return r ? this.mapResult(r) : null;
    } catch {
      return null;
    }
  }

  private mapResult(r: any): PappersResult {
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
      dirigeants: (r.dirigeants || []).slice(0, 5).map((d: any) => ({
        nom: d.nom ?? '',
        prenom: d.prenoms ?? d.prenom ?? '',
        qualite: d.qualite ?? '',
        dateNaissance: d.date_de_naissance ?? undefined,
      })),
    };
  }
}
