
import { describe, it, expect } from 'vitest';
import { detectFileType } from '../detectFileType';

describe('detectFileType', () => {
    it('detects CSV files by extension', () => {
        expect(detectFileType('robinhood_export.csv')).toBe('CSV');
        expect(detectFileType('data.CSV')).toBe('CSV');
    });

    it('detects futures statements from PDF content', () => {
        const text = 'ROBINHOOD DERIVATIVES, LLC\nMonthly Statement';
        expect(detectFileType('statement.pdf', text)).toBe('FUTURES_STATEMENT');
    });

    it('detects equity statements from PDF content', () => {
        const text = 'Robinhood Individual Investing\nAccount Statement';
        expect(detectFileType('equity.pdf', text)).toBe('EQUITY_STATEMENT');
    });

    it('detects apex legacy statements from PDF content', () => {
        const text = 'Apex Clearing Corporation\nStatement of Account';
        expect(detectFileType('legacy.pdf', text)).toBe('APEX_LEGACY');
    });

    it('returns UNKNOWN for unsupported extensions', () => {
        expect(detectFileType('test.txt')).toBe('UNKNOWN');
        expect(detectFileType('test.json')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for PDF with unrecognized content', () => {
        expect(detectFileType('random.pdf', 'Some random text')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for PDF without content', () => {
        expect(detectFileType('no_content.pdf')).toBe('UNKNOWN');
    });
});
