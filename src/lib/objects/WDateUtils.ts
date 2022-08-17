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

import { AvailabilityInfoMap, DayIndex, FulfillmentConfig, FulfillmentConfigMap, IntervalTupleList, IWInterval, JSFEBlockedOff, OperatingHoursList, WIntervalTuple } from '../types';

export const ADDITIONAL_PIZZA_LEAD_TIME_TO_DEPRECATE = 5;

/**
 * 
 * @param {IntervalTupleList} intervals - array of IWIntervals
 * @returns {IntervalTupleList} the input intervals array, sorted by interval start time, minimized to the union of the input array
 */
export function ComputeUnionsForIWInterval(intervals: IWInterval[]) {
  const sortedIntervals = intervals.slice().sort(WDateUtils.CompareIWIntervals);
  const interval_unions = [sortedIntervals[0]];
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
 * @param {Record<string, Pick<FulfillmentConfig, 'blockedOff'>>} config - the blocked off config 
 * @param {string[]} services - list of fulfillment IDs we're interested in
 * @param {String} dateString - the date, in formatISODate
 * @returns the union of blocked off times for all specified services
 */
export function BlockedOffIntervalsForServicesAndDate(config: Record<string, Pick<FulfillmentConfig, 'blockedOff'>>, services: string[], dateString: string) {
  return ComputeUnionsForIWInterval(
    services.reduce(
      (acc: IWInterval[], fId) =>
        Object.hasOwn(config[fId].blockedOff, dateString) ? [...acc, ...config[fId].blockedOff[dateString]] : acc, []));
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

  static ComputeServiceDateTime(selectedDate: string, selectedTime: number) { return subMinutes(addDays(parseISO(selectedDate), 1), 1440 - selectedTime); };

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

  static CompareIntervals(a: WIntervalTuple, b: WIntervalTuple) {
    // compares the starting time of two intervals
    return a[0] - b[0];
  };

  static CompareIWIntervals(a: IWInterval, b: IWInterval) {
    // compares the starting time of two intervals
    return a.start - b.start;
  };

  static ExtractCompareDate(a: [string, IntervalTupleList], b: [string, IntervalTupleList]) {
    return compareAsc(parseISO(a[0]), parseISO(b[0]));
  };

  /**
   * 
   * @param {IntervalTupleList} intervals - array of length 2 arrays of Numbers
   * @returns {IntervalTupleList} the input intervals array, sorted by interval start time, minimized to the union of the input array
   */
  static ComputeUnionsForIntervals(intervals: IntervalTupleList) {
    // todo: maybe shallow copy this array?
    intervals.sort(WDateUtils.CompareIntervals);
    const interval_unions = [intervals[0]];
    let j = 1;
    let k = 0;
    while (j < intervals.length) {
      if (interval_unions[k][1] >= intervals[j][0]) {
        // union the two intervals into the kth element of interval unions
        interval_unions[k] = [interval_unions[k][0], Math.max(interval_unions[k][1], intervals[j][1])];
        j += 1;
      }
      else if (interval_unions[k][1] < intervals[j][0]) {
        // intervals do not intersect, add the jth interval to the end of the
        // interval_unions and increment both iterators
        interval_unions.push(intervals[j]);
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
 * 
 * @param {IntervalTupleList} a - array of length 2 arrays of Numbers, sorted by start
 * @param {IntervalTupleList} b - array of length 2 arrays of Numbers, sorted by start
 * @param {Number} step - the next available interval step resolution
 * @returns {IntervalTupleList} a new array, the set subtraction of intervals a minus b
 */
  static ComputeSubtractionOfIntervalSets(a: IntervalTupleList, b: IntervalTupleList, step: number) {
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
        if (a[a_idx][0] > b[b_idx][1]) { // a is entirely after b 
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
          if (a[a_idx][1] >= b[b_idx][0]) {
            // b0 <= a0 <= b1 <= a1
            if (a[a_idx][0] >= b[b_idx][0]) {
              // case: from the beginning of a's interval, some or all of a is clipped by some or all of b
              // "partial to full eclipse from the beginning"
              if (b[b_idx][1] < a[a_idx][1]) {
                // case partial eclipse
                a.splice(a_idx, 1, [Math.min(b[b_idx][1] + step, a[a_idx][1]), a[a_idx][1]]);
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
              retval.push([a[a_idx][0], b[b_idx][0] - step]);
              // a0 < b0 <= b1 < a1
              if (b[b_idx][1] < a[0][1]) {
                // bisection
                a.splice(a_idx, 1, [b[b_idx][1] + step, a[a_idx][1]]);
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
   * @param {Record<string, Pick<FulfillmentConfig, 'operatingHours'>>} config - operating hour configuration
   * @param {string[]} fulfillments - list of fulfillmentIds
   * @param {Number} day_index - the day of the week, 0 = sunday // consider using something like differenceInDays(previousSunday(now), now)
   * @returns 
   */
  static GetOperatingHoursForServicesAndDayISTHISUSED(config: Record<string, Pick<FulfillmentConfig, 'operatingHours'>>, fulfillments: string[], day_index: DayIndex) {
    const allHours = fulfillments.reduce((acc, fId) => acc.concat(config[fId].operatingHours[day_index]), [] as IWInterval[]);
    return ComputeUnionsForIWInterval(allHours);
  }

  /**
   * gets the union of operating hours for a given day and the provided services
   * @param {Record<string, Pick<FulfillmentConfig, 'operatingHours' | 'specialHours'>>} config - operating hour and special hour override configuration
   * @param {string[]} fulfillments - list of fulfillmentIds
   * @param {Number} day_index - the day of the week, 0 = sunday // consider using something like differenceInDays(previousSunday(now), now)
   * @returns 
   */
  static GetOperatingHoursForServicesAndDate(
    config: Record<string, Pick<FulfillmentConfig, 'operatingHours' | 'specialHours'>>,
    fulfillments: string[],
    isoDate: string,
    day_index: DayIndex) {
    const allHours = fulfillments.reduce((acc, fId) => {
      const fulfillmentConfig = config[fId];
      return acc.concat(Object.hasOwn(fulfillmentConfig.specialHours, isoDate) ? fulfillmentConfig.specialHours[isoDate] : config[fId].operatingHours[day_index]);
    }, [] as IWInterval[]);

    return ComputeUnionsForIWInterval(allHours);
  }

  /**
   * Computes a list of operating times available from the operating ranges
   */
  static GetOperatingTimesForDate(operating_ranges: IntervalTupleList, step: number, lead_time_min: number) {
    const retval: number[] = [];
    operating_ranges.forEach((range) => {
      let earliest = Math.max(lead_time_min, range[0]);
      while (earliest <= range[1]) {
        retval.push(earliest);
        earliest += step;
      }
    });
    return retval;
  }

  static HandleBlockedOffTime(blocked_off_intervals: IWInterval[], operatingIntervals: IWInterval[], start: number, step: number) {
    let pushed_time = start;
    for (let op_idx = 0; op_idx < operatingIntervals.length; ++op_idx) {
      if (pushed_time < operatingIntervals[op_idx].start) {
        pushed_time = operatingIntervals[op_idx].start;
      }
      // if the time we're looking at is in the current operating time interval...
      if (operatingIntervals[op_idx].end >= pushed_time && operatingIntervals[op_idx].start <= pushed_time) {
        for (let bo_idx = 0; bo_idx < blocked_off_intervals.length; ++bo_idx) {
          if (blocked_off_intervals[bo_idx].end >= pushed_time && blocked_off_intervals[bo_idx].start <= pushed_time) {
            pushed_time = blocked_off_intervals[bo_idx].end + step;
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

  static GetInfoMapForAvailabilityComputation(config: FulfillmentConfigMap, date: string, services: string[], stuff_to_depreciate_map: { cart_based_lead_time: number; size: number; }) {
    const jsDate = parseISO(date);
    const isoDate = WDateUtils.formatISODate(jsDate);
    const blockedOffUnion = BlockedOffIntervalsForServicesAndDate(config, services, isoDate);
    const operatingIntervals = WDateUtils.GetOperatingHoursForServicesAndDate(config, services, isoDate, getDay(jsDate));
    const minTimeStep = Math.min(...services.map(fId => config[fId].timeStep));
    const minLeadTime = Math.min(...services.map(fId => config[fId].leadTime));
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
   * @param date - date to find the first available time for
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
  static AddIntervalToOperatingHours(service_index: number, day_index: number, interval: WIntervalTuple, new_interval_map: OperatingHoursList[]) {
    const operating_hours = new_interval_map[service_index][day_index].slice();
    operating_hours.push(interval);
    new_interval_map[service_index][day_index] = WDateUtils.ComputeUnionsForIntervals(operating_hours);
  }

  // Removes the interval from the operating hours interval map.
  // This map differs slightly from the map used by blocked off times
  // This method makes a deep-enough copy for use by ReactJS
  static RemoveIntervalFromOperatingHours(service_index: number, day_index: number, interval_index: number, interval_map: OperatingHoursList[]) {
    const new_interval_map = interval_map.slice();
    const new_interval_map_for_service = interval_map[service_index].slice() as OperatingHoursList;
    const new_interval_map_for_day = new_interval_map_for_service[day_index].slice();
    new_interval_map_for_day.splice(interval_index, 1);
    new_interval_map_for_service[day_index] = new_interval_map_for_day;
    new_interval_map[service_index] = new_interval_map_for_service;
    return new_interval_map;
  }

  /**
   * Creates a ReactJS safe object copy of the BlockedOff interval map array with
   * interval_map[service_index][day_index][1][interval_index] element removed
   * NOTE: when we stop using socketIo to update blocked off times, this will not be a useful function
   * and we'll want to replace it with a specific interval to remove from a service and date's blocked off array
   * @param {Number} service_index 
   * @param {Number} day_index 
   * @param {Number} interval_index 
   * @param {BLOCKED_OFF_WIRE_FORMAT} interval_map
   * @returns an updated interval_map
   */
  static RemoveIntervalFromBlockedOffWireFormat(service_index: number, day_index: number, interval_index: number, interval_map: JSFEBlockedOff) {
    const new_interval_map = interval_map.slice();
    const new_interval_map_for_service = new_interval_map[service_index].slice();
    const new_interval_map_for_intervals = new_interval_map_for_service[day_index][1].slice();
    new_interval_map_for_intervals.splice(interval_index, 1);
    new_interval_map_for_service[day_index] = [new_interval_map_for_service[day_index][0], new_interval_map_for_intervals];
    if (new_interval_map_for_intervals.length === 0) {
      new_interval_map_for_service.splice(day_index, 1);
    }
    new_interval_map[service_index] = new_interval_map_for_service;
    return new_interval_map;
  }

  static AddIntervalToService(service_index: number, parsed_date: string, interval: WIntervalTuple, new_interval_map: JSFEBlockedOff) {
    for (const [date_index, _] of new_interval_map[service_index].entries()) {
      if (parsed_date === new_interval_map[service_index][date_index][0]) {
        const new_interval_map_for_service_and_day = new_interval_map[service_index][date_index][1].slice();
        new_interval_map_for_service_and_day.push(interval);
        new_interval_map_for_service_and_day.sort(WDateUtils.CompareIntervals);
        new_interval_map[service_index][date_index] = [new_interval_map[service_index][date_index][0], new_interval_map_for_service_and_day];
        return;
      }
    }
    const new_interval_map_for_service = new_interval_map[service_index].slice();
    new_interval_map_for_service.push([parsed_date, [interval]]);
    new_interval_map_for_service.sort(WDateUtils.ExtractCompareDate);
    new_interval_map[service_index] = new_interval_map_for_service;
  }

  static RemoveInterval(service_index: number, day_index: DayIndex, interval_index: number, interval_map: JSFEBlockedOff) {
    const new_interval_map = interval_map.slice();
    const new_interval_map_for_service = new_interval_map[service_index].slice();
    const new_interval_map_for_intervals = new_interval_map_for_service[day_index][1].slice();
    new_interval_map_for_intervals.splice(interval_index, 1);
    new_interval_map_for_service[day_index] = [new_interval_map_for_service[day_index][0], new_interval_map_for_intervals];
    if (new_interval_map_for_intervals.length === 0) {
      new_interval_map_for_service.splice(day_index, 1);
    }
    new_interval_map[service_index] = new_interval_map_for_service;
    return new_interval_map;
  }

  /**
   * Determines if there's any hours for a particular service
   */
  static HasOperatingHoursForService(SERVICES: Record<string, string>, OPERATING_HOURS: OperatingHoursList[], serviceNumber: number) {
    return Object.hasOwn(SERVICES, String(serviceNumber)) &&
      serviceNumber < OPERATING_HOURS.length &&
      OPERATING_HOURS[serviceNumber].reduce((acc, dayIntervals) => acc || dayIntervals.some(v => v[0] < v[1] && v[0] >= 0 && v[1] <= 1440), false)
  }

  // // TODO: move to WCPShared
  // static ComputeNextAvailableServiceDateTimeForService(serviceHasAnyOperatingHours: boolean, (testDate: Date | number) => {
  //   value: number;
  //   disabled: boolean;
  // }[]) = createSelector(
  //   (s: RootState, service: number, _: Date | number) => SelectHasOperatingHoursForService(s, service),
  //   (s: RootState, service: number, _: Date | number) => (testDate: Date | number) => SelectOptionsForServicesAndDate(s, testDate, { [service]: true }).filter(x => x.disabled),
  //   (_: RootState, __: number, now: Date | number) => now,
  //   (operatingHoursForService, selectOptionsFunction, now) => {
  //     const today = startOfDay(now);
  //     if (operatingHoursForService) {
  //       for (let i = 0; i < 7; ++i) {
  //         const dateAttempted = addDays(today, i);
  //         const options = selectOptionsFunction(addDays(today, i));
  //         if (options.length > 0) {
  //           return ComputeServiceDateTime(dateAttempted, options[0].value);
  //         }
  //       }
  //     }
  //     return null;
  //   })

  // // TODO: move to WCPShared
  // // Note: this falls back to now if there's really nothing for the selected service or for dine-in
  // static GetNextAvailableServiceDateTime = createSelector(
  //     (s: RootState, now: Date | number) => (service: number) => GetNextAvailableServiceDateTimeForService(s, service, now),
  //     (s: RootState, _: Date | number) => s.fulfillment.selectedService,
  //     (_: RootState, now: Date | number) => now,
  //     (nextAvailableForServiceFunction, selectedService, now) => {
  //       if (selectedService !== null) {
  //         const nextAvailableForSelectedService = nextAvailableForServiceFunction(selectedService);
  //         if (nextAvailableForSelectedService) {
  //           return nextAvailableForSelectedService;
  //         }
  //       }
  //       return nextAvailableForServiceFunction(1) ?? now
  //     });

}

export default WDateUtils;