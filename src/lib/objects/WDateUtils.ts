import {
  addDays,
  addMinutes,
  compareAsc,
  getDay,
  getHours,
  getMinutes,
  isBefore,
  isSameDay,
  formatISO,
  parseISO,
  startOfDay,
  subMinutes
} from 'date-fns';

import { AvailabilityInfoMap, DateIntervalsEntries, DayOfTheWeek, FulfillmentConfig, FulfillmentTime, IWInterval, OperatingHourSpecification } from '../types';

export const ADDITIONAL_PIZZA_LEAD_TIME_TO_DEPRECATE = 5;

/**
 * 
 * @param {IntervalTupleList} intervals - array of IWIntervals
 * @returns {IntervalTupleList} the input intervals array, sorted by interval start time, minimized to the union of the input array
 */
export function ComputeUnionsForIWInterval(intervals: IWInterval[]) {
  const sortedIntervals = intervals.slice().sort(WDateUtils.CompareIWIntervals);
  const interval_unions = intervals.length > 0 ? [sortedIntervals[0]] : [];
  let j = 1;
  let k = 0;
  while (j < sortedIntervals.length) {
    if (interval_unions[k].end >= sortedIntervals[j].start) {
      // union the two intervals into the kth element of interval unions
      interval_unions[k] = { start: interval_unions[k].start, end: Math.max(interval_unions[k].end, sortedIntervals[j].end) };
      j += 1;
    }
    else if (interval_unions[k].end < sortedIntervals[j].start) {
      // intervals do not intersect, add the jth interval to the end of the
      // interval_unions and increment both iterators
      interval_unions.push(sortedIntervals[j]);
      j += 1;
      k += 1;
    }
    else {
      break;
    }
  }
  return interval_unions;
}

/**
 * gets the union of blocked off hours for a given date and the provided services
 * @param {DateIntervalsEntries[]} blockedOffs - the blocked off config for fulfillments we're interested in 
 * @param {String} dateString - the date, in formatISODate
 * @returns the union of blocked off times for all specified services
 */
export function BlockedOffIntervalsForServicesAndDate(blockedOffs: DateIntervalsEntries[], dateString: string) {
  return ComputeUnionsForIWInterval(blockedOffs.reduce((acc: IWInterval[], blockedOff: DateIntervalsEntries) => {
    const foundIntervalsIndex = blockedOff.findIndex(entry => entry.key === dateString);
    return foundIntervalsIndex === -1 ? acc : [...acc, ...blockedOff[foundIntervalsIndex].value];
  }, []));
}

export class WDateUtils {

  static get ISODateTimeNoOffset() {
    return "yyyy-MM-dd'T'HH:mm:ss";
  }

  static get ServiceDateDisplayFormat() {
    return 'EEEE, MMMM dd, yyyy';
  }

  static get DisplayTimeFormat() {
    return "h:mma";
  }

  static formatISODate(d: Date | number) {
    return formatISO(d, { format: 'basic', representation: 'date' });
  }

  static ComputeServiceDateTime(fulfillmentTime: FulfillmentTime) { return subMinutes(addDays(parseISO(fulfillmentTime.selectedDate), 1), 1440 - fulfillmentTime.selectedTime); };

  static MinutesToPrintTime(minutes: number) {
    if (Number.isNaN(minutes) || minutes < 0) {
      return "ERROR";
    }
    const hour = Math.floor(minutes / 60);
    const minute = minutes - (hour * 60);
    const meridian = hour >= 12 ? "PM" : "AM";
    const printHour = (hour % 12 === 0 ? 12 : hour % 12).toString();
    const printMinute = (minute < 10 ? "0" : "").concat(minute.toString());
    return `${printHour}:${printMinute}${meridian}`;
  }

  static CompareIWIntervals(a: IWInterval, b: IWInterval) {
    // compares the starting time of two intervals
    return a.start - b.start;
  };

  static ExtractCompareDate<T>(a: [string, T], b: [string, T]) {
    return compareAsc(parseISO(a[0]), parseISO(b[0]));
  };

