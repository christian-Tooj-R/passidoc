import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

// Table de correspondance codes INSEE nature_juridique → libellé
const NATURE_JURIDIQUE_LIBELLE: Record<string, string> = {
  '1000': 'Entrepreneur individuel',
  '1100': 'Artisan-commerçant',
  '1200': 'Commerçant',
  '1300': 'Artisan',
  '1400': 'Officier public ou ministériel',
  '1500': 'Officier public ou ministériel',
  '1600': 'Professionnel libéral',
  '1700': 'Agent commercial',
  '1800': 'Associé-gérant de société',
  '2110': 'Indivision entre personnes physiques',
  '2120': 'Société de fait entre personnes physiques',
  '3120': 'Société commerciale étrangère immatriculée au RCS',
  '3205': 'SELARL unipersonnelle',
  '3210': 'SELARL',
  '3220': 'SELAFA',
  '3230': 'SELCA',
  '3240': 'SELAS',
  '5100': 'SNC',
  '5191': 'Société en commandite simple',
  '5192': 'Société en commandite par actions (SCA)',
  '5195': 'SARL',
  '5196': 'EURL',
  '5200': 'SA à conseil d\'administration',
  '5202': 'SA',
  '5207': 'SASU',
  '5208': 'SAS',
  '5210': 'SARL',
  '5215': 'EURL',
  '5290': 'SA cooperative d\'HLM',
  '5306': 'SAS',
  '5307': 'SASU',
  '5308': 'SAS',
  '5370': 'SCA',
  '5380': 'SARL',
  '5389': 'SARL',
  '5408': 'SELARL',
  '5418': 'SELAS',
  '5421': 'SELAFA',
  '5422': 'SELAFA',
  '5443': 'GEIE',
  '5450': 'GIE',
  '5470': 'SCRL',
  '5485': 'SA',
  '5490': 'SA',
  '5495': 'SARL',
  '5499': 'SA',
  '5500': 'SA à conseil d\'administration',
  '5505': 'SA à conseil d\'administration',
  '5507': 'SA à conseil d\'administration',
  '5510': 'SA à directoire',
  '5515': 'SA à directoire et conseil de surveillance',
  '5520': 'SA à directoire',
  '5585': 'SICAV',
  '5590': 'SAS',
  '5591': 'SAS',
  '5595': 'SASU',
  '5599': 'SA à conseil d\'administration',
  '5620': 'SCOP',
  '5621': 'SCOP',
  '5640': 'SCIC',
  '6220': 'GIE',
  '6316': 'EPIC',
  '7220': 'EPIC national',
  '9110': 'Syndicat de salariés',
  '9150': 'Syndicat d\'employeurs',
  '9210': 'Association loi 1901',
  '9240': 'Association cultuelle',
};

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
  private readonly inseeClientId: string | undefined;
  private readonly inseeClientSecret: string | undefined;
  private inseeToken: string | null = null;
  private inseeTokenExpiry = 0;

  constructor(private config: ConfigService) {
    this.pappersKey     = config.get<string>('PAPPERS_API_KEY');
    this.inseeClientId  = config.get<string>('INSEE_CLIENT_ID');
    this.inseeClientSecret = config.get<string>('INSEE_CLIENT_SECRET');
  }

  // ── Dispatch : Pappers (si clé) → INSEE Sirene (si clé) → API gouv ─────────

  async search(q: string): Promise<PappersResult[]> {
    return this.pappersKey
      ? this.searchPappers(q)
      : this.searchGouv(q);
  }

  async getBySiren(siren: string): Promise<PappersResult | null> {
    if (this.pappersKey) return this.getBySirenPappers(siren);
    if (this.inseeClientId && this.inseeClientSecret) return this.getBySirenInsee(siren);
    return this.getBySirenGouv(siren);
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

  // ── INSEE Sirene v3 (avec clé gratuite) ───────────────────────────────────

  private async getInseeToken(): Promise<string> {
    if (this.inseeToken && Date.now() < this.inseeTokenExpiry) return this.inseeToken;
    const credentials = Buffer.from(`${this.inseeClientId}:${this.inseeClientSecret}`).toString('base64');
    const body = 'grant_type=client_credentials';
    const response = await new Promise<any>((resolve, reject) => {
      const https = require('https');
      const req = https.request({
        hostname: 'portail-api.insee.fr',
        path: '/token',
        method: 'POST',
        family: 4,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 8000,
      }, (res: any) => {
        let raw = '';
        res.on('data', (c: string) => raw += c);
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    this.inseeToken = response.access_token;
    this.inseeTokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
    return this.inseeToken!;
  }

  private async getBySirenInsee(siren: string): Promise<PappersResult | null> {
    try {
      const token = await this.getInseeToken();
      // Appel unité légale (forme juridique)
      const ul = await this.getInsee(`/entreprises/sirene/V3.11/siren/${siren}`, token);
      // Appel siège social pour date de clôture
      const siretSiege = ul.uniteLegale?.periodesUniteLegale?.[0]?.siretSiegeSocial
                      ?? ul.uniteLegale?.etablissements?.[0]?.siret;
      let dateCloture: string | undefined;
      if (siretSiege) {
        const etab = await this.getInsee(`/entreprises/sirene/V3.11/siret/${siretSiege}`, token).catch(() => null);
        const periodes = etab?.etablissement?.periodesEtablissement ?? [];
        const raw = periodes[0]?.dateClotureExerciceEtablissement as string | undefined;
        // L'API Sirene renvoie "MMJJ" (ex: "1231") → on convertit en "MM-DD"
        if (raw && raw.length === 4) dateCloture = `${raw.slice(0, 2)}-${raw.slice(2, 4)}`;
      }
      const codeJuridique = ul.uniteLegale?.categorieJuridiqueUniteLegale ?? '';
      const formeJuridique = NATURE_JURIDIQUE_LIBELLE[codeJuridique] || codeJuridique;
      const siege = ul.uniteLegale?.etablissements?.[0] ?? {};
      return {
        siren,
        nomEntreprise: ul.uniteLegale?.denominationUniteLegale ?? '',
        formeJuridique,
        adresse: [
          siege.adresseEtablissement?.numeroVoieEtablissement,
          siege.adresseEtablissement?.typeVoieEtablissement,
          siege.adresseEtablissement?.libelleVoieEtablissement,
          siege.adresseEtablissement?.codePostalEtablissement,
          siege.adresseEtablissement?.libelleCommuneEtablissement,
        ].filter(Boolean).join(' '),
        siret: siretSiege ?? '',
        codeNaf:    ul.uniteLegale?.activitePrincipaleUniteLegale ?? '',
        libelleNaf: '',
        dirigeants: [],
        dateClotureExercice: dateCloture,
      };
    } catch {
      return this.getBySirenGouv(siren);
    }
  }

  private getInsee(path: string, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const req = https.request({
        hostname: 'api.insee.fr',
        path,
        family: 4,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 8000,
      }, (res: any) => {
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let raw = '';
        res.on('data', (c: string) => raw += c);
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
      req.end();
    });
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
      formeJuridique: NATURE_JURIDIQUE_LIBELLE[r.nature_juridique] ?? r.nature_juridique ?? '',
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
