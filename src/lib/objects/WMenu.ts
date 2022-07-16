import { DisableDataCheck } from "../common";
import { CategoryEntry, ICatalog, IMenu, IProductInstance, MenuCategories, MenuModifiers, RecordProductInstanceFunctions, MenuProductInstanceMetadata, MenuProducts, ModifierEntry, ProductEntry, WCPOption } from "../types";

import { CreateWCPProductFromPI, WCPProductGenerateMetadata } from "./WCPProduct";

type DisableFlagGetterType = (x: any) => boolean;
/**
 * Checks if a product is enabled and visible
 * @param {IProductInstance} item - the product to check 
 * @param {IMenu} menu - the menu from which to pull catalog data
 * @param {function(Object): boolean} disable_from_menu_flag_getter - getter function to pull the proper display flag from the products
 * @param {Date} order_time - the time to use to check for disable/enable status
 * @returns {boolean} returns true if item is enabled and visible
 */
export function FilterProduct(item: IProductInstance, menu: IMenu, disable_from_menu_flag_getter: DisableFlagGetterType, order_time: Date) {
  let passes = !disable_from_menu_flag_getter(item.display_flags) && DisableDataCheck(menu.product_classes[item.product_id].product.disabled, order_time);
  // this is better as a forEach as it gives us the ability to skip out of the loop early
  item.modifiers.forEach(modifier => {
    // TODO: for incomplete product instances, this should check for a viable way to order the product
    const mtOptions = menu.modifiers[modifier.modifier_type_id].options;
    passes &&= modifier.options.reduce((acc: boolean, x) => (acc && DisableDataCheck(mtOptions[x.option_id].mo.item.disabled, order_time)), true);
  });
  return passes;
}

/**
 * Returns a function used to filter out categories without products after having filtered out
 * empty or disabled products
 * @param {IMenu} menu - the menu from which to pull catalog data
 * @param {function(Object): boolean} disable_from_menu_flag_getter - getter function to pull the proper display flag from the products
 * @param {Date} order_time - the time to use to check for disable/enable status
 * @returns {function(String): boolean} function that takes a category ID and returns true if the category is not empty
 */
export function FilterEmptyCategories(menu: IMenu, disable_from_menu_flag_getter: DisableFlagGetterType, order_time: Date) {
  return (CAT_ID: string) => {
    const cat_menu = menu.categories[CAT_ID].menu;
    for (let i = 0; i < cat_menu.length; ++i) {
      if (FilterProduct(cat_menu[i], menu, disable_from_menu_flag_getter, order_time)) {
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
 * @param {Date} order_time 
 */
export function FilterWMenu(menu: IMenu, filter_products: (product: IProductInstance) => boolean, order_time: Date) {
  // prune categories via DFS
  {
    const catIdsToRemove: { [index: string]: boolean } = {};
    const catIdsVisited: { [index: string]: boolean } = {};
    const VisitCategory = (cat_id: string) => {
      if (!Object.hasOwn(catIdsVisited, cat_id)) {
        catIdsVisited[cat_id] = true;
        menu.categories[cat_id].children.forEach(x => VisitCategory(x));
        menu.categories[cat_id].menu = menu.categories[cat_id].menu.filter(filter_products);
        menu.categories[cat_id].children = menu.categories[cat_id].children.filter(x => !Object.hasOwn(catIdsToRemove, x));
        if (menu.categories[cat_id].children.length === 0 &&
          menu.categories[cat_id].menu.length === 0) {
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
    menu.modifiers[mtid].options_list = menu.modifiers[mtid].options_list.filter((opt) => DisableDataCheck(opt.mo.item.disabled, order_time));
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
    const mod = cat.modifiers[mtid].modifier_type;
    let opt_index = 0;
    const modifier_entry: ModifierEntry = { modifier_type: mod, options_list: [], options: {} };
    cat.modifiers[mtid].options.slice().sort((a, b) => a.ordinal - b.ordinal).forEach((opt) => {
      const option: WCPOption = { index: opt_index, mo: opt, mt: mod };
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
    const product_instances = cat.products[pId].instances.slice().sort((a, b) => a.ordinal - b.ordinal);
    const baseProductInstanceIndex = product_instances.findIndex(x => x.is_base);
    if (baseProductInstanceIndex !== -1) {
      // be sure to sort the modifiers, just in case...
      // TODO: better expectations around sorting
      product_class.modifiers = [...product_class.modifiers].sort((a, b) => cat.modifiers[a.mtid].modifier_type.ordinal - cat.modifiers[b.mtid].modifier_type.ordinal);
      const product_entry: ProductEntry = { product: product_class, instances_list: [], instances: {}, base_id: product_instances[baseProductInstanceIndex].id };
      product_instances.forEach((pi) => {
        product_entry.instances_list.push(pi);
        product_entry.instances[pi.id] = pi;
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
    const category_entry: CategoryEntry = {
      menu: [],
      children: [...cat.categories[catId].children].sort((a, b) => cat.categories[a].category.ordinal - cat.categories[b].category.ordinal),
      menu_name: cat.categories[catId].category.description || cat.categories[catId].category.name,
      subtitle: cat.categories[catId].category?.subheading || null,
      footer: cat.categories[catId].category?.footnotes || null
    }
    cat.categories[catId].products.forEach((product_class) => {
      if (Object.hasOwn(product_classes, product_class)) {
        category_entry.menu = category_entry.menu.concat(product_classes[product_class].instances_list);
      }
    })
    category_entry.menu.sort((a, b) => a.ordinal - b.ordinal);
    cats[catId] = category_entry;
  });
  return cats;
}

function ComputeProductInstanceMetadata(menuProducts: MenuProducts, menuModifiers: MenuModifiers, menuProductInstanceFunctions: RecordProductInstanceFunctions, service_time: Date) {
  const md: MenuProductInstanceMetadata = {};
  Object.values(menuProducts).forEach(productEntry => {
    productEntry.instances_list.forEach(pi => {
      md[pi.id] = WCPProductGenerateMetadata(CreateWCPProductFromPI(productEntry.product, pi, menuModifiers), productEntry, menuModifiers, menuProductInstanceFunctions, service_time)
    });
  });
  return md;
}

export function GenerateMenu(catalog: ICatalog, service_time: Date) {
  const modifiers = ComputeModifiers(catalog);
  const product_classes = ComputeProducts(catalog);
  const categories = ComputeCategories(catalog, product_classes);
  const product_instance_metadata = ComputeProductInstanceMetadata(product_classes, modifiers, catalog.product_instance_functions, service_time);
  const product_instance_functions = { ...catalog.product_instance_functions };
  const menu: IMenu = { modifiers, product_classes, product_instance_metadata, categories, product_instance_functions, version: catalog.version };
  return menu;
}