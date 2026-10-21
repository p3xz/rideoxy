jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-docs/',
  cacheDirectory: 'file:///mock-cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

import {
  formatGarageDistance,
  resolveMotorcycleOdometerKm,
  persistBikePhotoFile,
  deleteBikePhotoFile,
  GarageMotorcycle,
} from '../components/garage/garageStorage';
import { formatHeroSpecs } from '../components/garage/GarageHero';
import { formatCardSpecs } from '../components/garage/GarageMotorcyclesSection';
import * as FileSystem from 'expo-file-system/legacy';

describe('Garage Storage, Photo System & Formatting Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('formatGarageDistance formats zero, small decimals, and large thousands accurately', () => {
    expect(formatGarageDistance(0)).toBe('0');
    expect(formatGarageDistance(-5)).toBe('0');
    expect(formatGarageDistance(2.6)).toBe('2.6');
    expect(formatGarageDistance(48)).toBe('48');
    expect(formatGarageDistance(12480)).toBe('12,480');
  });

  test('resolveMotorcycleOdometerKm resolves honest odometer values without inventing data', () => {
    const bike: GarageMotorcycle = {
      id: 'default',
      name: 'Royal Enfield Himalayan 450',
      category: 'Adventure',
      engineCc: 452,
      odometerKm: 3200,
      purchaseDate: 'Mar 2024',
      photo_uri: 'file:///mock-docs/bikes/default.jpg',
      isDefault: true,
      createdAt: 1000,
    };

    expect(resolveMotorcycleOdometerKm(bike, null, 120)).toBe(3200);
    expect(resolveMotorcycleOdometerKm(bike, 3450, 120)).toBe(3450);

    const bikeWithoutOdo: GarageMotorcycle = {
      ...bike,
      odometerKm: null,
    };
    expect(resolveMotorcycleOdometerKm(bikeWithoutOdo, null, 42.5)).toBe(42.5);
    expect(resolveMotorcycleOdometerKm(bikeWithoutOdo, null, 0)).toBeNull();
    expect(resolveMotorcycleOdometerKm(null, null, 0)).toBeNull();
  });

  test('formatHeroSpecs and formatCardSpecs format honest specifications', () => {
    const fullBike: GarageMotorcycle = {
      id: 'default',
      name: 'Royal Enfield Himalayan 450',
      category: 'Adventure',
      engineCc: 452,
      isDefault: true,
      createdAt: 1000,
    };

    expect(formatHeroSpecs(fullBike)).toBe('Adventure • 452 cc');
    expect(formatCardSpecs(fullBike)).toBe('452 cc • Adventure');

    const nameOnlyBike: GarageMotorcycle = {
      id: 'b2',
      name: 'Triumph Speed 400',
      isDefault: false,
      createdAt: 2000,
    };

    expect(formatHeroSpecs(nameOnlyBike)).toBe('Specs not set • Tap View Details');
    expect(formatCardSpecs(nameOnlyBike)).toBe('Tap to add engine & category');
    expect(formatHeroSpecs(null)).toBe('Register your motorcycle below');
  });

  test('persistBikePhotoFile copies photo to documentDirectory/bikes/<id>.jpg and deletes previous file', async () => {
    const savedUri = await persistBikePhotoFile(
      'bike_123',
      'file:///cache/picked.jpg',
      'file:///mock-docs/bikes/old.jpg'
    );

    expect(savedUri).toBe('file:///mock-docs/bikes/bike_123.jpg');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///mock-docs/bikes/old.jpg',
      { idempotent: true }
    );
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/picked.jpg',
      to: 'file:///mock-docs/bikes/bike_123.jpg',
    });
  });

  test('deleteBikePhotoFile removes photo file idempotently', async () => {
    await deleteBikePhotoFile('file:///mock-docs/bikes/bike_123.jpg');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///mock-docs/bikes/bike_123.jpg',
      { idempotent: true }
    );
  });
});
