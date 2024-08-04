import { DisableDataCheck } from "../common";
import {
  IProductInstance,
  OptionPlacement,
  DISABLE_REASON,
  ICatalogSelectors,
  CatalogCategoryEntry,
  IProduct,
  ProductModifierEntry,
  IProductDisplayFlags,
  IOption,
  WProductMetadata,
  Selector
} from "../types";

import {
  // CreateWCPProduct, 
  WCPProductGenerateMetadata
} from "./WCPProduct";

export const CheckRequiredModifiersAreAvailable = (product: IProduct, modifiers: ProductModifierEntry[], optionSelector: ICatalogSelectors['option'], order_time: Date | number, fulfillmentId: string) => {
  let passes = true;
  modifiers.forEach((productModifierEntry) => {
    // TODO: for incomplete product instances, this should check for a viable way to order the product
    const productModifierDefinition = product.modifiers.find(x => x.mtid === productModifierEntry.modifierTypeId)!;
    passes &&= productModifierDefinition.serviceDisable.indexOf(fulfillmentId) === -1 &&
      productModifierEntry.options.reduce((acc: boolean, x) => {
        const modifierOption = optionSelector(x.optionId);
        return (acc && modifierOption !== undefined && DisableDataCheck(modifierOption.disabled, modifierOption.availability, order_time).enable === DISABLE_REASON.ENABLED)
      }
        , true);
  });
  return passes;
}

type DisableFlagGetterType = (x: Pick<IProductDisplayFlags, "menu"> | Pick<IProductDisplayFlags, "order">) => boolean;

export const GetMenuHideDisplayFlag: DisableFlagGetterType = (x) => (x as Pick<IProductDisplayFlags, "menu">).menu.hide === false;
export const GetOrderHideDisplayFlag: DisableFlagGetterType = (x) => (x as Pick<IProductDisplayFlags, "order">).order.hide === false;
export const IgnoreHideDisplayFlags: DisableFlagGetterType = (_x) => true;

/**
 * Checks if a product is enabled and visible
 * @param {IProductInstance} item - the product to check 
 * @param {Pick<ICatalogSelectors, "productEntry" | "option">} catalogSelectors - the menu from which to pull catalog data
 * @param {DisableFlagGetterType} hide_product_functor - getter function to pull the proper display flag from the products
 * @param {Date | number} order_time - from getTime or Date.valueOf() the time to use to check for disable/enable status
 * @param {string} fulfillmentId - the service selected
 * @returns {boolean} returns true if item is enabled and visible
 */
export function FilterProductInstanceUsingCatalog(item: IProductInstance, catalogSelectors: Pick<ICatalogSelectors, "productEntry" | "option">, hide_product_functor: DisableFlagGetterType, order_time: Date | number, fulfillmentId: string) {
  return FilterProductUsingCatalog(item.productId, item.modifiers, item.displayFlags, catalogSelectors, hide_product_functor, order_time, fulfillmentId);
}

/**
 * Checks if a product is enabled and visible
 * @param {string} productId - the product type to check 
 * @param {ProductModifierEntry[]} modifiers - product modifier entry list of selected/placed modifiers
 * @param {IProductDisplayFlags} display_flags - either the display flags for the specific product instance we're checking
 * @param {Pick<ICatalogSelectors, "productEntry" | "option">} catalogSelectors - the menu from which to pull catalog data
 * @param {DisableFlagGetterType} hide_product_functor - getter function to check if the product should be hidden
 * @param {Date | number} order_time - from getTime or Date.valueOf() the time to use to check for disable/enable status
 * @param {string} fulfillmentId - the service selected
 * @returns {boolean} returns true if item is enabled and visible
 */
export function FilterProductUsingCatalog(productId: string, modifiers: ProductModifierEntry[], display_flags: IProductDisplayFlags, catalogSelectors: Pick<ICatalogSelectors, "productEntry" | "option">, hide_product_functor: DisableFlagGetterType, order_time: Date | number, fulfillmentId: string) {
  const productClass = catalogSelectors.productEntry(productId);
  return productClass !== undefined &&
    productClass.product.serviceDisable.indexOf(fulfillmentId) === -1 &&
    hide_product_functor(display_flags) &&
    DisableDataCheck(productClass.product.disabled, productClass.product.availability, order_time).enable === DISABLE_REASON.ENABLED &&
    CheckRequiredModifiersAreAvailable(productClass.product, modifiers, catalogSelectors.option, order_time, fulfillmentId);
}

/**
 * 
 * @see FilterProductSelector
 */
