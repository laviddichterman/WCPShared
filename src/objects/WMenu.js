import { TOPPING_NONE, TOPPING_LEFT, TOPPING_RIGHT, TOPPING_WHOLE, DisableDataCheck } from "../common";
import { WCPProduct } from "./WCPProduct";
import { WCPOption } from "./WCPOption";

function WARIOPlacementToLocalPlacementEnum(w_placement) {
  switch (w_placement) {
    case "WHOLE": return TOPPING_WHOLE;
    case "LEFT": return TOPPING_LEFT;
    case "RIGHT": return TOPPING_RIGHT;
    default: break;
  };
  return TOPPING_NONE;
}

/**
 * Checks if a product is enabled and visible
 * @param {WCPProduct} item - the product to check 
 * @param {WMenu} menu - the menu from which to pull catalog data
 * @param {function(Object): boolean} disable_from_menu_flag_getter - getter function to pull the proper display flag from the products
 * @param {moment} order_time - the time to use to check for disable/enable status
 * @returns {boolean} returns true if item is enabled and visible
 */
export function FilterProduct(item, menu, disable_from_menu_flag_getter, order_time) {
  let passes = !disable_from_menu_flag_getter(item.display_flags) && DisableDataCheck(item.PRODUCT_CLASS.disabled, order_time);
  Object.keys(item.modifiers).forEach(mtid => {
    // TODO: for incomplete product instances, this should check for a viable way to order the product
    passes = passes && Math.min(1, Math.min.apply(null, item.modifiers[mtid].map((x) => DisableDataCheck(menu.modifiers[mtid].options[x[1]].disable_data, order_time))));
  });
  return passes;
}

/**
 * Returns a function used to filter out categories without products after having filtered out
 * empty or disabled products
 * @param {WMenu} menu - the menu from which to pull catalog data
 * @param {function(Object): boolean} disable_from_menu_flag_getter - getter function to pull the proper display flag from the products
 * @param {moment} order_time - the time to use to check for disable/enable status
 * @returns {function(String): boolean} function that takes a category ID and returns true if the category is not empty
 */
