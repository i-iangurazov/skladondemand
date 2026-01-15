import { describe, expect, it } from 'vitest';
import { findBestProductMatch, findVariantMatch } from '../lib/importer/resolver';

describe('product resolver helpers', () => {
  it('matches same base name to existing product', () => {
    const products = [
      {
        id: 'prod-1',
        translations: [{ locale: 'ru', name: 'Труба' }],
        variants: [
          {
            id: 'var-1',
            attributes: { dn: 15 },
            translations: [{ locale: 'ru', label: 'DN15' }],
          },
        ],
      },
      {
        id: 'prod-2',
        translations: [{ locale: 'ru', name: 'Кран' }],
        variants: [],
      },
    ];

    const matches = findBestProductMatch(products, {
      baseName: 'Труба',
      label: 'DN20',
      attrs: { dn: 20 },
    });

    expect(matches[0].product.id).toBe('prod-1');
  });

  it('finds variant by label or attrs', () => {
    const product = {
      id: 'prod-1',
      translations: [{ locale: 'ru', name: 'Труба' }],
      variants: [
        {
          id: 'var-1',
          attributes: { dn: 15 },
          translations: [{ locale: 'ru', label: 'DN15' }],
        },
      ],
    };

    const match = findVariantMatch(product, { baseName: 'Труба', label: 'DN15', attrs: { dn: 15 } });
    expect(match?.id).toBe('var-1');
  });

  it('exposes ambiguous matches when names are identical', () => {
    const products = [
      { id: 'prod-1', translations: [{ locale: 'ru', name: 'Кран' }], variants: [] },
      { id: 'prod-2', translations: [{ locale: 'ru', name: 'Кран' }], variants: [] },
    ];

    const matches = findBestProductMatch(products, { baseName: 'Кран' });
    expect(matches.length).toBe(2);
    expect(matches[0].score).toBe(matches[1].score);
  });
});
