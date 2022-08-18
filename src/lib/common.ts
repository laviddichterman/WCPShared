import { getTime } from "date-fns";
import { CoreCartEntry, DISABLE_REASON, IMoney, IWInterval, ModifiersMap, OptionPlacement, OptionQualifier, TipSelection, ValidateAndLockCreditResponse, WProduct } from "./types";

export const CREDIT_REGEX = /[A-Za-z0-9]{3}-[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Z0-9]{8}$/;

export const PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX = /(\{[A-Za-z0-9]+\})/g;

export function ReduceArrayToMapByKey<T, Key extends keyof T>(xs: T[], key: Key) {
  return Object.fromEntries(xs.map(x => [x[key], x])) as Record<string, T>;
};

export const GetPlacementFromMIDOID = (modifiers: ModifiersMap, mid: string, oid: string) => {
  const NOT_FOUND = { option_id: oid, placement: OptionPlacement.NONE, qualifier: OptionQualifier.REGULAR };
  return Object.hasOwn(modifiers, mid) ? (modifiers[mid].find((x) => x.optionId === oid) || NOT_FOUND) : NOT_FOUND;
};

/**
 * Function to check if something is disabled
 * @param {IWInterval} disable_data - catalog sourced info as to if/when the product is enabled or disabled
 * @param {Date | number} order_time - the time to use to check for disabling
 * @returns {{ enable: DISABLE_REASON.ENABLED } |
  { enable: DISABLE_REASON.DISABLED_BLANKET } |
  { enable: DISABLE_REASON.DISABLED_TIME, interval: IWInterval }}
 */
export function DisableDataCheck(disable_data: IWInterval | null, order_time: Date | number): ({ enable: DISABLE_REASON.ENABLED } |
{ enable: DISABLE_REASON.DISABLED_BLANKET } |
{ enable: DISABLE_REASON.DISABLED_TIME, interval: IWInterval }) {
  return !disable_data ? ({ enable: DISABLE_REASON.ENABLED }) :
    (disable_data.start > disable_data.end ? ({ enable: DISABLE_REASON.DISABLED_BLANKET }) : (
      (disable_data.start <= getTime(order_time) && disable_data.end >= getTime(order_time)) ?
        { enable: DISABLE_REASON.DISABLED_TIME, interval: disable_data } :
        { enable: DISABLE_REASON.ENABLED }));
  // ))
  // return !disable_data || (!(disable_data.start > disable_data.end) && (disable_data.start > getTime(order_time) || disable_data.end < getTime(order_time)));
}

export function MoneyToDisplayString(money: IMoney, showCurrencyUnit: boolean) {
  return `${showCurrencyUnit ? '$' : ""}${(money.amount / 100).toFixed(2)}`;
}

export function ComputeMainProductCategoryCount(MAIN_CATID: string, cart: CoreCartEntry<any>[]) {
  return cart.reduce((acc, e) => acc + (e.categoryId === MAIN_CATID ? e.quantity : 0), 0)
}

export function RoundToTwoDecimalPlaces(number: number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function ComputeCartSubTotal(cart: CoreCartEntry<WProduct>[]) {
  return cart.reduce((acc, entry) => RoundToTwoDecimalPlaces(acc + (entry.product.m.price * entry.quantity)), 0);
}

export function ComputeDiscountApplied(subtotalPreDiscount: number, creditValidations: ValidateAndLockCreditResponse[]) {
  return Math.min(subtotalPreDiscount, creditValidations.reduce((acc, x) => acc + (x.valid && x.credit_type === "DISCOUNT" ? x.amount : 0), 0));
}

export function ComputeTaxAmount(subtotalAfterDiscount: number, taxRate: number) {
  return RoundToTwoDecimalPlaces(subtotalAfterDiscount * taxRate);
}

export function ComputeTipBasis(subtotalPreDiscount: number, taxAmount: number) {
  return RoundToTwoDecimalPlaces(subtotalPreDiscount + taxAmount);
}

export function ComputeTipValue(tip: TipSelection | null, basis: number) {
  return tip !== null ? (tip.isPercentage ? RoundToTwoDecimalPlaces(tip.value * basis) : tip.value) : 0;
}

export function ComputeSubtotalPreDiscount(cartTotal: number, serviceFees: number) {
  return RoundToTwoDecimalPlaces(cartTotal + serviceFees);
}

export function ComputeSubtotalAfterDiscount(subtotalPreDiscount: number, discountApplied: number) {
  return RoundToTwoDecimalPlaces(subtotalPreDiscount - discountApplied);
}

export function ComputeTotal(subtotalAfterDiscount: number, taxAmount: number, tipAmount: number) {
  return RoundToTwoDecimalPlaces(subtotalAfterDiscount + taxAmount + tipAmount);
}

export function ComputeAutogratuityEnabled(mainProductCount: number, threshold: number, isDelivery: boolean) {
  return mainProductCount >= threshold || isDelivery;
}

export function ComputeGiftCardApplied(total: number, creditValidations: ValidateAndLockCreditResponse[]) {
  return Math.min(total, creditValidations.reduce((acc, x) => acc + (x.valid && x.credit_type === "MONEY" ? x.amount : 0), 0));
}
export function ComputeBalanceAfterCredits(total: number, giftCardApplied: number) {
  return RoundToTwoDecimalPlaces(total - giftCardApplied);
}