export function generateOrderNumber(): string {
  return "DS-" + Math.floor(1000 + Math.random() * 9000);
}
