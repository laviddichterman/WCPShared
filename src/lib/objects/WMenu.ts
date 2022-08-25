import { DisableDataCheck } from "../common";
import {
  CategoryEntry,
  ICatalog,
  IMenu,
  IProductInstance,
  MenuCategories,
  MenuModifiers,
  MenuProductInstanceMetadata,
  MenuProducts,
  ModifierEntry,
  ProductEntry,
  WCPOption,
  WCPProduct,
  OptionPlacement,
  DISABLE_REASON
} from "../types";

import { CreateWCPProduct, WCPProductGenerateMetadata } from "./WCPProduct";

type DisableFlagGetterType = (x: any) => boolean;
/**
 * Checks if a product is enabled and visible
 * @param {IProductInstance} item - the product to check 
 * @param {IMenu} menu - the menu from which to pull catalog data
 * @param {function(Object): boolean} disable_from_menu_flag_getter - getter function to pull the proper display flag from the products
 * @param {Date | number} order_time - from getTime or Date.valueOf() the time to use to check for disable/enable status
 * @param {string} fulfillmentId - the service selected
 * @returns {boolean} returns true if item is enabled and visible
 */
export function FilterProduct(item: IProductInstance, menu: IMenu, disable_from_menu_flag_getter: DisableFlagGetterType, order_time: Date | number, fulfillmentId: string) {
  const menuModifiers = menu.modifiers;
  const productClass = menu.product_classes[item.productId];
  let passes = productClass !== undefined &&
    productClass.product.serviceDisable.indexOf(fulfillmentId) === -1 &&
    !disable_from_menu_flag_getter(item.displayFlags) &&
    DisableDataCheck(productClass.product.disabled, order_time).enable === DISABLE_REASON.ENABLED;
  // this is better as a forEach as it gives us the ability to skip out of the loop early
  item.modifiers.forEach((productModifierEntry) => {
    // TODO: for incomplete product instances, this should check for a viable way to order the product
    const menuModifierType = menuModifiers[productModifierEntry.modifierTypeId];
    const mtOptions = menuModifierType.options;
    const productModifierDefinition = productClass.product.modifiers.find(x => x.mtid === productModifierEntry.modifierTypeId)!;
    passes &&= productModifierDefinition.serviceDisable.indexOf(fulfillmentId) === -1 &&
      productModifierEntry.options.reduce((acc: boolean, x) =>
        (acc && DisableDataCheck(mtOptions[x.optionId].mo.disabled, order_time).enable === DISABLE_REASON.ENABLED), true);
  });
  return passes;
}

/**
 * 
 * @param item product, potentially customized, as would be purchased
 * @param menu the current menu
 * @param order_time the time the product would be ordered
 * @returns true if the product passes filters for availability
 */
export function FilterWCPProduct(item: WCPProduct, catalog: ICatalog, menu: IMenu, order_time: Date | number, fulfillmentId: string) {
  const productEntry = menu.product_classes[item.PRODUCT_CLASS.id];
  const newMetadata = WCPProductGenerateMetadata(item, productEntry, catalog, menu.modifiers, order_time, fulfillmentId);
  return productEntry.product.serviceDisable.indexOf(fulfillmentId) === -1 &&
    DisableDataCheck(productEntry.product.disabled, order_time) &&
    !newMetadata.incomplete &&
    item.modifiers.reduce((acc, modifier) => {
      const menuModifier = menu.modifiers[modifier.modifierTypeId];
      const mdModifier = newMetadata.modifier_map[modifier.modifierTypeId];
      return acc && modifier.options.reduce((moAcc, mo) => moAcc &&
        ((mo.placement === OptionPlacement.LEFT && mdModifier.options[mo.optionId].enable_left.enable === DISABLE_REASON.ENABLED) ||
          (mo.placement === OptionPlacement.RIGHT && mdModifier.options[mo.optionId].enable_right.enable === DISABLE_REASON.ENABLED) ||
          (mo.placement === OptionPlacement.WHOLE && mdModifier.options[mo.optionId].enable_whole.enable === DISABLE_REASON.ENABLED)) &&
        DisableDataCheck(menuModifier.options[mo.optionId].mo.disabled, order_time).enable === DISABLE_REASON.ENABLED, true);
    }, true);
}


