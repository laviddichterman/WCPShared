import moment from 'moment';

export function HandleBlockedOffTime(blockedOff, time) {
  // param: blockedOff - the blocked off times for the date being processed
  // param: time - the minutes since the day started
  // return: time if time isn't blocked off, otherwise the next available time
  var pushedTime = time;
  for (var i in blockedOff) {
    if (blockedOff[i][1] >= pushedTime && blockedOff[i][0] <= pushedTime) {
        pushedTime = blockedOff[i][1] + this.time_step;
    }
  }
  return pushedTime;
};

export class WDateUtils {

  static get DATE_STRING_INTERNAL_FORMAT() {
    return "YYYYMMDD";
  }

  static MinutesToDate(minutes) {
    if(isNaN(minutes) || minutes < 0) {
      return minutes;
    }
    var hour = Math.floor(minutes / 60);
    var minute = minutes - (hour * 60);
    return new Date().setHours(hour, minute);
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

  static IsSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth();
  }

  static CompareIntervals(a, b)  {
    // compares the starting time of two intervals
    return a[0]-b[0];
  };

  static BlockedOffIntervalsForDateAndServices(blocked_off, services, date) {
    var intervals = [];
    for (var i in services) {
      if (services[i]) {
        for (var j in blocked_off[i]) {
          if (blocked_off[i][j][0] === date) {
            intervals = intervals.concat(blocked_off[i][j][1]);
            break;
          }
        }
      }
    }
    return intervals.length ? WDateUtils.ComputeUnionsForIntervals(intervals) : intervals;
  };

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
  static GetOperatingHoursForServiceAndDay(operating_hours, service_index, day_index) {
    return ;
  }
  // gets the union of operating hours for a given day and the provided services
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

  // computes a list of the minute options for a given date and service selection
  static GetOperatingTimesForDate(operating_hours, services, day_index, step) {
    const hrs = WDateUtils.GetOperatingHoursForServicesAndDay(operating_hours, services, day_index);
    var retval = [];
    for (var i in hrs) {
      var earliest = hrs[i][0];
      while (earliest <= hrs[i][1]) {
        retval.push(earliest);
        earliest += step;
      }
    }
    return retval;
  }

  static GetOptionsForDate(blocked_off, operating_hours, services, day, step) {
    const day_of_week = moment(day, WDateUtils.DATE_STRING_INTERNAL_FORMAT).day();
    const times = WDateUtils.GetOperatingTimesForDate(operating_hours, services, day_of_week, step);
    const excluded_intervals = blocked_off ?
      WDateUtils.BlockedOffIntervalsForDateAndServices(blocked_off, services, day) : [];
    return times.map((time, i) => {
      var is_time_excluded = false;
      const print_time = WDateUtils.MinutesToPrintTime(time);
      for (var j in excluded_intervals) {
        if (excluded_intervals[j][0] <= time && time <= excluded_intervals[j][1]) {
          is_time_excluded = true;
          break;
        }
      }
      return {value: time, label: print_time, disabled: is_time_excluded};
    });
  }

  static GetAvailableForDate(date, minmax) {
    var blocked_off = this.GetBlockedOffForDateAndServices(this.time_off_service, date);

    //var minmax = PICKUP_HOURS[date.getDay()];
    if (minmax[0] >= minmax[1] || (!this.time_off_service[0] && !this.time_off_service[1] && !this.time_off_service[2])) {
      return [];
    }
    if (blocked_off.length === 0) {
      return [minmax];
    }
    var earliest = HandleBlockedOffTime(blocked_off, minmax[0]);
    var current_interval = [earliest, earliest];
    var intervals = [];
    while (earliest <= minmax[1]) {
      var next_time = HandleBlockedOffTime(blocked_off, earliest + this.time_step);
      if (next_time !== earliest + this.time_step || next_time > minmax[1]) {
        intervals.push(current_interval);
        current_interval = [next_time, next_time];
      }
      else {
        current_interval[1] = next_time;
      }
      earliest = next_time;
    }
    return intervals;
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

  static RemoveInterval(service_index, day_index, interval_index, interval_map) {
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