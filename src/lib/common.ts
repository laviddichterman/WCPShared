import { addMinutes, getTime } from "date-fns";
import { CreateProductWithMetadataFromV2Dto } from "./objects/WCPProduct";
import WDateUtils from "./objects/WDateUtils";
import { CoreCartEntry, CURRENCY, DISABLE_REASON, FulfillmentConfig, IMoney, IWInterval, JSFECreditV2, ProductModifierEntry, OptionPlacement, OptionQualifier, TipSelection, WProduct, IOptionInstance, FulfillmentTime, WCPProductV2Dto, CategorizedRebuiltCart, ICatalogSelectors, IProductInstance, PRODUCT_LOCATION, Selector, DineInInfoDto, CALL_LINE_DISPLAY } from "./types";

export const CREDIT_REGEX = /[A-Za-z0-9]{3}-[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Z0-9]{8}$/;

export const PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX = /(\{[A-Za-z0-9]+\})/g;

export function ReduceArrayToMapByKey<T, Key extends keyof T>(xs: T[], key: Key) {
  return Object.fromEntries(xs.map(x => [x[key], x])) as Record<string, T>;
};

export const RebuildAndSortCart = (cart: CoreCartEntry<WCPProductV2Dto>[], catalogSelectors: ICatalogSelectors, service_time: Date | number, fulfillmentId: string): CategorizedRebuiltCart => {
  return cart.reduce(
    (acc: CategorizedRebuiltCart, entry) => {
      const product = CreateProductWithMetadataFromV2Dto(entry.product, catalogSelectors, service_time, fulfillmentId);
      const rebuiltEntry: CoreCartEntry<WProduct> = { ...entry, product };
      return { ...acc, [entry.categoryId]: Object.hasOwn(acc, entry.categoryId) ? [...acc[entry.categoryId], rebuiltEntry] : [rebuiltEntry] }
    }, {});
}

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

export const GenerateShortCode = function (productInstanceSelector: Selector<IProductInstance>, p: WProduct) {
  return p.m.is_split && p.m.pi[PRODUCT_LOCATION.LEFT] !== p.m.pi[PRODUCT_LOCATION.RIGHT] ?
    `${productInstanceSelector(p.m.pi[PRODUCT_LOCATION.LEFT])?.shortcode ?? "UNDEFINED"}|${productInstanceSelector(p.m.pi[PRODUCT_LOCATION.RIGHT])?.shortcode ?? "UNDEFINED"}` :
    productInstanceSelector(p.m.pi[PRODUCT_LOCATION.LEFT])?.shortcode ?? "UNDEFINED";
}

export const GenerateDineInPlusString = (dineInInfo: DineInInfoDto | null) => dineInInfo && dineInInfo.partySize > 1 ? `+${dineInInfo.partySize - 1}` : "";

export const EventTitleStringBuilder = (catalogSelectors: Pick<ICatalogSelectors, 'category' | 'productInstance'>, fulfillmentConfig: FulfillmentConfig, customer: string, dineInInfo: DineInInfoDto | null, cart: CategorizedRebuiltCart, special_instructions: string) => {
  const has_special_instructions = special_instructions && special_instructions.length > 0;

  const titles = Object.entries(cart).map(([catid, category_cart]) => {
    const category = catalogSelectors.category(catid)?.category;
    const call_line_category_name_with_space = `${category?.display_flags?.call_line_name ?? ""} `;
    // TODO: this is incomplete since both technically use the shortcode for now. so we don't get modifiers in the call line
    // pending https://app.asana.com/0/1192054646278650/1192054646278651
    switch (category?.display_flags?.call_line_display ?? CALL_LINE_DISPLAY.SHORTCODE) {
      case CALL_LINE_DISPLAY.SHORTCODE:
        var total = 0;
        var product_shortcodes: string[] = [];
        category_cart.forEach(item => {
          total += item.quantity;
          product_shortcodes = product_shortcodes.concat(Array(item.quantity).fill(GenerateShortCode(catalogSelectors.productInstance, item.product)));
        });
        return `${total.toString(10)}x ${call_line_category_name_with_space}${product_shortcodes.join(" ")}`;
      case CALL_LINE_DISPLAY.SHORTNAME:
        var product_shortcodes: string[] = category_cart.map(item => `${item.quantity}x${GenerateShortCode(catalogSelectors.productInstance, item.product)}`);
        return `${call_line_category_name_with_space}${product_shortcodes.join(" ")}`;
    }
  });
  return `${fulfillmentConfig.shortcode} ${customer}${GenerateDineInPlusString(dineInInfo)} ${titles.join(" ")}${has_special_instructions ? " *" : ""}`;
};

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