import { TOPPING_NONE, TOPPING_LEFT, TOPPING_RIGHT, TOPPING_WHOLE } from "../common";
import WCPProduct from "./WCPProduct";
import WCPOption from "./WCPOption";

function WARIOPlacementToLocalPlacementEnum(w_placement) {
  switch (w_placement) {
    case "WHOLE": return TOPPING_WHOLE; break;
    case "LEFT": return TOPPING_LEFT; break;
    case "RIGHT": return TOPPING_RIGHT; break;
    default: break;
  };
  return TOPPING_NONE;
}

export const WMenu = function (catalog) {
  function ComputeModifiers(cat) {
    var mods = {};
    for (var mtid in cat.modifiers) {
      var mod = cat.modifiers[mtid].modifier_type;
      var opt_index = 0;
      var modifier_entry = { modifier_type: mod, options_list: [], options: {} };
      cat.modifiers[mtid].options.sort((a, b) => a.ordinal - b.ordinal).forEach((opt) => {
        var option = new WCPOption(mod, opt, opt_index, opt.enable_function);
        modifier_entry.options_list.push(option);
        modifier_entry.options[option.moid] = option;
        ++opt_index;
      });
      mods[mtid] = modifier_entry;
    }
    return mods;
  }

  function ComputeProducts(cat) {
    var prods = {};
    for (var pid in cat.products) {
      var product_class = cat.products[pid].product;
      // be sure to sort the modifiers, just in case...
      // TODO: better expectations around sorting
      product_class.modifiers.sort((a, b) => cat.modifiers[a].modifier_type.ordinal - cat.modifiers[b].modifier_type.ordinal);
      var product_entry = { product: product_class, instances_list: [], instances: {} };
      cat.products[pid].instances.sort((a, b) => a.ordinal - b.ordinal).forEach((prod) => {
        var modifiers = {};
        prod.modifiers.forEach((mod) => {
          modifiers[mod.modifier_type_id] = mod.options.map((option_placement) => 
            [WARIOPlacementToLocalPlacementEnum(option_placement.placement), option_placement.option_id]);
        });
        var product_instance = new WCPProduct(
          product_class,
          prod._id,
          prod.item.display_name,
          prod.item.description,
          prod.ordinal,
          modifiers,
          prod.item.shortcode,
          prod.item.price.amount / 100,
          prod.item.disabled,
          prod.is_base,
          prod.display_flags);
        product_entry.instances_list.push(product_instance);
        product_entry.instances[product_instance.piid] = product_instance;
      });
      prods[pid] = product_entry;
    }
    return prods;
  };

  function ComputeCategories(cat, product_classes) {
    var cats = {};
    for (var catid in cat.categories) {
      var category_entry = {
        menu: [],
        children: cat.categories[catid].children.sort(function (a, b) { return cat.categories[a].category.ordinal - cat.categories[b].category.ordinal; }),
        menu_name: cat.categories[catid].category.description ? cat.categories[catid].category.description : cat.categories[catid].category.name,
        subtitle: cat.categories[catid].category.subheading ? cat.categories[catid].category.subheading : null,
      }
      cat.categories[catid].products.forEach(function (product_class) {
        category_entry.menu = category_entry.menu.concat(product_classes[product_class].instances_list);
      })
      category_entry.menu.sort(function (a, b) { return a.ordinal - b.ordinal; });
      cats[catid] = category_entry;
    };
    return cats;
  }
  // modifiers are { MID: { modifier_type: WARIO modifier type JSON, options_list: [WCPOption], options: {OID: WCPOption} } }
  this.modifiers = ComputeModifiers(catalog);
  // product_classes are { PID: { product: WARIO product class, instances_list: [WCPProduct], instances: {PIID: WCPProduct} } }
  this.product_classes = ComputeProducts(catalog);
  // categories are {CID: { menu: [WCPProducts], children: [CID], menu_name: HTML safe string, subtitle: HTML safe string } }
  this.categories = ComputeCategories(catalog, this.product_classes);
  // initialize everything
  for (var pid in this.product_classes) {
    this.product_classes[pid].instances_list.forEach((pi) => pi.Initialize(this));
  };
  this.version = catalog.version;
};
