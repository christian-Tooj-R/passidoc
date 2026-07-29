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
}
