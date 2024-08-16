import { expect, test } from '@jest/globals';
import { DisableDataCheck, DISABLE_REASON, IWInterval, IRecurringInterval, WDateUtils } from '../src/';
import { addHours, getTime, subHours } from 'date-fns';

test('DisableDataCheck: should return ENABLED when disable_data is null and availabilities is empty', () => {
  const result = DisableDataCheck(null, [], new Date());
  expect(result).toEqual({ enable: DISABLE_REASON.ENABLED });
});

test('DisableDataCheck: should return DISABLED_BLANKET when disable_data start is greater than end', () => {
  const disableData: IWInterval = { start: getTime(new Date('2023-01-01T10:00:00Z')), end: getTime(new Date('2023-01-01T09:00:00Z')) };
  const result = DisableDataCheck(disableData, [], new Date());
  expect(result).toEqual({ enable: DISABLE_REASON.DISABLED_BLANKET });
});

test('DisableDataCheck: should return DISABLED_TIME when disable_data is within the order time', () => {
  const orderTime = new Date('2023-01-01T10:00:00Z');
  const disableData: IWInterval = { start: getTime(orderTime) - 1000, end: getTime(orderTime) + 1000 };
  const result = DisableDataCheck(disableData, [], orderTime);
  expect(result).toEqual({ enable: DISABLE_REASON.DISABLED_TIME, interval: disableData });
});

test('DisableDataCheck: should return ENABLED when availabilities has a matching recurring rule', () => {
  const orderTime = new Date('2023-01-01T10:00:00Z');
  const availabilities: IRecurringInterval[] = [{
    rrule: 'FREQ=DAILY;INTERVAL=1',
    interval: { start: WDateUtils.ComputeFulfillmentTime(addHours(orderTime, 2)).selectedTime, end: WDateUtils.ComputeFulfillmentTime(addHours(orderTime, 3)).selectedTime }
  }, {
    rrule: 'FREQ=DAILY;INTERVAL=1',
    interval: { start: WDateUtils.ComputeFulfillmentTime(subHours(orderTime, 2)).selectedTime, end: WDateUtils.ComputeFulfillmentTime(addHours(orderTime, 2)).selectedTime }
  }];
  const result = DisableDataCheck(null, availabilities, orderTime);
  expect(result).toEqual({ enable: DISABLE_REASON.ENABLED });
});

test('DisableDataCheck: should return DISABLED_AVAILABILITY when availabilities does not match the order time', () => {
  const orderTime = new Date('2023-01-01T10:00:00Z');
  const availabilities: IRecurringInterval[] = [{
    rrule: 'FREQ=DAILY;INTERVAL=1',
    interval: { start: WDateUtils.ComputeFulfillmentTime(addHours(orderTime, 2)).selectedTime, end: WDateUtils.ComputeFulfillmentTime(addHours(orderTime, 3)).selectedTime }
  }];
  const result = DisableDataCheck(null, availabilities, orderTime);
  expect(result).toEqual({ enable: DISABLE_REASON.DISABLED_AVAILABILITY, availability: availabilities });
});

test('DisableDataCheck: should return ENABLED when availability has a match for a non-rrule availability', () => {
  const orderTime = new Date(1723770000000);
  const availabilities: IRecurringInterval[] = [{
    rrule: '',
    interval: { start: 1723705200000, end: 1723788000000 }
  }];
  const result = DisableDataCheck(null, availabilities, orderTime);
  expect(result).toEqual({ enable: DISABLE_REASON.ENABLED });
});