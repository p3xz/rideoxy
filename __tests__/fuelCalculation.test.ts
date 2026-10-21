import {
  convertKmToMiles,
  convertMilesToKm,
  convertLitresToGallons,
  convertGallonsToLitres,
  convertMileageFromCanonical,
  deriveFuelLogs,
  computeFuelSummary,
  formatDisplayCurrency,
  formatDisplayDistance,
  formatDisplayVolume,
  formatDisplayMileage,
  formatDisplayRate,
} from '../services/fuelCalculation';
import { FuelLog } from '../types/fuel';

describe('Fuel Calculation & Intelligence Engine', () => {
  describe('Unit Conversions', () => {
    test('converts km to miles and back accurately', () => {
      const km = 100;
      const miles = convertKmToMiles(km);
      expect(miles).toBeCloseTo(62.137, 2);
      expect(convertMilesToKm(miles)).toBeCloseTo(km, 4);
    });

    test('converts litres to US gallons and UK gallons', () => {
      const litres = 10;
      const usGallons = convertLitresToGallons(litres, false);
      const ukGallons = convertLitresToGallons(litres, true);

      expect(usGallons).toBeCloseTo(2.6417, 3);
      expect(ukGallons).toBeCloseTo(2.1997, 3);

      expect(convertGallonsToLitres(usGallons, false)).toBeCloseTo(litres, 4);
      expect(convertGallonsToLitres(ukGallons, true)).toBeCloseTo(litres, 4);
    });

    test('converts canonical km/L to target efficiency units', () => {
      const kmPerL = 30; // 30 km/L motorcycle mileage

      expect(convertMileageFromCanonical(kmPerL, 'km/L')).toBe(30);
      // L/100km = 100 / 30 = 3.333
      expect(convertMileageFromCanonical(kmPerL, 'L/100km')).toBeCloseTo(3.333, 2);
      // 1 km/L ≈ 2.35215 mpg US -> 30 * 2.35215 ≈ 70.56 mpg US
      expect(convertMileageFromCanonical(kmPerL, 'mpg (US)')).toBeCloseTo(70.56, 1);
      // 1 km/L ≈ 2.82481 mpg UK -> 30 * 2.82481 ≈ 84.74 mpg UK
      expect(convertMileageFromCanonical(kmPerL, 'mpg (UK)')).toBeCloseTo(84.74, 1);
    });
  });

  describe('deriveFuelLogs with Complete & Incomplete Data', () => {
    test('handles empty fuel logs', () => {
      const result = deriveFuelLogs([]);
      expect(result).toEqual([]);
    });

    test('handles single fuel log (initial baseline)', () => {
      const rawLogs: FuelLog[] = [
        {
          id: 'log-1',
          vehicleId: 'default',
          odometer: 1000,
          fuelAddedLitres: 12,
          pricePerLitre: 100,
          totalCost: 1200,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: true,
          timestamp: '2026-08-01T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 1000,
        },
      ];

      const derived = deriveFuelLogs(rawLogs);
      expect(derived.length).toBe(1);
      expect(derived[0].logNumber).toBe(1);
      expect(derived[0].isStartOfChain).toBe(true);
      expect(derived[0].calculatedMileageKmPerL).toBeNull();
      expect(derived[0].distanceSincePreviousKm).toBeNull();
    });

    test('calculates accurate mileage for consecutive full tanks', () => {
      const rawLogs: FuelLog[] = [
        {
          id: 'log-1',
          vehicleId: 'default',
          odometer: 1000,
          fuelAddedLitres: 12,
          pricePerLitre: 100,
          totalCost: 1200,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: true,
          timestamp: '2026-08-01T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 1000,
        },
        {
          id: 'log-2',
          vehicleId: 'default',
          odometer: 1300, // 300 km ridden
          fuelAddedLitres: 10, // 10 L to fill back up
          pricePerLitre: 100,
          totalCost: 1000,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: true,
          timestamp: '2026-08-05T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 2000,
        },
      ];

      const derived = deriveFuelLogs(rawLogs);
      // Newest first
      expect(derived[0].id).toBe('log-2');
      expect(derived[0].distanceSincePreviousKm).toBe(300);
      expect(derived[0].calculatedMileageKmPerL).toBe(30); // 300 km / 10 L
      expect(derived[0].costPerKm).toBe(3.33); // 1000 INR / 300 km = 3.33 INR/km

      expect(derived[1].id).toBe('log-1');
      expect(derived[1].calculatedMileageKmPerL).toBeNull();
    });

    test('accumulates fuel and cost across partial fills until next full tank', () => {
      const rawLogs: FuelLog[] = [
        {
          id: 'log-1',
          vehicleId: 'default',
          odometer: 1000,
          fuelAddedLitres: 12,
          pricePerLitre: 100,
          totalCost: 1200,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: true,
          timestamp: '2026-08-01T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 1000,
        },
        {
          id: 'log-2',
          vehicleId: 'default',
          odometer: 1150, // 150 km
          fuelAddedLitres: 4, // partial fill
          pricePerLitre: 100,
          totalCost: 400,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: false, // partial!
          timestamp: '2026-08-03T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 2000,
        },
        {
          id: 'log-3',
          vehicleId: 'default',
          odometer: 1300, // 300 km total from log-1
          fuelAddedLitres: 6, // fill to top (total added in chain = 4 + 6 = 10 L)
          pricePerLitre: 100,
          totalCost: 600,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: true,
          timestamp: '2026-08-05T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 3000,
        },
      ];

      const derived = deriveFuelLogs(rawLogs);
      // log-3: 300 km total distance / 10 L total fuel = 30 km/L
      expect(derived[0].id).toBe('log-3');
      expect(derived[0].calculatedMileageKmPerL).toBe(30);
      expect(derived[0].costPerKm).toBe(3.33); // (400 + 600) / 300 = 3.33

      // log-2: partial fill, cannot calculate standalone mileage
      expect(derived[1].id).toBe('log-2');
      expect(derived[1].isPartialFill).toBe(true);
      expect(derived[1].calculatedMileageKmPerL).toBeNull();
    });
  });

  describe('computeFuelSummary', () => {
    test('computes aggregate statistics across valid derived logs', () => {
      const rawLogs: FuelLog[] = [
        {
          id: 'log-1',
          vehicleId: 'default',
          odometer: 1000,
          fuelAddedLitres: 12,
          pricePerLitre: 100,
          totalCost: 1200,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: true,
          timestamp: '2026-08-01T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 1000,
        },
        {
          id: 'log-2',
          vehicleId: 'default',
          odometer: 1300,
          fuelAddedLitres: 10,
          pricePerLitre: 102,
          totalCost: 1020,
          currency: 'INR',
          fuelType: 'petrol',
          fullTank: true,
          timestamp: '2026-08-05T10:00:00.000Z',
          inputMode: 'litres',
          manuallyAdjusted: false,
          createdAt: 2000,
        },
      ];

      const derived = deriveFuelLogs(rawLogs);
      const summary = computeFuelSummary(derived, 'INR');

      expect(summary.hasEnoughData).toBe(true);
      expect(summary.totalLogsCount).toBe(2);
      expect(summary.averageMileage).toBe(30);
      expect(summary.totalFuelLitres).toBe(22);
      expect(summary.totalCost).toBe(2220);
      expect(summary.lastFuelPrice).toBe(102);
    });
  });

  describe('Display Formatting', () => {
    test('formats multi-currency values correctly', () => {
      expect(formatDisplayCurrency(1250, 'INR')).toBe('₹1,250.00');
      expect(formatDisplayCurrency(45.5, 'USD')).toBe('$45.50');
      expect(formatDisplayCurrency(32.8, 'EUR')).toBe('€32.80');
      expect(formatDisplayCurrency(28.4, 'GBP')).toBe('£28.40');
    });

    test('formats distance and volume according to unit settings', () => {
      expect(formatDisplayDistance(150, 'km')).toBe('150 km');
      expect(formatDisplayDistance(150, 'mi')).toBe('93 mi');

      expect(formatDisplayVolume(10, 'L')).toBe('10.00 L');
      expect(formatDisplayVolume(10, 'gal')).toBe('2.64 gal');
    });
  });
});
