import { createUniqueSlug } from './catalog-identifiers';

describe('createUniqueSlug', () => {
  it('normalizes text and appends the supplied uniqueness suffix', () => {
    expect(createUniqueSlug('Café & Shirts', '1234abcd')).toBe(
      'cafe-shirts-1234abcd',
    );
  });
});
