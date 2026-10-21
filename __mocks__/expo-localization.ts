export const getLocales = jest.fn(() => [
  {
    languageTag: 'en-US',
    languageCode: 'en',
    textDirection: 'ltr',
    digitGroupingSeparator: ',',
    decimalSeparator: '.',
    measurementSystem: 'metric',
    currencyCode: 'USD',
    currencySymbol: '$',
    regionCode: 'US',
  },
]);

export const getCalendars = jest.fn(() => [
  {
    calendar: 'gregory',
    timeZone: 'UTC',
    uses24hourClock: false,
    firstWeekday: 1,
  },
]);
