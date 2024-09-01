export function round(number: number, fraction: number) {
  const inverseFraction = 1 / fraction;
  return Math.round(number * inverseFraction) / inverseFraction;
}
