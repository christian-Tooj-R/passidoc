import { IsNumber, IsOptional, IsPositive, Matches, Min } from 'class-validator';

export class BudgetDossierDto {
  @Matches(/^C\d{4}-(0[1-9]|1[0-2])$/, { message: 'Affaire invalide (format attendu : C2026-09).' })
  affaire: string;

  @IsNumber()
  @IsPositive()
  heuresBudget: number;

  /** Honoraires comptables de l'affaire (€ HT) — vide = ceux de la fiche identité. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  honoraires?: number | null;

  /** Prix de vente horaire manuel — vide = honoraires ÷ heures budget. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  prixVenteHoraire?: number | null;
}