export function FilterWCPProduct(productId: string, modifiers: ProductModifierEntry[], catalog: ICatalogSelectors, order_time: Date | number, fulfillmentId: string, filterIncomplete: boolean) {
  const productEntry = catalog.productEntry(productId);
  const newMetadata = WCPProductGenerateMetadata(productId, modifiers, catalog, order_time, fulfillmentId);
  return productEntry !== undefined && FilterProductSelector(productEntry.product, modifiers, newMetadata, catalog.option, order_time, fulfillmentId, filterIncomplete);
}

/**
 * 
 * @param product IProduct from the catalog
 * @param modifiers modifiers as the instance would be purchased
 * @param metadata the WProductMetadata computed with the same parameters passed to this function (exposed here for selector caching)
 * @param optionSelector selector IOptions
 * @param order_time the time the product would be ordered
 * @param fulfillmentId the fulfillment to check for the product to be disabled in
 * @param filterIncomplete flag for if we should filter incomplete products
 *     // !newMetadata.incomplete && // WAS GOING to remove this check as it caused products that were in the process of being configured to be removed from the customizer
 *   // I don't believe this check is actually needed as I'm not sure when a product would go FROM complete to incomplete with the change in time or a component being unselected
 *   // maybe it comes into play with a dependent modifier. If it's needed, then we can't use this function to check if something needs to be pulled from the customizer. 
 *   // INSTEAD: just added a flag to specify the intention
 * @returns true if the product passes filters for availability
 */
export function FilterProductSelector(product: IProduct, modifiers: ProductModifierEntry[], metadata: WProductMetadata, optionSelector: Selector<IOption>, order_time: Date | number, fulfillmentId: string, filterIncomplete: boolean) {
  const failsIncompleteCheck = !filterIncomplete || !metadata.incomplete;
  return failsIncompleteCheck &&
    product !== undefined && product.serviceDisable.indexOf(fulfillmentId) === -1 &&
    DisableDataCheck(product.disabled, product.availability, order_time).enable === DISABLE_REASON.ENABLED &&
    modifiers.reduce((acc, modifier) => {
      const mdModifier = metadata.modifier_map[modifier.modifierTypeId];
      return acc && modifier.options.reduce((moAcc, mo) => {
        const modifierOption = optionSelector(mo.optionId);
        return moAcc && modifierOption !== undefined &&
          ((mo.placement === OptionPlacement.LEFT && mdModifier.options[mo.optionId].enable_left.enable === DISABLE_REASON.ENABLED) ||
            (mo.placement === OptionPlacement.RIGHT && mdModifier.options[mo.optionId].enable_right.enable === DISABLE_REASON.ENABLED) ||
            (mo.placement === OptionPlacement.WHOLE && mdModifier.options[mo.optionId].enable_whole.enable === DISABLE_REASON.ENABLED)) &&
          DisableDataCheck(modifierOption.disabled, modifierOption.availability, order_time).enable === DISABLE_REASON.ENABLED;
      }, true);
    }, true);
}

/**
 * Checks that all the objects referenced by the product as it's built at least exist in the catalog
 * Does not check for availability/orderability 
 * @param productId product type to look for in the catalog
 * @param modifiers product modifier placements
 * @param catalog catalog source
 * @returns true if all the referenced objects exist in the catalog, else false. 
 */
export function DoesProductExistInCatalog(productId: string, modifiers: ProductModifierEntry[], catalog: Pick<ICatalogSelectors, "option" | "modifierEntry" | "productEntry">) {
  const product = catalog.productEntry(productId);
  return product !== undefined &&
    modifiers.reduce((acc, mod) => acc && catalog.modifierEntry(mod.modifierTypeId) !== undefined &&
      mod.options.reduce((optAcc, o) => optAcc && catalog.option(o.optionId) !== undefined, true), true);
}

export function CanThisBeOrderedAtThisTimeAndFulfillmentCatalog(productId: string, modifiers: ProductModifierEntry[], catalog: ICatalogSelectors, serviceTime: Date | number, fulfillment: string, filterIncomplete: boolean) {
  return DoesProductExistInCatalog(productId, modifiers, catalog) && FilterWCPProduct(productId, modifiers, catalog, serviceTime, fulfillment, filterIncomplete);
}

export function SelectProductInstancesInCategory(catalogCategory: CatalogCategoryEntry, productSelector: ICatalogSelectors['productEntry']) {
  return catalogCategory.products.reduce((acc, productId) => {
    const product = productSelector(productId);
    if (product) {
      return [...acc, ...product.instances];
    }
    return acc;
  }, [] as string[])
}