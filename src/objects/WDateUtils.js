import moment from 'moment';

/**
 * A mapping from Service index, exclusion date to a list of excluded intervals
 * @typedef  {{service: Number, exclusion_date: String, excluded_intervals: [{start:Number, end:Number}] }} BlockedOffIntervalMap
 */

/**
 * @typedef {[[[[[]]]]]} BLOCKED_OFF_WIRE_FORMAT - is stored in the memory/wire format here of:
 * [service_index][<String, [<start, end>]>], 
 *  meaning an array indexed by service_index of...
 * ... an array of two-tuples ...
 * ... whose 0th element is the string representation of the date, and whose 1th element is a list of interval tuples
 */


/**
 * @typedef {{blocked_off_union: [[Number]], operating_intervals: [[Number]], leadtime: Number, min_time_step: Number}} AVAILABILITY_INFO_MAP - an object containing...
 * ...blocked_off_union - the union of blocked off times for the services specified in computation stored as a list of two tuples
 * ...operating_intervals - the union of operating hours for the services specified in computation stored as a list of two tuples
 * ...leadtime - the minutes from current time needed to prepare the order
 * ...min_time_step - the minimum number of minutes between selectable options for any services specified in computation
 */

export class WDateUtils {

  static get DATE_STRING_INTERNAL_FORMAT() {
    return "YYYYMMDD";
  }

  static MinutesToPrintTime(minutes) {
    if(isNaN(minutes) || minutes < 0) {
      return minutes;
    }
    const hour = Math.floor(minutes / 60);
    const minute = minutes - (hour * 60);
    const meridian = hour >= 12 ? "PM" : "AM";
    const printHour = (hour % 12 === 0 ? 12 : hour % 12).toString();
    const printMinute = (minute < 10 ? "0" : "").concat(minute.toString());
    return `${printHour}:${printMinute}${meridian}`;
  }

  static CompareIntervals(a, b)  {
    // compares the starting time of two intervals
    return a[0]-b[0];
  };

  /**
   * gets the union of blocked off hours for a given date and the provided services
   * @param {Object} BLOCKED_OFF 
   * @param {{Number: boolean}} services - map from service index to enabled state
   * @param {String} day - the date, in DATE_STRING_INTERNAL_FORMAT
   * @returns the union of blocked off times for all specified services
   */  
  static BlockedOffIntervalsForServicesAndDay(BLOCKED_OFF, services, day) {
    var intervals = [];
    for (var i in services) {
      if (services[i]) {
        for (var j in BLOCKED_OFF[i]) {
          if (BLOCKED_OFF[i][j][0] === day) {
            intervals = intervals.concat(BLOCKED_OFF[i][j][1]);
            break;
          }
        }
      }
    }
    return intervals.length ? WDateUtils.ComputeUnionsForIntervals(intervals) : intervals;
  };

  /**
   * 
   * @param {[[Number]]} intervals - array of length 2 arrays of Numbers
   * @returns {[[Number]]} the input intervals array, sorted by interval start time, minimized to the union of the input array
   */
  static ComputeUnionsForIntervals(intervals) {
    // todo: maybe shallow copy this array?
    intervals.sort(WDateUtils.CompareIntervals);
    var interval_unions = [intervals[0]];
    var j = 1;
    var k = 0;
    while (j < intervals.length) {
      if (interval_unions[k][1] >= intervals[j][0]) {
        // union the two intervals into the kth element of interval unions
        interval_unions[k] = [interval_unions[k][0], Math.max(interval_unions[k][1], intervals[j][1])];
        ++j;
      }
      else if (interval_unions[k][1] < intervals[j][0]) {
        // intervals do not intersect, add the jth interval to the end of the
        // interval_unions and increment both iterators
        interval_unions.push(intervals[j]);
        ++j;
        ++k;
      }
      else {
        break;
      }
    }
    return interval_unions;
  }

