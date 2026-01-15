import { describe, expect, it } from 'vitest';
import { slugify } from '../lib/importer/slug';

describe('slugify', () => {
  it('transliterates Cyrillic to ASCII', () => {
    expect(slugify('Трубы ПВХ')).toBe('truby-pvh');
  });

  it('keeps digits and trims separators', () => {
    expect(slugify('Ф40 2.5м')).toBe('f40-2-5m');
  });
});
