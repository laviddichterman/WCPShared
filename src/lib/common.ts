import { IWInterval, OptionPlacement, OptionQualifier, WCPProduct } from "./types";

// eslint-disable-next-line prefer-regex-literals
export const EMAIL_REGEX = new RegExp(/^[_A-Za-z0-9\-+]+(\.[_A-Za-z0-9\-+]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*(\.[A-Za-z]{2,})$/);

export const CREDIT_REGEX = /[A-Za-z0-9]{3}-[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Z0-9]{8}$/;

export const PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX = /(\{[A-Za-z0-9]+\})/g;

export const GetPlacementFromMIDOID = (pi: WCPProduct, mid: string, oid: string) => {
  const NOT_FOUND = { option_id: oid, placement: OptionPlacement.NONE, qualifier: OptionQualifier.REGULAR };
  return Object.hasOwn(pi.modifiers, mid) ? (pi.modifiers[mid].find((x) => x.option_id === oid) || NOT_FOUND) : NOT_FOUND;
};

/**
 * Function to check if something is disabled
 * @param {IWInterval} disable_data - catalog sourced info as to if/when the product is enabled or disabled
 * @param {Date} order_time - the time to use to check for disabling
 * @returns {boolean} true if the product is enabled, false otherwise
 */
export function DisableDataCheck(disable_data: IWInterval | null, order_time: Date) {
  return !disable_data || (!(disable_data.start > disable_data.end) && (disable_data.start > order_time.valueOf() || disable_data.end < order_time.valueOf()));
}