export function FilterEmptyCategories(menu, disable_from_menu_flag_getter, order_time) {
  return ( CAT_ID ) => {
    const cat_menu = menu.categories[CAT_ID].menu;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < cat_menu.length; ++i) {
      if (FilterProduct(cat_menu[i], menu, disable_from_menu_flag_getter, order_time)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Mutates the passed menu instance to remove disabled categories, products, modifer types, and modifer options
 * unfortunately since we're modifying the data structure we're using to determine what should be disabled
 * we need to do this inefficiently, 
 * @param {WMenu} menu 
 * @param {function(WCPProduct): boolean} filter_products 
 * @param {moment} order_time 
 */
export function FilterWMenu(menu, filter_products, order_time) {
  // prune categories via DFS
  {
    const catids_to_remove = {};
    const catids_visited = {};
    const VisitCategory = (cat_id) => {
      if (!Object.hasOwn(catids_visited, cat_id)) {
        catids_visited[cat_id] = true;
        menu.categories[cat_id].children.forEach(x=>VisitCategory(x));
        menu.categories[cat_id].menu = menu.categories[cat_id].menu.filter(filter_products);
        menu.categories[cat_id].children = menu.categories[cat_id].children.filter(x => !Object.hasOwn(catids_to_remove, x));
        if (menu.categories[cat_id].children.length === 0 && 
            menu.categories[cat_id].menu.length === 0) {
          catids_to_remove[cat_id] = true;
          delete menu.categories[cat_id];
        }
      }
    }
    
    Object.keys(menu.categories).forEach(catid => {
      if (!Object.hasOwn(catids_visited, catid)) {
        VisitCategory(catid);
      }
    });
  }

  // prune product instances and product classes as appropriate
  Object.keys(menu.product_classes).forEach(pid => {
    menu.product_classes[pid].instances_list = menu.product_classes[pid].instances_list.filter(filter_products);
    if (menu.product_classes[pid].instances_list.length > 0) {
      menu.product_classes[pid].instances = menu.product_classes[pid].instances_list.reduce((acc, x) => Object.assign(acc, {[x.piid]: x}), {})
    }
    else {
      delete menu.product_classes[pid];
    }
  });

  // prune modifier options and types as appropriate
  Object.keys(menu.modifiers).forEach(mtid => { 
    menu.modifiers[mtid].options_list = menu.modifiers[mtid].options_list.filter((opt) => DisableDataCheck(opt.disable_data, order_time));
    if (menu.modifiers[mtid].options_list.length > 0) {
      menu.modifiers[mtid].options = menu.modifiers[mtid].options_list.reduce((acc, x) => Object.assign(acc, {[x.moid]: x}), {})
    }
    else {
      delete menu.modifiers[mtid];
    }
  });

}

// eslint-disable-next-line func-names
export const WMenu = function(catalog) {
  function ComputeModifiers(cat) {
    const mods = {};
    Object.keys(cat.modifiers).forEach((mtid) => {
      const mod = cat.modifiers[mtid].modifier_type;
      let opt_index = 0;
      const modifier_entry = { modifier_type: mod, options_list: [], options: {} };
      cat.modifiers[mtid].options.sort((a, b) => a.ordinal - b.ordinal).forEach((opt) => {
        const option = new WCPOption(mod, opt, opt_index, opt.enable_function);
        modifier_entry.options_list.push(option);
        modifier_entry.options[option.moid] = option;
        opt_index += 1;
      });
      mods[mtid] = modifier_entry;
    });
    return mods;
  }

  function ComputeProducts(cat) {
    const prods = {};
    Object.keys(cat.products).forEach(pid => {
      const product_class = cat.products[pid].product;
      // be sure to sort the modifiers, just in case...
      // TODO: better expectations around sorting
      product_class.modifiers.sort((a, b) => cat.modifiers[a.mtid].modifier_type.ordinal - cat.modifiers[b.mtid].modifier_type.ordinal);
      const product_entry = { product: product_class, instances_list: [], instances: {} };
      // IMPORTANT: we need to sort by THIS ordinal here to ensure things are named properly.
      const product_instances = cat.products[pid].instances.sort((a, b) => a.ordinal - b.ordinal);
      const hasBaseProductInstance = product_instances.findIndex(x=>x.is_base) !== -1;
      if (hasBaseProductInstance) {
        product_instances.forEach((prod) => {
          const modifiers = {};
          prod.modifiers.forEach((mod) => {
            modifiers[mod.modifier_type_id] = mod.options.map((option_placement) => 
              [WARIOPlacementToLocalPlacementEnum(option_placement.placement), option_placement.option_id]);
          });
          const product_instance = new WCPProduct(
            product_class,
            prod._id,
            prod.item.display_name,
            prod.item.description,
            prod.ordinal,
            modifiers,
            prod.item.shortcode,
            prod.is_base,
            prod.display_flags);
          product_entry.instances_list.push(product_instance);
          product_entry.instances[product_instance.piid] = product_instance;
        });
        prods[pid] = product_entry;
      }
      else {
        console.error(`Pruning incomplete product ${product_class}`);
      }
    });
    return prods;
  };

  function ComputeCategories(cat, product_classes) {
    const cats = {};
    Object.keys(cat.categories).forEach(catid => {
      const category_entry = {
        menu: [],
        children: cat.categories[catid].children.sort((a, b) => cat.categories[a].category.ordinal - cat.categories[b].category.ordinal),
        menu_name: cat.categories[catid].category.description ? cat.categories[catid].category.description : cat.categories[catid].category.name,
        subtitle: cat.categories[catid].category.subheading ? cat.categories[catid].category.subheading : null,
      }
      cat.categories[catid].products.forEach((product_class) => {
        if (Object.hasOwn(product_classes, product_class)) { 
          category_entry.menu = category_entry.menu.concat(product_classes[product_class].instances_list);
        }
      })
      category_entry.menu.sort((a, b) => a.ordinal - b.ordinal);
      cats[catid] = category_entry;
    });
    return cats;
  }
  // modifiers are { MID: { modifier_type: WARIO modifier type JSON, options_list: [WCPOption], options: {OID: WCPOption} } }
  this.modifiers = ComputeModifiers(catalog);
  // product_classes are { PID: { product: WARIO product class, instances_list: [WCPProduct], instances: {PIID: WCPProduct} } }
  this.product_classes = ComputeProducts(catalog);
  // categories are {CID: { menu: [WCPProducts], children: [CID], menu_name: HTML safe string, subtitle: HTML safe string } }
  this.categories = ComputeCategories(catalog, this.product_classes);
  // initialize everything
  Object.values(this.product_classes).forEach(pc => pc.instances_list.forEach(pi => pi.Initialize(this)));
  this.version = catalog.version;
};
