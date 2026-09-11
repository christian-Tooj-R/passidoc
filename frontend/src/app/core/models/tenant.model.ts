export interface TenantConfig {
  id: number;
  nomSociete: string;
  logoUrl?: string;
  slogan?: string;
  ville?: string;
  pays?: string;
  poleLabel1: string;
  poleLabel2: string;
  poleFlag1?: string;
  poleFlag2?: string;
  couleurPrimaire?: string;
  isConfigured: boolean;

  /** Mentions légales employeur — module Paie RH interne (bulletin de salaire ~Sage).
   *  Nullable/vides tant que la direction ne les a pas renseignées. */
  adresse?: string | null;
  telephone?: string | null;
  numeroImmatriculationEmployeur?: string | null;
  numeroRegistreCommerce?: string | null;
  numeroIdentifiantFiscal?: string | null;
}
