import { createHash } from 'crypto';
import { Cart, CartProducts } from '../generated/prisma';
export function buildCartHash(
  items: { variantId: string; quantity: number }[],
): string {
  const hash = items
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
    .map((i) => `${i.variantId}:${i.quantity}`)
    .join(',');
  return createHash('sha256').update(hash).digest('hex');
}

export const compareCartWithHashed = (
  items: { variantId: string; quantity: number }[],
  hash: string,
) => {
  const hash2 = buildCartHash(items);
  return hash === hash2;
};
