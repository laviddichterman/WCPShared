import { addMinutes, getTime } from "date-fns";
import WDateUtils from "./objects/WDateUtils";
import { CoreCartEntry, CURRENCY, DISABLE_REASON, FulfillmentConfig, IMoney, IWInterval, JSFECreditV2, ProductModifierEntry, OptionPlacement, OptionQualifier, TipSelection, WProduct, IOptionInstance, FulfillmentTime } from "./types";

export const CREDIT_REGEX = /[A-Za-z0-9]{3}-[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Z0-9]{8}$/;

export const PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX = /(\{[A-Za-z0-9]+\})/g;

export function ReduceArrayToMapByKey<T, Key extends keyof T>(xs: T[], key: Key) {
  return Object.fromEntries(xs.map(x => [x[key], x])) as Record<string, T>;
};

export const GetPlacementFromMIDOID = (modifiers: ProductModifierEntry[], mtid: string, oid: string): IOptionInstance => {
  const NOT_FOUND: IOptionInstance = { optionId: oid, placement: OptionPlacement.NONE, qualifier: OptionQualifier.REGULAR };
  const modifierEntry = modifiers.find(x => x.modifierTypeId === mtid);
  return modifierEntry !== undefined ? (modifierEntry.options.find((x) => x.optionId === oid) || NOT_FOUND) : NOT_FOUND;
};

export const DateTimeIntervalBuilder = (fulfillmentTime: FulfillmentTime, fulfillment: FulfillmentConfig) => {
  // hack for date computation on DST transition days since we're currently not open during the time jump
  const date_lower = WDateUtils.ComputeServiceDateTime(fulfillmentTime);
  const date_upper = addMinutes(date_lower, fulfillment.maxDuration);
  return { start: date_lower, end: date_upper } as Interval;
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

export function ComputeCartSubTotal(cart: CoreCartEntry<WProduct>[]): IMoney {
  return { amount: cart.reduce((acc, entry) => acc + (entry.product.m.price.amount * entry.quantity), 0), currency: CURRENCY.USD };
}

export const ComputeCreditsApplied = (subtotalPreCredits: IMoney, creditValidations: Omit<JSFECreditV2, "amount_used">[]): JSFECreditV2[] => {
  return creditValidations.reduce((acc, credit) => {
    const amountToApply = Math.min(acc.remaining, credit.validation.amount.amount)
    return {
      remaining: acc.remaining - amountToApply,
      credits: amountToApply > 0 ?
        [...acc.credits,
        {
          ...credit,
          amount_used: {
            currency: credit.validation.amount.currency,
            amount: amountToApply
          }
        }] :
        acc.credits
    };
  }, { remaining: subtotalPreCredits.amount, credits: [] as JSFECreditV2[] }).credits;
}

export function ComputeTaxAmount(subtotalAfterDiscount: IMoney, taxRate: number): IMoney {
  return { amount: Math.round(subtotalAfterDiscount.amount * taxRate), currency: subtotalAfterDiscount.currency };
}

export function ComputeTipBasis(subtotalPreDiscount: IMoney, taxAmount: IMoney): IMoney {
  return { ...subtotalPreDiscount, amount: subtotalPreDiscount.amount + taxAmount.amount };
}

export function ComputeTipValue(tip: TipSelection | null, basis: IMoney): IMoney {
  return { currency: basis.currency, amount: tip !== null ? (tip.isPercentage ? Math.round(tip.value * basis.amount) : tip.value.amount) : 0 };
}

export function ComputeSubtotalPreDiscount(cartTotal: IMoney, serviceFees: IMoney): IMoney {
  return { currency: cartTotal.currency, amount: cartTotal.amount + serviceFees.amount };
}

export function ComputeSubtotalAfterDiscount(subtotalPreDiscount: IMoney, discountApplied: IMoney): IMoney {
  return { currency: subtotalPreDiscount.currency, amount: subtotalPreDiscount.amount - discountApplied.amount };
}

export function ComputeTotal(subtotalAfterDiscount: IMoney, taxAmount: IMoney, tipAmount: IMoney): IMoney {
  return { currency: subtotalAfterDiscount.currency, amount: subtotalAfterDiscount.amount + taxAmount.amount + tipAmount.amount };
}

export function ComputeAutogratuityEnabled(mainProductCount: number, threshold: number, isDelivery: boolean): boolean {
  return mainProductCount >= threshold || isDelivery;
}

export function ComputeBalanceAfterCredits(total: IMoney, giftCardApplied: IMoney): IMoney {
  return { currency: total.currency, amount: total.amount - giftCardApplied.amount };
}