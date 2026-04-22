export const MINIMUM_QUALIFYING_SCORE = 6;
// Streak tiers capped at 5 days (1.5x). No penalty for breaking streak.
// Philosophy: encourages daily shipping without punishing weekends or rest.
export const STREAK_TIERS: Array<[number, number]> = [
  [5, 1.5],
  [3, 1.25],
  [2, 1.1],
];

type Receipt = Record<string, any>;

export function computeBaseScore(receipt: Receipt): [number, Record<string, number>] {
  const breakdown: Record<string, number> = {};
  let score = 0;

  if (receipt?.subject?.name) {
    breakdown["subject.name"] = 1;
    score += 1;
  }

  const profiles = Array.isArray(receipt?.subject?.profiles) ? receipt.subject.profiles : [];
  const validProfiles = profiles.filter((p: any) => p?.kind && p?.url);
  if (validProfiles.length > 0) {
    breakdown["subject.profiles"] = 2;
    score += 2;
  }

  if (receipt?.meta?.created_at) {
    breakdown["meta.created_at"] = 1;
    score += 1;
  }

  if (receipt?.meta?.content_hash) {
    breakdown["meta.content_hash"] = 3;
    score += 3;
  }

  const artifacts = Array.isArray(receipt?.artifacts) ? receipt.artifacts : [];
  artifacts.forEach((artifact: any, i: number) => {
    const prefix = `artifact[${i}]`;

    if (artifact?.immutable_ref) {
      breakdown[`${prefix}.immutable_ref`] = 2;
      score += 2;
    }

    if (artifact?.ci_url) {
      breakdown[`${prefix}.ci_url`] = 1;
      score += 1;
    }

    const verify = Array.isArray(artifact?.verify) ? artifact.verify : [];
    verify.forEach((v: any, j: number) => {
      const vprefix = `${prefix}.verify[${j}]`;
      if (v?.kind === "checksum" && v?.algo && v?.hash) {
        breakdown[`${vprefix}.checksum`] = 3;
        score += 3;
      } else if (v?.kind === "link" && v?.url) {
        breakdown[`${vprefix}.link`] = 1;
        score += 1;
      } else if (v?.kind === "command" && v?.command) {
        breakdown[`${vprefix}.command`] = 2;
        score += 2;
      } else if (v?.kind === "attestation" && v?.attestation) {
        breakdown[`${vprefix}.attestation`] = 2;
        score += 2;
      }
    });

    const signals = artifact?.signals ?? {};
    for (const key of ["dependents", "downloads_30d", "stars"] as const) {
      const val = signals[key];
      if (typeof val === "number" && val > 0) {
        breakdown[`${prefix}.signals.${key}`] = 1;
        score += 1;
      }
    }
    const citations = signals.downstream_citations;
    if (Array.isArray(citations) && citations.length > 0) {
      breakdown[`${prefix}.signals.citations`] = 1;
      score += 1;
    }
  });

  return [score, breakdown];
}

export function streakMultiplier(streakDays: number): number {
  for (const [threshold, mult] of STREAK_TIERS) {
    if (streakDays >= threshold) return mult;
  }
  return 1.0;
}

export function integrityMultiplier(receipt: Receipt, hashValid: boolean): number {
  if (!hashValid) return 1.0;
  const artifacts = Array.isArray(receipt?.artifacts) ? receipt.artifacts : [];
  for (const artifact of artifacts) {
    const verify = Array.isArray(artifact?.verify) ? artifact.verify : [];
    for (const v of verify) {
      if (v?.kind === "checksum" && v?.algo && v?.hash) return 1.5;
    }
  }
  return 1.0;
}

export function qualifiesForStreak(baseScore: number): boolean {
  return baseScore >= MINIMUM_QUALIFYING_SCORE;
}

export function computeFinalScore(
  baseScore: number,
  streakDays: number,
  receipt: Receipt,
  hashValid: boolean,
): number {
  const sMult = streakMultiplier(streakDays);
  const iMult = integrityMultiplier(receipt, hashValid);
  return Math.floor(baseScore * sMult * iMult);
}

export function confidenceLevel(baseScore: number, hashValid: boolean): string {
  if (!hashValid && baseScore === 0) return "none";
  if (baseScore === 0) return "none";
  if (baseScore < 6) return "minimal";
  if (baseScore < 12) return "moderate";
  if (baseScore < 20) return "strong";
  return "verified";
}
