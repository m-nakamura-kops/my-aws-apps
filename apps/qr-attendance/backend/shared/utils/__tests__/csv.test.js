"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const csv_1 = require("../csv");
describe('csv', () => {
    describe('parseCSVLine', () => {
        it('simple comma-separated', () => {
            expect((0, csv_1.parseCSVLine)('a,b,c')).toEqual(['a', 'b', 'c']);
            expect((0, csv_1.parseCSVLine)('email,password,name')).toEqual(['email', 'password', 'name']);
        });
        it('trims unquoted fields', () => {
            expect((0, csv_1.parseCSVLine)(' a , b , c ')).toEqual(['a', 'b', 'c']);
        });
        it('handles quoted fields', () => {
            expect((0, csv_1.parseCSVLine)('"a",b,"c"')).toEqual(['a', 'b', 'c']);
            expect((0, csv_1.parseCSVLine)('"hello, world",x')).toEqual(['hello, world', 'x']);
        });
        it('handles escaped double quote', () => {
            expect((0, csv_1.parseCSVLine)('"a""b",c')).toEqual(['a"b', 'c']);
        });
        it('empty line returns empty array', () => {
            expect((0, csv_1.parseCSVLine)('')).toEqual([]);
        });
        it('single field', () => {
            expect((0, csv_1.parseCSVLine)('only')).toEqual(['only']);
        });
        it('trailing comma gives one extra empty string only when there is content after', () => {
            expect((0, csv_1.parseCSVLine)('a,')).toEqual(['a']);
            expect((0, csv_1.parseCSVLine)('a,b,')).toEqual(['a', 'b']);
        });
    });
    describe('isHeaderRow', () => {
        it('email column header returns true', () => {
            expect((0, csv_1.isHeaderRow)(['email', 'password'])).toBe(true);
            expect((0, csv_1.isHeaderRow)(['Email', 'x'])).toBe(true);
            expect((0, csv_1.isHeaderRow)(['EMAIL', 'x'])).toBe(true);
            expect((0, csv_1.isHeaderRow)(['メール', 'x'])).toBe(true);
            expect((0, csv_1.isHeaderRow)(['mail', 'x'])).toBe(true);
        });
        it('other first column returns false', () => {
            expect((0, csv_1.isHeaderRow)(['name', 'email'])).toBe(false);
            expect((0, csv_1.isHeaderRow)(['id', 'email'])).toBe(false);
            expect((0, csv_1.isHeaderRow)([''])).toBe(false);
        });
    });
});