  /**
 * 
 * @param {IWInterval[]} a - array of IWInterval, sorted by start
 * @param {IWInterval[]} b - array of IWInterval, sorted by start
 * @param {Number} step - the next available interval step resolution
 * @returns {IWInterval[]} a new array, the set subtraction of intervals a minus b
 */
  static ComputeSubtractionOfIntervalSets(a: IWInterval[], b: IWInterval[], step: number) {
    // if a is empty or there's nothing to subtract, return a
    if (!a.length || !b.length) {
      return a;
    }
    a = a.slice();
    b = b.slice();
    const retval = [];
    let i = 0;
    let j = 0;
    // eslint-disable-next-line no-plusplus
    for (let a_idx = i; a_idx < a.length; ++a_idx) {
      let should_add = true;
      // eslint-disable-next-line no-plusplus
      for (let b_idx = j; b_idx < b.length; ++b_idx) {
        if (a[a_idx].start > b[b_idx].end) { // a is entirely after b 
          // then we don't need to look at b[j] anymore
          // assert: j === b_idx
          j += 1;
          // eslint-disable-next-line no-continue
          continue;
        }
        else { // (a[a_idx][0] <= b[b_idx][1])
          // if b's end time is greater than or equal to a's start time and b's start time is less than or eq to a's end time
          // ... a0 <= b1, b0 <= b1, b0 <= a1, a0 <= a1
          // eslint-disable-next-line no-lonely-if
          if (a[a_idx].end >= b[b_idx].start) {
            // b0 <= a0 <= b1 <= a1
            if (a[a_idx].end >= b[b_idx].start) {
              // case: from the beginning of a's interval, some or all of a is clipped by some or all of b
              // "partial to full eclipse from the beginning"
              if (b[b_idx].end < a[a_idx].end) {
                // case partial eclipse
                a.splice(a_idx, 1, { start: Math.min(b[b_idx].end + step, a[a_idx].end), end: a[a_idx].end });
                ++j;
              }
              else {
                // otherwise full eclipse, no need to add any interval
                ++i;
                should_add = false;
                break;
              }
            }
            else { // ... a0 < b0 <= b1, b0 <= a1, a0 <= a1
              retval.push({ start: a[a_idx].start, end: b[b_idx].start - step });
              // a0 < b0 <= b1 < a1
              if (b[b_idx].end < a[0].end) {
                // bisection
                a.splice(a_idx, 1, { start: b[b_idx].end + step, end: a[a_idx].end });
              }
              else { // b1 === a1
                // otherwise partial eclipse from the end
                // and we've already added the open section
                should_add = false;
                i += 1;
                break;
              }
            }
          }
          else { // a[a_idx][1] < b[b_idx][0]
            // a is entirely before b, we don't need to look at a anymore
            i += 1;
            break;
          }
        }
      }
      if (should_add) {
        retval.push(a[a_idx]);
      }
    }
    return retval;
  }

  /**
   * gets the union of operating hours for a given day and the provided services
   * @param {{ operatingHours: OperatingHourSpecification; specialHours: DateIntervalsEntries; }[]} config - operating hour and special hour override configuration
   * @param {string} isoDate - YYYYMMDD string of when we're looking for hours
   * @param {Number} day_index - the day of the week, 0 = sunday // consider using something like differenceInDays(previousSunday(isoDate), isoDate)
   * @returns 
   */
  static GetOperatingHoursForServicesAndDate(
    configs: {
      operatingHours: OperatingHourSpecification;
      specialHours: DateIntervalsEntries;
    }[],
    isoDate: string,
    day_index: DayOfTheWeek) {
    const allHours = configs.reduce((acc, config) => {
      const specialHoursForDateIndex = config.specialHours.findIndex(x => x.key === isoDate);
      return acc.concat(specialHoursForDateIndex !== -1 ? config.specialHours[specialHoursForDateIndex].value : config.operatingHours[day_index]);
    }, [] as IWInterval[]);

    return ComputeUnionsForIWInterval(allHours);
  }

  static HandleBlockedOffTime(blockedOffIntervals: IWInterval[], operatingIntervals: IWInterval[], start: number, step: number) {
    let pushed_time = start;
    for (let op_idx = 0; op_idx < operatingIntervals.length; ++op_idx) {
      if (pushed_time < operatingIntervals[op_idx].start) {
        pushed_time = operatingIntervals[op_idx].start;
      }
      // if the time we're looking at is in the current operating time interval...
      if (operatingIntervals[op_idx].end >= pushed_time && operatingIntervals[op_idx].start <= pushed_time) {
        for (let bo_idx = 0; bo_idx < blockedOffIntervals.length; ++bo_idx) {
          if (blockedOffIntervals[bo_idx].end >= pushed_time && blockedOffIntervals[bo_idx].start <= pushed_time) {
            pushed_time = blockedOffIntervals[bo_idx].end + step;
          }
        }
        if (pushed_time > operatingIntervals[op_idx].end) {
          // this means we found a time in the current operating interval that wasn't blocked off
          break;
        }
      }
    }
    // check if we've gone past the last operating interval before returning a value
    return pushed_time > operatingIntervals[operatingIntervals.length - 1].end ? -1 : pushed_time;
  }

