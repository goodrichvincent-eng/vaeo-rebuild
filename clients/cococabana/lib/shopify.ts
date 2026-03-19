/**
 * Shopify Storefront API client for cart operations.
 * Requires env vars:
 *   NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN  (e.g. hautedoorliving.myshopify.com)
 *   NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN
 */

const STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? 'hautedoorliving.myshopify.com';
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? '';
const API_VERSION = '2025-01';

const endpoint = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

async function storefront<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!STOREFRONT_TOKEN) throw new Error('NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN not set');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Storefront API error: ${res.status}`);
  const json = await res.json() as { data?: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`Storefront GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    price: { amount: string; currencyCode: string };
    product: { title: string; handle: string };
    image: { url: string; altText: string | null } | null;
  };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    totalAmount: { amount: string; currencyCode: string };
    subtotalAmount: { amount: string; currencyCode: string };
  };
  lines: { edges: { node: CartLine }[] };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      totalAmount { amount currencyCode }
      subtotalAmount { amount currencyCode }
    }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              product { title handle }
              image { url altText }
            }
          }
        }
      }
    }
  }
`;

export async function cartCreate(variantId: string, quantity = 1): Promise<Cart> {
  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await storefront<{ cartCreate: { cart: Cart } }>(query, {
    input: { lines: [{ merchandiseId: variantId, quantity }] },
  });
  return data.cartCreate.cart;
}

export async function cartLinesAdd(cartId: string, variantId: string, quantity = 1): Promise<Cart> {
  const query = `
    mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await storefront<{ cartLinesAdd: { cart: Cart } }>(query, {
    cartId,
    lines: [{ merchandiseId: variantId, quantity }],
  });
  return data.cartLinesAdd.cart;
}

export async function cartLinesRemove(cartId: string, lineIds: string[]): Promise<Cart> {
  const query = `
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await storefront<{ cartLinesRemove: { cart: Cart } }>(query, {
    cartId,
    lineIds,
  });
  return data.cartLinesRemove.cart;
}

export async function getCart(cartId: string): Promise<Cart | null> {
  const query = `
    query getCart($cartId: ID!) {
      cart(id: $cartId) { ...CartFields }
    }
    ${CART_FRAGMENT}
  `;
  const data = await storefront<{ cart: Cart | null }>(query, { cartId });
  return data.cart;
}

/** Fallback: direct add-to-cart URL (no token needed). */
export function cartPermalink(variantId: string, quantity = 1): string {
  // variantId is a GID like "gid://shopify/ProductVariant/12345"
  const numericId = variantId.split('/').pop() ?? variantId;
  return `https://${STORE_DOMAIN}/cart/${numericId}:${quantity}`;
}

export const hasStorefrontToken = !!STOREFRONT_TOKEN;