    /**
   * 
   * @param {[[Number]]} a - array of length 2 arrays of Numbers, sorted by start
   * @param {[[Number]]} b - array of length 2 arrays of Numbers, sorted by start
   * @param {Number} step - the next available interval step resolution
   * @returns {[[Number]]} a new array, the set subtraction of intervals a minus b
   */
  static ComputeSubtractionOfIntervalSets(a, b, step) {
    // if a is empty or there's nothing to subtract, return a
    if (!a.length || !b.length) {
      return a;
    }
    a = a.slice();
    b = b.slice();
    var retval = [];
    var i = 0;
    var j = 0;
    for (var a_idx = i; a_idx < a.length; ++a_idx) {
      var should_add = true;
      for (var b_idx = j; b_idx < b.length; ++b_idx) {
        if (a[a_idx][0] > b[b_idx][1]) { // a is entirely after b 
          // then we don't need to look at b[j] anymore
          // assert: j === b_idx
          ++j; 
          continue;
        }
        else { // (a[a_idx][0] <= b[b_idx][1])
          // if b's end time is greater than or equal to a's start time and b's start time is less than or eq to a's end time
          // ... a0 <= b1, b0 <= b1, b0 <= a1, a0 <= a1
          if (a[a_idx][1] >= b[b_idx][0]) {
            // b0 <= a0 <= b1 <= a1
            if (a[a_idx][0] >= b[b_idx][0]) {
              //case: from the begining of a's interval, some or all of a is clipped by some or all of b
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
                ++i;
                break;
              }
            }
          }
          else { // a[a_idx][1] < b[b_idx][0]
            // a is entirely before b, we don't need to look at a anymore
            ++i;
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
   * @param {Object} operating_hours - the operating hour intervals from the settings
   * @param {{Number: boolean}} services - map from service index to enabled state
   * @param {Number} day_index - the day of the week, 0 = sunday
   * @returns 
   */
  static GetOperatingHoursForServicesAndDay(operating_hours, services, day_index) {
    var intervals = [];
    for (var i in services) {
      if (services[i]) {
        intervals = intervals.concat(operating_hours[i][day_index]);
      }
    }
    if (!intervals.length) {
      return [];
    }
    return WDateUtils.ComputeUnionsForIntervals(intervals);
  }

  /**
   * Computes a list of operating times available from the operating ranges
   * @param {*} operating_ranges 
   * @param {*} step 
   * @param {Number} lead_time_min
   * @returns 
   */
  static GetOperatingTimesForDate(operating_ranges, step, lead_time_min) {
    var retval = [];
    for (var i in operating_ranges) {
      var earliest = Math.max(lead_time_min, operating_ranges[i][0]);
      while (earliest <= operating_ranges[i][1]) {
        retval.push(earliest);
        earliest += step;
      }
    }
    return retval;
  }

  static HandleBlockedOffTime(blocked_off_intervals, operating_intervals, start, step) { 
    var pushed_time = start;
    for (var op_idx = 0; op_idx < operating_intervals.length; ++op_idx) { 
      if (pushed_time < operating_intervals[op_idx][0]) {
        pushed_time = operating_intervals[op_idx][0];
      }
      // if the time we're looking at is in the current operating time interval...
      if (operating_intervals[op_idx][1] > pushed_time && operating_intervals[op_idx][0] <= pushed_time) {
        for (var bo_idx = 0; bo_idx < blocked_off_intervals.length; ++bo_idx) {
          if (blocked_off_intervals[bo_idx][1] >= pushed_time && blocked_off_intervals[bo_idx][0] <= pushed_time) {
            pushed_time = blocked_off_intervals[bo_idx][1] + step;
          }
        }
        if (pushed_time > operating_intervals[op_idx][1] ) {
          // this means we found a time in the current operating interval that wasn't blocked off
          break;
        }
      }
    }
    // check if we've gone past the last operating interval before returning a value
    return pushed_time > operating_intervals[operating_intervals.length -1][1] ? -1 : pushed_time;
  }

  /**
   * 
   * @param {BLOCKED_OFF_WIRE_FORMAT} BLOCKED_OFF
   * @param {{operating_hours: [[[[[Number]]]]], additional_pizza_lead_time: Number, time_step2: [Number]}} SETTINGS 
   * @param {[Number]} LEAD_TIMES 
   * @param {moment} date - date to find the first available time for
   * @param {{Number: boolean}} services - map from service index to enabled state
   * @param {{cart_based_lead_time: Number, size: Number}} stuff_to_depreciate_map 
   * @returns {AVAILABILITY_INFO_MAP}
   */
  static GetInfoMapForAvailabilityComputation(BLOCKED_OFF, SETTINGS, LEAD_TIMES, date, services, stuff_to_depreciate_map) {
    const internal_formatted_date = date.format(WDateUtils.DATE_STRING_INTERNAL_FORMAT);
    const blocked_off_union = WDateUtils.BlockedOffIntervalsForServicesAndDay(BLOCKED_OFF, services, internal_formatted_date);
    const operating_intervals = WDateUtils.GetOperatingHoursForServicesAndDay(SETTINGS.operating_hours, services, date.day());
    const min_time_step = Math.min(...SETTINGS.time_step2.filter((_, i) => services.hasOwnProperty(i) && services[i]));
    const min_lead_time = Math.min(...LEAD_TIMES.filter((_, i) => services.hasOwnProperty(i) && services[i]));
    const order_size = stuff_to_depreciate_map.hasOwnProperty("size") ? stuff_to_depreciate_map.size : 1;
    const cart_based_lead_time = stuff_to_depreciate_map.hasOwnProperty("cart_based_lead_time") ? stuff_to_depreciate_map.cart_based_lead_time : 0;
    // cart_based_lead_time and service/size lead time don't stack
    const leadtime = Math.max(min_lead_time + ((order_size - 1) * SETTINGS.additional_pizza_lead_time), cart_based_lead_time);
    return { blocked_off_union, operating_intervals, min_time_step, leadtime };
  }

  /**
   * Gets an array of Objects containing information for WCPReactConfig's blocked off
   * select widget
   * @param {BLOCKED_OFF_WIRE_FORMAT} BLOCKED_OFF 
   * @param {{operating_hours: [[[[[Number]]]]], additional_pizza_lead_time: Number, time_step2: [Number]}} SETTINGS 
   * @param {moment} date - date to find the first available time for
   * @param {{Number: boolean}} services - map from service index to enabled state
   * @param {{cart_based_lead_time: Number, size: Number}} stuff_to_depreciate_map 
   * @param {moment} current_moment - the current date and time according to dog (the server, whatever)
   * @returns {[{value: Number, disabled: Boolean}]}
   */
  static GetOptionsForDate(BLOCKED_OFF, SETTINGS, LEAD_TIMES, date, services, stuff_to_depreciate_map, current_moment) {
    const INFO = WDateUtils.GetInfoMapForAvailabilityComputation(BLOCKED_OFF, SETTINGS, LEAD_TIMES, date, services, stuff_to_depreciate_map);
    const current_time_plus_leadtime = moment(current_moment);
    current_time_plus_leadtime.add(INFO.leadtime, 'm');
    if (INFO.operating_intervals.length === 0 || 
        date.isBefore(current_time_plus_leadtime, 'day')) {
      // if we don't have any operating hours for the day or
      // if by adding the lead time we've passed the date we're looking for
      return [];
    }
    const available_intervals = WDateUtils.ComputeSubtractionOfIntervalSets(INFO.operating_intervals, INFO.blocked_off_union, INFO.min_time_step);
    var earliest_time = 0;
    if (date.isSame(current_time_plus_leadtime, "day")) {
      // NOTE: this doesn't work if we have active hours during a DST change
      const current_time_plus_leadtime_mins_from_start = current_time_plus_leadtime.hours() * 60 + current_time_plus_leadtime.minutes();
      earliest_time = Math.ceil((current_time_plus_leadtime_mins_from_start) / INFO.min_time_step) * INFO.min_time_step;
    }
    return WDateUtils.GetOperatingTimesForDate(available_intervals, INFO.min_time_step, earliest_time).map((time) => ({value: time, disabled: false}));
  }

  /**
   * 
   * @param {BLOCKED_OFF_WIRE_FORMAT} BLOCKED_OFF
   * @param {{operating_hours: [[[[[Number]]]]], additional_pizza_lead_time: Number, time_step2: [Number]}} SETTINGS 
   * @param {[Number]} LEAD_TIMES 
   * @param {moment} date - date to find the first available time for
   * @param {{Number: boolean}} services - map from service index to enabled state
   * @param {{cart_based_lead_time: Number, size: Number}} stuff_to_depreciate_map 
   * @param {moment} current_moment - the current date and time according to dog (the server, whatever)
   * @returns the first available time in minutes from the start of the day (not taking into account DST), or -1 if no time is available
   */
  static ComputeFirstAvailableTimeForDate(BLOCKED_OFF, SETTINGS, LEAD_TIMES, date, services, stuff_to_depreciate_map, current_moment) {
    const INFO = WDateUtils.GetInfoMapForAvailabilityComputation(BLOCKED_OFF, SETTINGS, LEAD_TIMES, date, services, stuff_to_depreciate_map);
    const current_time_plus_leadtime = moment(current_moment);
    current_time_plus_leadtime.add(INFO.leadtime, 'm');
    if (INFO.operating_intervals.length === 0 || 
        date.isBefore(current_time_plus_leadtime, 'day')) {
      // if we don't have any operating hours for the day or
      // if by adding the lead time we've passed the date we're looking for
      return -1;
    }

    if (date.isSame(current_time_plus_leadtime, "day")) {
      // NOTE: this doesn't work if we have active hours during a DST change
      const current_time_plus_leadtime_mins_from_start = current_time_plus_leadtime.hours() * 60 + current_time_plus_leadtime.minutes();
      if (current_time_plus_leadtime_mins_from_start > INFO.operating_intervals[0][0]) {
        const clamped_start = Math.ceil((current_time_plus_leadtime_mins_from_start) / INFO.min_time_step) * INFO.min_time_step;
        return WDateUtils.HandleBlockedOffTime(INFO.blocked_off_union, INFO.operating_intervals, clamped_start, INFO.min_time_step);
      }
    }
    return WDateUtils.HandleBlockedOffTime(INFO.blocked_off_union, INFO.operating_intervals, INFO.operating_intervals[0][0], INFO.min_time_step);
  }


  // Adds the interval to the operating hours interval map.
  // This map differs slightly from the map used by blocked off times
  // This method makes a deep-enough copy for use by ReactJS
  static AddIntervalToOperatingHours(service_index, day_index, interval, new_interval_map) {
    const operating_hours = new_interval_map[service_index][day_index].slice();
    operating_hours.push(interval);
    new_interval_map[service_index][day_index] = WDateUtils.ComputeUnionsForIntervals(operating_hours);
  }

  // Removes the interval from the operating hours interval map.
  // This map differs slightly from the map used by blocked off times
  // This method makes a deep-enough copy for use by ReactJS
  static RemoveIntervalFromOperatingHours(service_index, day_index, interval_index, interval_map) {
    const new_interval_map = interval_map.slice();
    const new_interval_map_for_service = interval_map[service_index].slice();
    const new_interval_map_for_day = new_interval_map_for_service[day_index].slice();
    new_interval_map_for_day.splice(interval_index, 1);
    new_interval_map_for_service[day_index] = new_interval_map_for_day;
    new_interval_map[service_index] = new_interval_map_for_service;
    return new_interval_map;
  }

  static AddIntervalToService(service_index, parsed_date, interval, new_interval_map) {
    for (var date_index in new_interval_map[service_index]) {
      if (parsed_date === new_interval_map[service_index][date_index][0]) {
        const new_interval_map_for_service_and_day = new_interval_map[service_index][date_index].slice();
        new_interval_map_for_service_and_day[1] = new_interval_map_for_service_and_day[1].slice();
        new_interval_map_for_service_and_day[1].push(interval);
        new_interval_map_for_service_and_day[1].sort(WDateUtils.CompareIntervals);
        new_interval_map[service_index][date_index] = new_interval_map_for_service_and_day;
        return;
      }
    }
    const new_interval_map_for_service = new_interval_map[service_index].slice();
    new_interval_map_for_service.push([parsed_date, [interval]]);
    new_interval_map_for_service.sort(WDateUtils.ExtractCompareDate);
    new_interval_map[service_index] = new_interval_map_for_service;
  }


  /**
   * Creates a ReactJS safe object copy of the BlockedOff interval map array with
   * interval_map[service_index][day_index][1][interval_index] element removed
   * NOTE: when we stop using socketio to update blocked off times, this will not be a useful function
   * and we'll want to replace it with a specific interval to remove from a service and date's blocked off array
   * @param {Number} service_index 
   * @param {Number} day_index 
   * @param {Number} interval_index 
   * @param {BLOCKED_OFF_WIRE_FORMAT} interval_map
   * @returns an updated interval_map
   */
  static RemoveIntervalFromBlockedOffWireFormat(service_index, day_index, interval_index, interval_map) {
    const new_interval_map = interval_map.slice();
    const new_interval_map_for_service = new_interval_map[service_index].slice();
    const new_interval_map_for_day = new_interval_map_for_service[day_index].slice();
    const new_interval_map_for_intervals = new_interval_map_for_day[1].slice();
    new_interval_map_for_intervals.splice(interval_index, 1);
    new_interval_map_for_day[1] = new_interval_map_for_intervals;
    new_interval_map_for_service[day_index] = new_interval_map_for_day;
    if (new_interval_map_for_intervals.length === 0) {
      new_interval_map_for_service.splice(day_index, 1);
    }
    new_interval_map[service_index] = new_interval_map_for_service;
    return new_interval_map;
  }

}

export default WDateUtils;