  static GetInfoMapForAvailabilityComputation(configs: FulfillmentConfig[], date: string, stuff_to_depreciate_map: { cart_based_lead_time: number; size: number; }) {
    const jsDate = parseISO(date);
    const isoDate = WDateUtils.formatISODate(jsDate);
    const blockedOffUnion = BlockedOffIntervalsForServicesAndDate(configs.map(x => x.blockedOff), isoDate);
    const operatingIntervals = WDateUtils.GetOperatingHoursForServicesAndDate(configs, isoDate, getDay(jsDate));
    const minTimeStep = Math.min(...configs.map(config => config.timeStep));
    const minLeadTime = Math.min(...configs.map(config => config.leadTime));
    const order_size = Math.max(stuff_to_depreciate_map.size, 1);
    const cart_based_lead_time = Object.hasOwn(stuff_to_depreciate_map, "cart_based_lead_time") ? stuff_to_depreciate_map.cart_based_lead_time : 0;
    // cart_based_lead_time and service/size lead time don't stack
    const leadTime = Math.max(minLeadTime + ((order_size - 1) * ADDITIONAL_PIZZA_LEAD_TIME_TO_DEPRECATE), cart_based_lead_time);
    return { blockedOffUnion, operatingIntervals, minTimeStep, leadTime } as AvailabilityInfoMap;
  }

  /**
   * Gets an array of Objects containing information for WCPReactConfig's blocked off
   * select widget
   * @param INFO - as computed by GetInfoMapForAvailabilityComputation
   * @param date - ISO string of date to find the first available time for
   * @param currently - ISO string of the current date and time according to dog (the server, whatever)
   * @returns {[{value: Number, disabled: Boolean}]}
   */
  static GetOptionsForDate(INFO: AvailabilityInfoMap, date: string, currently: string) {
    let earliest_time = WDateUtils.ComputeFirstAvailableTimeForDate(INFO, date, currently);
    if (earliest_time === -1) {
      return [];
    }
    const retval = [];
    for (let i = 0; i < INFO.operatingIntervals.length; ++i) {
      earliest_time = Math.max(INFO.operatingIntervals[i].start, earliest_time);
      while (earliest_time <= INFO.operatingIntervals[i].end && earliest_time !== -1) {
        retval.push({ value: earliest_time, disabled: false });
        earliest_time = WDateUtils.HandleBlockedOffTime(INFO.blockedOffUnion, INFO.operatingIntervals, earliest_time + INFO.minTimeStep, INFO.minTimeStep);
      }
    }
    return retval;
  }

  /**
   * @param {AvailabilityInfoMap} INFO - as computed by GetInfoMapForAvailabilityComputation  
   * @param date - isoDate to find the first available time for
   * @param currently - ISO string of the current date and time according to dog (the server, whatever)
   * @returns the first available time in minutes from the start of the day (not taking into account DST), or -1 if no time is available
   */
  static ComputeFirstAvailableTimeForDate(INFO: AvailabilityInfoMap, date: string, currently: string) {
    if (INFO.operatingIntervals.length === 0) {
      return -1;
    }
    const jsDate = parseISO(date);
    const currentTimePlusLeadTime = addMinutes(parseISO(currently), INFO.leadTime);
    if (isSameDay(jsDate, currentTimePlusLeadTime)) {
      // NOTE: this doesn't work if we have active hours during a DST change
      const currentTimePlusLeadTimeMinsFromStartOfDay = getHours(currentTimePlusLeadTime) * 60 + getMinutes(currentTimePlusLeadTime);
      if (currentTimePlusLeadTimeMinsFromStartOfDay > INFO.operatingIntervals[0].start) {
        const clamped_start = Math.ceil((currentTimePlusLeadTimeMinsFromStartOfDay) / INFO.minTimeStep) * INFO.minTimeStep;
        return WDateUtils.HandleBlockedOffTime(INFO.blockedOffUnion, INFO.operatingIntervals, clamped_start, INFO.minTimeStep);
      }
    }

    if (isBefore(jsDate, startOfDay(currentTimePlusLeadTime))) {
      // if we don't have any operating hours for the day or
      // if by adding the lead time we've passed the date we're looking for
      return -1;
    }

    return WDateUtils.HandleBlockedOffTime(INFO.blockedOffUnion, INFO.operatingIntervals, INFO.operatingIntervals[0].start, INFO.minTimeStep);
  }


