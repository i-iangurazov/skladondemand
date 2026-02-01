import 'server-only';

const escapeAdminValue = (value: string) => value.replace(/"/g, '\\"').trim();

const buildBrandToken = (brand: string) => {
  const escaped = escapeAdminValue(brand);
  if (!escaped) return null;
  return `tag:"${escaped}"`;
};

export const buildAdminProductsQuery = (params: {
  q?: string | null;
  collectionId?: string | null;
  brand?: string | null;
  avail?: 'in' | 'out' | null;
}) => {
  const tokens: string[] = [];
  if (params.q) {
    const escaped = escapeAdminValue(params.q);
    if (escaped) tokens.push(escaped.includes(' ') ? `"${escaped}"` : escaped);
  }
  if (params.collectionId) {
    tokens.push(`collection_id:${escapeAdminValue(params.collectionId)}`);
  }
  if (params.brand) {
    const brandToken = buildBrandToken(params.brand);
    if (brandToken) tokens.push(brandToken);
  }
  if (params.avail) {
    tokens.push(`available_for_sale:${params.avail === 'in'}`);
  }
  return tokens.join(' AND ');
};
