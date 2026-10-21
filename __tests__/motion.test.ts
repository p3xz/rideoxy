import { parseDisplayNumber, MOTION_DURATIONS } from '../lib/motion';

describe('motion helpers', () => {
  it('has durations within safe bounds (140ms - 600ms)', () => {
    expect(MOTION_DURATIONS.tap).toBeLessThanOrEqual(300);
    expect(MOTION_DURATIONS.fast).toBeLessThanOrEqual(300);
    expect(MOTION_DURATIONS.normal).toBeLessThanOrEqual(350);
    expect(MOTION_DURATIONS.chart).toBeLessThanOrEqual(600);
  });

  it('correctly parses integer display strings', () => {
    expect(parseDisplayNumber('128')).toEqual({ num: 128, decimals: 0 });
    expect(parseDisplayNumber('1,248')).toEqual({ num: 1248, decimals: 0 });
    expect(parseDisplayNumber('0')).toEqual({ num: 0, decimals: 0 });
  });

  it('correctly parses float display strings', () => {
    expect(parseDisplayNumber('42.5')).toEqual({ num: 42.5, decimals: 1 });
    expect(parseDisplayNumber('3.14')).toEqual({ num: 3.14, decimals: 2 });
  });

  it('handles non-numeric or empty strings safely', () => {
    expect(parseDisplayNumber('–')).toBeNull();
    expect(parseDisplayNumber('')).toBeNull();
    expect(parseDisplayNumber('N/A')).toBeNull();
  });
});
