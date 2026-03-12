import { Injectable } from '@nestjs/common';

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
  private readonly API = 'https://recherche-entreprises.api.gouv.fr';

  async search(q: string): Promise<PappersResult[]> {
    const url = `${this.API}/search?q=${encodeURIComponent(q)}&page=1&per_page=8&is_open=true`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data: any = await res.json();
    return (data.results || []).map((r: any) => this.mapResult(r));
  }

  async getBySiren(siren: string): Promise<PappersResult | null> {
    const url = `${this.API}/search?q=${siren}&page=1&per_page=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data: any = await res.json();
    const r = data.results?.[0];
    return r ? this.mapResult(r) : null;
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