  // Adds the interval to the operating hours interval map.
  // This map differs slightly from the map used by blocked off times
  // This method makes a deep-enough copy for use by ReactJS
  static AddIntervalToOperatingHours(day_index: DayOfTheWeek, interval: IWInterval, operatingHours: OperatingHourSpecification): OperatingHourSpecification {
    return { ...operatingHours, [day_index]: ComputeUnionsForIWInterval([...operatingHours[day_index], interval]) };
  }

  static AddIntervalToDate(interval: IWInterval, isoDate: string, dateIntervalsMap: DateIntervalsEntries): DateIntervalsEntries {
    const foundIntervalEntryIndex = dateIntervalsMap.findIndex(x => x.key === isoDate);
    return foundIntervalEntryIndex !== -1 ?
      [...dateIntervalsMap.slice(0, foundIntervalEntryIndex),
      { key: isoDate, value: [...dateIntervalsMap[foundIntervalEntryIndex].value, interval].sort(WDateUtils.CompareIWIntervals) },
      ...dateIntervalsMap.slice(foundIntervalEntryIndex + 1)] :
      [...dateIntervalsMap, { key: isoDate, value: [interval] }].sort((a, b) => compareAsc(parseISO(a.key), parseISO(b.key)));
  }

  static SubtractIntervalFromDate(interval: IWInterval, isoDate: string, dateIntervalsMap: DateIntervalsEntries, timeStep: number): DateIntervalsEntries {
    const foundIntervalEntryIndex = dateIntervalsMap.findIndex(x => x.key === isoDate);
    if (foundIntervalEntryIndex !== -1) {
      const subtraction = WDateUtils.ComputeSubtractionOfIntervalSets(dateIntervalsMap[foundIntervalEntryIndex].value, [interval], timeStep);
      const retval = [...dateIntervalsMap];
      if (subtraction.length > 0) {
        retval[foundIntervalEntryIndex].value = subtraction;
      } else {
        retval.splice(foundIntervalEntryIndex, 1);
      }
      return retval;
    }
    return dateIntervalsMap;
  }

  /**
   * Determines if there's any hours specified for a particular service
   */
  static HasOperatingHours(operatingHours: OperatingHourSpecification) {
    return Object.values(operatingHours).reduce((acc, dayIntervals) => acc || dayIntervals.some(v => v.start < v.end && v.start >= 0 && v.end <= 1440), false)
  }
}

export const HasOperatingHoursForFulfillments = (fulfillmentConfigs: FulfillmentConfig[]) =>
  fulfillmentConfigs.reduce((acc, fulfillment) => acc || WDateUtils.HasOperatingHours(fulfillment.operatingHours), false);

/**
 * @param {FulfillmentConfig[]} fulfillmentConfigs map of the fulfillments we're interested in  
 * @param now - ISO string of the current date and time according to dog (the server, whatever)
 */
export const GetNextAvailableServiceDate = (fulfillmentConfigs: FulfillmentConfig[], orderSize: number, now: string): [string, number] | null => {
  if (!HasOperatingHoursForFulfillments(fulfillmentConfigs)) {
    return null;
  }
  let dateAttempted = startOfDay(parseISO(now));

  while (1) {
    const isoDate = WDateUtils.formatISODate(dateAttempted);
    const INFO = WDateUtils.GetInfoMapForAvailabilityComputation(fulfillmentConfigs, isoDate, { cart_based_lead_time: 0, size: orderSize });
    const firstAvailableTime = WDateUtils.ComputeFirstAvailableTimeForDate(INFO, isoDate, now);
    if (firstAvailableTime !== -1) {
      return [isoDate, firstAvailableTime];
    }
    dateAttempted = addDays(dateAttempted, 1);
  }
  return null;
}

export default WDateUtils;