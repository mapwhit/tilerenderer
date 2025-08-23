export function assertEqualWithPrecision(
  expected,
  actual,
  multiplier,
  message = `should be equal to within ${multiplier}`
) {
  const expectedRounded = Math.round(expected / multiplier) * multiplier;
  const actualRounded = Math.round(actual / multiplier) * multiplier;

  return this.equal(expectedRounded, actualRounded, message);
}
