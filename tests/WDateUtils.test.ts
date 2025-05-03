import { WDateUtils } from '../src/lib/objects/WDateUtils';
import { DayOfTheWeek } from '../src';
import { describe, expect, it } from '@jest/globals';

describe('WDateUtils.AreWeOpenNow', () => {
  it('should return true if the current time is within operating hours', () => {
    const configs = [
      {
        operatingHours: {
          [DayOfTheWeek.SUNDAY]: [],
          [DayOfTheWeek.MONDAY]: [],
          [DayOfTheWeek.TUESDAY]: [],
          [DayOfTheWeek.WEDNESDAY]: [{ start: 480, end: 1020 }], // 8:00 AM to 5:00 PM
          [DayOfTheWeek.THURSDAY]: [],
          [DayOfTheWeek.FRIDAY]: [],
          [DayOfTheWeek.SATURDAY]: [],
        },
        specialHours: [],
      },
    ];
    const now = new Date('2023-03-15T10:00:00'); // Wednesday, 10:00 AM
    expect(WDateUtils.AreWeOpenNow(configs, now)).toBe(true);
  });

  it('should return false if the current time is outside operating hours', () => {
    const configs = [
      {
        operatingHours: {
          [DayOfTheWeek.SUNDAY]: [],
          [DayOfTheWeek.MONDAY]: [],
          [DayOfTheWeek.TUESDAY]: [],
          [DayOfTheWeek.WEDNESDAY]: [{ start: 480, end: 1020 }], // 8:00 AM to 5:00 PM
          [DayOfTheWeek.THURSDAY]: [],
          [DayOfTheWeek.FRIDAY]: [],
          [DayOfTheWeek.SATURDAY]: [],
        },
        specialHours: [],
      },
    ];
    const now = new Date('2023-03-15T06:00:00'); // Wednesday, 6:00 AM
    expect(WDateUtils.AreWeOpenNow(configs, now)).toBe(false);
  });

  it('should return true if the current time is within special hours', () => {
    const configs = [
      {
        operatingHours: {
          [DayOfTheWeek.SUNDAY]: [],
          [DayOfTheWeek.MONDAY]: [],
          [DayOfTheWeek.TUESDAY]: [],
          [DayOfTheWeek.WEDNESDAY]: [{ start: 480, end: 1020 }], //
          [DayOfTheWeek.THURSDAY]: [],
          [DayOfTheWeek.FRIDAY]: [],
          [DayOfTheWeek.SATURDAY]: [],
        },
        specialHours: [
          { key: '2023-03-15', value: [{ start: 600, end: 1200 }] }, // Special hours for March 15
        ],
      },
    ];
    const now = new Date('2023-03-15T11:00:00'); // Wednesday, 11:00 AM
    expect(WDateUtils.AreWeOpenNow(configs, now)).toBe(true);
  });

  it('should return false if there are no operating or special hours for the current time', () => {
    const configs = [
      {
        operatingHours: {
          [DayOfTheWeek.SUNDAY]: [],
          [DayOfTheWeek.MONDAY]: [],
          [DayOfTheWeek.TUESDAY]: [],
          [DayOfTheWeek.WEDNESDAY]: [],
          [DayOfTheWeek.THURSDAY]: [],
          [DayOfTheWeek.FRIDAY]: [],
          [DayOfTheWeek.SATURDAY]: [],
        },
        specialHours: [],
      },
    ];
    const now = new Date('2023-03-15T10:00:00'); // Wednesday, 10:00 AM
    expect(WDateUtils.AreWeOpenNow(configs, now)).toBe(false);
  });

  it('should handle edge cases where the current time is exactly at the start of an interval', () => {
    const configs = [
      {
        operatingHours: {
          [DayOfTheWeek.SUNDAY]: [],
          [DayOfTheWeek.MONDAY]: [],
          [DayOfTheWeek.TUESDAY]: [],
          [DayOfTheWeek.WEDNESDAY]: [{ start: 480, end: 1020 }], // 8:00 AM to 5:00 PM
          [DayOfTheWeek.THURSDAY]: [],
          [DayOfTheWeek.FRIDAY]: [],
          [DayOfTheWeek.SATURDAY]: [],
        },
        specialHours: [],
      },
    ];
    const now = new Date('2023-03-15T08:00:00'); // Wednesday, 8:00 AM
    expect(WDateUtils.AreWeOpenNow(configs, now)).toBe(true);
  });

  it('should handle edge cases where the current time is exactly at the end of an interval', () => {
    const configs = [
      {
        operatingHours: {
          [DayOfTheWeek.SUNDAY]: [],
          [DayOfTheWeek.MONDAY]: [],
          [DayOfTheWeek.TUESDAY]: [],
          [DayOfTheWeek.WEDNESDAY]: [{ start: 480, end: 1020 }], // 8:00 AM to 5:00 PM
          [DayOfTheWeek.THURSDAY]: [],
          [DayOfTheWeek.FRIDAY]: [],
          [DayOfTheWeek.SATURDAY]: [],
        },
        specialHours: [],
      },
    ];
    const now = new Date('2023-03-15T17:00:00'); // Wednesday, 5:00 PM
    expect(WDateUtils.AreWeOpenNow(configs, now)).toBe(true);
  });
});