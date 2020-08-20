export var TOPPING_NONE = 0;
export var TOPPING_LEFT = 1;
export var TOPPING_RIGHT = 2;
export var TOPPING_WHOLE = 3;
export var NO_MATCH = 0;
export var AT_LEAST = 1;
export var EXACT_MATCH = 2;
export var LEFT_SIDE = 0;
export var RIGHT_SIDE = 1;

export function GetPlacementFromMIDOID(pi, mid, oid) {
  var option_placement = pi.modifiers.hasOwnProperty(mid) ?
    pi.modifiers[mid].find(function (x) { return x[1] === oid }) : null;
  return option_placement ? option_placement[0] : TOPPING_NONE;
}

export function DisableDataCheck(disable_data, order_time) {
  return !disable_data || (!(disable_data.start > disable_data.end) && (disable_data.start > order_time.valueOf() || disable_data.end < order_time().valueOf()));
}