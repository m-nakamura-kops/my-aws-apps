import { parseCSVLine, isHeaderRow } from '../csv';

describe('csv', () => {
  describe('parseCSVLine', () => {
    it('simple comma-separated', () => {
      expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
      expect(parseCSVLine('email,password,name')).toEqual(['email', 'password', 'name']);
    });

    it('trims unquoted fields', () => {
      expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
    });

    it('handles quoted fields', () => {
      expect(parseCSVLine('"a",b,"c"')).toEqual(['a', 'b', 'c']);
      expect(parseCSVLine('"hello, world",x')).toEqual(['hello, world', 'x']);
    });

    it('handles escaped double quote', () => {
      expect(parseCSVLine('"a""b",c')).toEqual(['a"b', 'c']);
    });

    it('empty line returns empty array', () => {
      expect(parseCSVLine('')).toEqual([]);
    });

    it('single field', () => {
      expect(parseCSVLine('only')).toEqual(['only']);
    });

    it('trailing comma gives one extra empty string only when there is content after', () => {
      expect(parseCSVLine('a,')).toEqual(['a']);
      expect(parseCSVLine('a,b,')).toEqual(['a', 'b']);
    });
  });

  describe('isHeaderRow', () => {
    it('email column header returns true', () => {
      expect(isHeaderRow(['email', 'password'])).toBe(true);
      expect(isHeaderRow(['Email', 'x'])).toBe(true);
      expect(isHeaderRow(['EMAIL', 'x'])).toBe(true);
      expect(isHeaderRow(['メール', 'x'])).toBe(true);
      expect(isHeaderRow(['mail', 'x'])).toBe(true);
    });

    it('other first column returns false', () => {
      expect(isHeaderRow(['name', 'email'])).toBe(false);
      expect(isHeaderRow(['id', 'email'])).toBe(false);
      expect(isHeaderRow([''])).toBe(false);
    });
  });
});
