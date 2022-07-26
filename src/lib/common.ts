import { getTime } from "date-fns";
import { CoreCartEntry, IWInterval, ModifiersMap, OptionPlacement, OptionQualifier, TipSelection, ValidateAndLockCreditResponse, WProduct } from "./types";

export const EMAIL_REGEX = new RegExp(/^[_A-Za-z0-9\-+]+(\.[_A-Za-z0-9\-+]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*(\.[A-Za-z]{2,})$/);

export const CREDIT_REGEX = /[A-Za-z0-9]{3}-[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Z0-9]{8}$/;

export const PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX = /(\{[A-Za-z0-9]+\})/g;

export const SERVICE_DATE_DISPLAY_FORMAT = 'EEEE, MMMM dd, yyyy';

export const GetPlacementFromMIDOID = (modifiers: ModifiersMap, mid: string, oid: string) => {
  const NOT_FOUND = { option_id: oid, placement: OptionPlacement.NONE, qualifier: OptionQualifier.REGULAR };
  return Object.hasOwn(modifiers, mid) ? (modifiers[mid].find((x) => x.option_id === oid) || NOT_FOUND) : NOT_FOUND;
};

/**
 * Function to check if something is disabled
 * @param {IWInterval} disable_data - catalog sourced info as to if/when the product is enabled or disabled
 * @param {Date | number} order_time - the time to use to check for disabling
 * @returns {boolean} true if the product is enabled, false otherwise
 */
export function DisableDataCheck(disable_data: IWInterval | null, order_time: Date | number) {
  return !disable_data || (!(disable_data.start > disable_data.end) && (disable_data.start > getTime(order_time) || disable_data.end < getTime(order_time)));
}

export function ComputeMainProductCategoryCount(MAIN_CATID: string, cart: CoreCartEntry<any>[]) {
  return cart.reduce((acc, e) => acc + (e.categoryId === MAIN_CATID ? e.quantity : 0), 0)
}

export function RoundToTwoDecimalPlaces(number: number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function ComputeCartSubTotal(cart: CoreCartEntry<WProduct>[]) {
  return cart.reduce((acc, entry) => acc + (entry.product.m.price * entry.quantity), 0);
}

export function ComputeDiscountApplied(subtotal: number, creditValidation: ValidateAndLockCreditResponse | null) {
  return creditValidation !== null && creditValidation.valid && creditValidation.credit_type === "DISCOUNT" ?
    Math.min(subtotal, creditValidation.amount) : 0;
}

export function ComputeTaxAmount(subtotal: number, taxRate: number, discount: number) {
  return RoundToTwoDecimalPlaces((subtotal - discount) * taxRate);
}

export function ComputeTipBasis(subtotal: number, taxAmount: number) {
  return RoundToTwoDecimalPlaces(subtotal + taxAmount);
}

export function ComputeTipValue(tip: TipSelection | null, basis: number) {
  return tip !== null ? (tip.isPercentage ? RoundToTwoDecimalPlaces(tip.value * basis) : tip.value) : 0;
}

export function ComputeTotal(subtotal: number, discount: number, taxAmount: number, tipAmount: number) {
  return subtotal - discount + taxAmount + tipAmount;
}
export function ComputeAutogratuityEnabled(mainProductCount: number, threshold: number, isDelivery: boolean) {
  return mainProductCount >= threshold || isDelivery;
}

export function ComputeGiftCardApplied(total: number, creditValidation: ValidateAndLockCreditResponse | null) {
  return creditValidation !== null && creditValidation.credit_type === "MONEY" ?
    Math.min(total, creditValidation.amount) : 0;
}
export function ComputeBalanceAfterCredits(total: number, giftCardApplied: number) {
  return total - giftCardApplied;
}