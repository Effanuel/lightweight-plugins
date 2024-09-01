export function ensureDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Value is undefined");
  }
  return value;
}
