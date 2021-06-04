export const TOPPING_NONE = 0;
export const TOPPING_LEFT = 1;
export const TOPPING_RIGHT = 2;
export const TOPPING_WHOLE = 3;
export const NO_MATCH = 0;
export const AT_LEAST = 1;
export const EXACT_MATCH = 2;
export const LEFT_SIDE = 0;
export const RIGHT_SIDE = 1;

export const EMAIL_REGEX = new RegExp("^[_A-Za-z0-9\-]+(\\.[_A-Za-z0-9\-]+)*@[A-Za-z0-9\-]+(\\.[A-Za-z0-9\-]+)*(\\.[A-Za-z]{2,})$");

export const CREDIT_REGEX = new RegExp("[A-Za-z0-9]{3}-[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Z0-9]{8}$");

export const PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX = /(\{[A-Za-z0-9]+\})/g;

export function GetPlacementFromMIDOID(pi, mid, oid) {
  var option_placement = pi.modifiers.hasOwnProperty(mid) ?
    pi.modifiers[mid].find(function (x) { return x[1] === oid }) : null;
  return option_placement ? option_placement[0] : TOPPING_NONE;
}

/**
 * Function to check if something is disabled
 * @param {Object} disable_data - catalog sourced info as to if/when the product is enabled or disabled
 * @param {moment} order_time - the time to use to check for disabling
 * @returns {boolean} true if the product is enabled, false otherwise
 */
export function DisableDataCheck(disable_data, order_time) {
  return !disable_data || (!(disable_data.start > disable_data.end) && (disable_data.start > order_time.valueOf() || disable_data.end < order_time.valueOf()));
}