export const getQuantileBuckets = (totals: number[]): number[] => {
  const nonZero = totals.filter((t) => t > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return totals.map(() => 0);

  const q = (p: number) => nonZero[Math.floor((nonZero.length - 1) * p)];
  const q25 = q(0.25);
  const q50 = q(0.5);
  const q75 = q(0.75);

  // If all quantiles are equal, all non-zero values map to bucket 4
  if (q25 === q50 && q50 === q75) {
    return totals.map((t) => (t > 0 ? 4 : 0));
  }

  return totals.map((t) => {
    if (t <= 0) return 0;
    if (t <= q25) return 1;
    if (t <= q50) return 2;
    if (t <= q75) return 3;
    return 4;
  });
};
