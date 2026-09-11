import {
  ArrondiConstantePaieRh, ConstantePaieRh, OperateurCalculConstante,
  SourceOperandeConstante, TypeConstantePaieRh,
} from '../entities/constante-paie-rh.entity';

/**
 * Résout la valeur numérique d'une `ConstantePaieRh` à partir d'une liste de constantes
 * DÉJÀ filtrée pour un régime/date de référence donnés (une seule ligne par code — voir
 * `ConstantesPaieRhService.findByRegime`, qui applique l'historisation par date d'effet
 * et la priorité régime spécifique > TOUS avant d'appeler cette fonction).
 *
 * Composition (`typeConstante = CALCUL`) : la grille d'opérandes Sage ("op / Code /
 * Intitulé") est repliée ici en une réduction gauche-à-droite — le PREMIER opérande fixe
 * la valeur de départ (son opérateur n'a de sens que pour un signe négatif via
 * SOUSTRACTION), puis chaque opérande suivant applique son opérateur à l'accumulateur.
 * Protection contre les références circulaires via `chemin`.
 *
 * Utilisée à la fois par le moteur de calcul du bulletin (`moteur-calcul-paie-rh.service.ts`)
 * et par `ConstantesPaieRhService.previsualiser()` (endpoint de prévisualisation pour le
 * "picker" de constante côté front) — une seule implémentation, pas de logique dupliquée.
 */
export function resoudreConstante(
  code: string,
  constantes: ConstantePaieRh[],
  chemin: string[] = [],
): number {
  if (chemin.includes(code)) {
    throw new Error(
      `Référence circulaire détectée sur la constante de paie RH "${code}" (chaîne : ${[...chemin, code].join(' → ')})`,
    );
  }
  const constante = constantes.find((c) => c.code === code);
  if (!constante) {
    throw new Error(`Constante de paie RH "${code}" introuvable pour ce régime/cette date`);
  }

  let valeur: number;
  if (constante.typeConstante === TypeConstantePaieRh.VALEUR) {
    valeur = Number(constante.valeur) || 0;
  } else {
    const operandes = constante.operandes ?? [];
    valeur = 0;
    operandes.forEach((op, index) => {
      const v = op.source === SourceOperandeConstante.CONSTANTE
        ? (op.constanteCode ? resoudreConstante(op.constanteCode, constantes, [...chemin, code]) : 0)
        : Number(op.valeur) || 0;

      if (index === 0) {
        // Le 1er opérande fixe la valeur de départ — seul un signe (SOUSTRACTION) a un sens ici.
        valeur = op.operateur === OperateurCalculConstante.SOUSTRACTION ? -v : v;
        return;
      }
      switch (op.operateur) {
        case OperateurCalculConstante.ADDITION: valeur += v; break;
        case OperateurCalculConstante.SOUSTRACTION: valeur -= v; break;
        case OperateurCalculConstante.MULTIPLICATION: valeur *= v; break;
        case OperateurCalculConstante.DIVISION: valeur = v !== 0 ? valeur / v : 0; break;
      }
    });
  }

  if (constante.arrondi === ArrondiConstantePaieRh.PLUS_PROCHE) {
    valeur = Math.round(valeur);
  }
  return valeur;
}