/**
 * Returns a function used to filter out categories without products after having filtered out
 * empty or disabled products
 * @param {IMenu} menu - the menu from which to pull catalog data
 * @param {function(Object): boolean} disable_from_menu_flag_getter - getter function to pull the proper display flag from the products
 * @param {Date | number} order_time - the time to use to check for disable/enable status
 * @param {string} fulfillmentId - the fulfillment
 * @returns {function(String): boolean} function that takes a category ID and returns true if the category is not empty
 */
export function FilterEmptyCategories(menu: IMenu, disable_from_menu_flag_getter: DisableFlagGetterType, order_time: Date | number, fulfillmentId: string) {
  return (CAT_ID: string) => {
    const cat = menu.categories[CAT_ID];
    if (cat.serviceDisable.indexOf(fulfillmentId) !== -1) {
      return false;
    }
    const cat_menu = cat.menu;
    for (let i = 0; i < cat_menu.length; ++i) {
      if (FilterProduct(cat_menu[i], menu, disable_from_menu_flag_getter, order_time, fulfillmentId)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Mutates the passed menu instance to remove disabled categories, products, modifier types, and modifier options
 * unfortunately since we're modifying the data structure we're using to determine what should be disabled
 * we need to do this inefficiently, 
 * @param {WMenu} menu 
 * @param {function(WCPProduct): boolean} filter_products 
 * @param {Date | number} order_time 
 * @param {string} fulfillmentId - the fulfillment
 * 
 */
export function FilterWMenu(menu: IMenu, filter_products: (product: IProductInstance) => boolean, order_time: Date | number, fulfillmentId: string) {
  // prune categories via DFS
  {
    const catIdsToRemove: Record<string, boolean> = {};
    const catIdsVisited: Record<string, boolean> = {};
    const VisitCategory = (cat_id: string) => {
      if (!Object.hasOwn(catIdsVisited, cat_id)) {
        const menuCat = menu.categories[cat_id];
        catIdsVisited[cat_id] = true;
        menuCat.children.forEach(x => VisitCategory(x));
        menuCat.menu = menu.categories[cat_id].menu.filter(filter_products);
        menuCat.children = menuCat.children.filter(x => !Object.hasOwn(catIdsToRemove, x));
        if ((menuCat.children.length === 0 &&
          menuCat.menu.length === 0) || menuCat.serviceDisable.indexOf(fulfillmentId) !== -1) {
          catIdsToRemove[cat_id] = true;
          delete menu.categories[cat_id];
        }
      }
    }

    Object.keys(menu.categories).forEach(catId => {
      if (!Object.hasOwn(catIdsVisited, catId)) {
        VisitCategory(catId);
      }
    });
  }

  // prune product instances and product classes as appropriate
  Object.keys(menu.product_classes).forEach(pid => {
    menu.product_classes[pid].instances_list = menu.product_classes[pid].instances_list.filter(filter_products);
    if (menu.product_classes[pid].instances_list.length > 0) {
      menu.product_classes[pid].instances = menu.product_classes[pid].instances_list.reduce((acc, x) => Object.assign(acc, { [x.id]: x }), {})
    }
    else {
      delete menu.product_classes[pid];
    }
  });

  // prune modifier options and types as appropriate
  Object.keys(menu.modifiers).forEach(mtid => {
    menu.modifiers[mtid].options_list = menu.modifiers[mtid].options_list.filter((opt) => DisableDataCheck(opt.mo.disabled, order_time));
    if (menu.modifiers[mtid].options_list.length > 0) {
      menu.modifiers[mtid].options = menu.modifiers[mtid].options_list.reduce((acc, x) => Object.assign(acc, { [x.mo.id]: x }), {})
    }
    else {
      delete menu.modifiers[mtid];
    }
  });
}

function ComputeModifiers(cat: ICatalog) {
  const mods = {} as MenuModifiers;
  Object.keys(cat.modifiers).forEach((mtid) => {
    const mod = cat.modifiers[mtid].modifierType;
    let opt_index = 0;
    const modifier_entry: ModifierEntry = { modifier_type: mod, options_list: [], options: {} };
    cat.modifiers[mtid].options.slice()
      .sort((a, b) => cat.options[a].ordinal - cat.options[b].ordinal)
      .forEach((opt) => {
        const option: WCPOption = { index: opt_index, mo: cat.options[opt], mt: mod };
        modifier_entry.options_list.push(option);
        modifier_entry.options[option.mo.id] = option;
        opt_index += 1;
      });
    mods[mtid] = modifier_entry;
  });
  return mods;
}


function ComputeProducts(cat: ICatalog) {
  const prods = {} as MenuProducts;
  Object.keys(cat.products).forEach(pId => {
    const product_class = { ...cat.products[pId].product };
    // IMPORTANT: we need to sort by THIS ordinal here to ensure things are named properly.
    const product_instances = cat.products[pId].instances.slice().sort((a, b) => cat.productInstances[a].ordinal - cat.productInstances[b].ordinal);
    const baseProductInstanceIndex = product_instances.findIndex(x => cat.productInstances[x].isBase);
    if (baseProductInstanceIndex !== -1) {
      // be sure to sort the modifiers, just in case...
      // TODO: better expectations around sorting
      product_class.modifiers = [...product_class.modifiers].sort((a, b) => cat.modifiers[a.mtid].modifierType.ordinal - cat.modifiers[b.mtid].modifierType.ordinal);
      const product_entry: ProductEntry = { product: product_class, instances_list: [], instances: {}, baseId: product_instances[baseProductInstanceIndex] };
      product_instances.forEach((pi) => {
        product_entry.instances_list.push(cat.productInstances[pi]);
        product_entry.instances[pi] = cat.productInstances[pi];
      });
      prods[pId] = product_entry;
    }
    else {
      console.error(`Pruning incomplete product ${product_class}`);
    }
  });
  return prods;
};


function ComputeCategories(cat: ICatalog, product_classes: MenuProducts) {
  const cats: MenuCategories = {};
  Object.keys(cat.categories).forEach(catId => {
    const catalogCategory = cat.categories[catId];
    const category_entry: CategoryEntry = {
      menu: [],
      children: [...catalogCategory.children].sort((a, b) => cat.categories[a].category.ordinal - cat.categories[b].category.ordinal),
      menu_name: catalogCategory.category.description || catalogCategory.category.name,
      subtitle: catalogCategory.category?.subheading || null,
      footer: catalogCategory.category?.footnotes || null,
      serviceDisable: [...catalogCategory.category.serviceDisable],
      nesting: catalogCategory.category.display_flags.nesting
    }
    catalogCategory.products.forEach((product_class) => {
      if (Object.hasOwn(product_classes, product_class)) {
        category_entry.menu = category_entry.menu.concat(product_classes[product_class].instances_list);
      }
    })
    category_entry.menu.sort((a, b) => a.ordinal - b.ordinal);
    cats[catId] = category_entry;
  });
  return cats;
}

function ComputeProductInstanceMetadata(menuProducts: MenuProducts, catalog: ICatalog, menuModifiers: MenuModifiers, service_time: Date | number, fulfillmentId: string) {
  const md: MenuProductInstanceMetadata = {};
  Object.values(menuProducts).forEach(productEntry => {
    productEntry.instances_list.forEach(pi => {
      md[pi.id] = WCPProductGenerateMetadata(CreateWCPProduct(productEntry.product, pi.modifiers), productEntry, catalog, menuModifiers, service_time, fulfillmentId)
    });
  });
  return md;
}

export function GenerateMenu(catalog: ICatalog, service_time: Date | number, fulfillmentId: string) {
  const modifiers = ComputeModifiers(catalog);
  const product_classes = ComputeProducts(catalog);
  const categories = ComputeCategories(catalog, product_classes);
  const product_instance_metadata = ComputeProductInstanceMetadata(product_classes, catalog, modifiers, service_time, fulfillmentId);
  const menu: IMenu = { modifiers, product_classes, product_instance_metadata, categories, version: catalog.version };
  return menu;
}

export function DoesProductExistInMenu(menu: IMenu, product: WCPProduct) {
  return Object.hasOwn(menu.product_classes, product.PRODUCT_CLASS.id) &&
    product.modifiers.reduce((acc, mod) => acc &&
      Object.hasOwn(menu.modifiers, mod.modifierTypeId) &&
      mod.options.reduce((optAcc, o) => optAcc && Object.hasOwn(menu.modifiers[mod.modifierTypeId].options, o.optionId), true), true);
}

export function CanThisBeOrderedAtThisTimeAndFulfillment(product: WCPProduct, menu: IMenu, catalog: ICatalog, serviceTime: Date | number, fulfillment: string) {
  return DoesProductExistInMenu(menu, product) && FilterWCPProduct(product, catalog, menu, serviceTime, fulfillment);
}