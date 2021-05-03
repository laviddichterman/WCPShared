import { TOPPING_NONE, TOPPING_LEFT, TOPPING_RIGHT, TOPPING_WHOLE, NO_MATCH, AT_LEAST, EXACT_MATCH, LEFT_SIDE, RIGHT_SIDE, DisableDataCheck } from "../common";
import { WFunctional } from "./WFunctional";
const moment = require("moment");

function DeepCopyPlacedOptions(modifiers) {
  var ret = {};
  for (var mid in modifiers) {
    ret[mid] = modifiers[mid].map(function (x) { return [x[0], x[1]]; });
  }
  return ret;
}

function GetModifierOptionFromMIDOID(menu, mid, oid) {
  return menu.modifiers[mid].options[oid];
}

function ExtractMatch(matrix) {
  // we take the min of EXACT_MATCH and the thing we just computed because if there are no modifiers, then we'll get Infinity
  return Math.min(EXACT_MATCH, Math.min.apply(0, matrix.map(function (modcompare_arr) {
    return Math.min.apply(0, modcompare_arr);
  })));
};

const ComponentsList = (source, getter) => {
  return source.map(function (x) {
    return getter(x);
  });
}
const ComponentsListName = (source) => {
  return ComponentsList(source.filter(x => !x.display_flags || !x.display_flags.omit_from_name), x=>x.name);
}
const ComponentsListShortname = (source) => {
  return ComponentsList(source.filter(x => !x.display_flags || !x.display_flags.omit_from_shortname), x => x.shortname);
}

export function CopyWCPProduct(pi) {
  return new WCPProduct(pi.PRODUCT_CLASS, pi.piid, pi.name, pi.description, pi.ordinal, pi.modifiers, pi.shortcode, pi.base_price, pi.disable_data, pi.is_base, pi.display_flags);
}
export function WCPProductFromDTO(dto, MENU) {
  return new WCPProduct(MENU.product_classes[dto.pid].product, "", "", "", 0, dto.modifiers, "", 0, null, false, {});
}

// matrix of how products match indexed by [first placement][second placement] containing [left match, right match, break_mirror]
const MATCH_MATRIX = [
  [[EXACT_MATCH, EXACT_MATCH, false], [NO_MATCH, EXACT_MATCH, true], [EXACT_MATCH, NO_MATCH, true], [NO_MATCH, NO_MATCH, true]], // NONE
  [[AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, NO_MATCH, true]], // LEFT
  [[EXACT_MATCH, AT_LEAST, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, EXACT_MATCH, true]], // RIGHT
  [[AT_LEAST, AT_LEAST, true], [EXACT_MATCH, AT_LEAST, true], [AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, false]], // WHOLE
//[[ NONE ], [ LEFT ], [ RIGHT], [ WHOLE]]
];

// we need to take a map of these fields and allow name to be null if piid is _NOT_ set, piid should only be set if it's an exact match of a product instance in the catalog
export const WCPProduct = function (product_class, piid, name, description, ordinal, modifiers, shortcode, base_price, disable_data, is_base, display_flags) {
  this.PRODUCT_CLASS = product_class;
  this.piid = piid;
  this.name = name;
  this.description = description;
  this.ordinal = ordinal;
  this.disable_data = disable_data;
  this.is_base = is_base;
  this.shortcode = shortcode;
  this.display_flags = display_flags;
  // base price is passed in, current thinking is that it should be the base price of the base product instance.
  // cases where the base price of a certain configuration is different should be handled by different means
  // passed in price can either be the configured price for this instance or the base product price. only the base_price of the
  // base product instance is used
  this.base_price = base_price;
  this.base_product_piid = null;
  // product.modifiers[mtid] = [[placement, option_id]]
  // enum is 0: none, 1: left, 2: right, 3: both
  this.modifiers = DeepCopyPlacedOptions(modifiers);
  // memoized metadata
  this.price = null;
  this.is_split = false;
  this.bake_count = [0, 0];
  this.flavor_count = [0, 0];

  this.ComputePrice = function(MENU) {
    var price = MENU.product_classes[this.PRODUCT_CLASS._id].instances[this.base_product_piid].base_price;
    for (var mt in this.modifiers) {
      this.modifiers[mt].forEach(function(opt) {
        if (opt[0] != TOPPING_NONE) {
          price += MENU.modifiers[mt].options[opt[1]].price;
        }
      });
    }
    return price;
  };

  this.RecomputeMetadata = function(MENU) {
    // recomputes bake_count, flavor_count, is_split
    var bake_count = [0, 0];
    var flavor_count = [0, 0];
    var is_split = false;
    for (var mt in this.modifiers) {
      this.modifiers[mt].forEach(function(opt) {
        var option_obj = MENU.modifiers[mt].options[opt[1]];
        if (opt[0] === TOPPING_LEFT || opt[0] === TOPPING_WHOLE) {
          bake_count[LEFT_SIDE] += option_obj.bake_factor;
          flavor_count[LEFT_SIDE] += option_obj.flavor_factor;
        }
        if (opt[0] === TOPPING_RIGHT || opt[0] === TOPPING_WHOLE) {
          bake_count[RIGHT_SIDE] += option_obj.bake_factor;
          flavor_count[RIGHT_SIDE] += option_obj.flavor_factor;
        }
        is_split = is_split || opt[0] === TOPPING_LEFT || opt[0] === TOPPING_RIGHT;
      });
    }
    this.bake_count = bake_count;
    this.flavor_count = flavor_count;
    this.is_split = is_split;
  };

  function Compare(first, other, MENU) {
    var modifiers_match_matrix = [ [], [] ];

    // need to compare PIDs of first and other, then use the PID to develop the modifiers matrix since one of the two product instances might not have a value for every modifier.
    if (first.PRODUCT_CLASS._id != other.PRODUCT_CLASS._id) {
      // no match on PID so we need to return 0
      return { mirror: false, match_matrix: modifiers_match_matrix, match: [[[NO_MATCH]], [[NO_MATCH]]] }
    }

    // this is a multi-dim array, in order of the MTID as it exists in the product class definition
    // disabled modifier types and modifier options are all present as they shouldn't contribute to comparison mismatch
    // elements of the modifiers_match_matrix are arrays of <LEFT_MATCH, RIGHT_MATCH> tuples
    first.PRODUCT_CLASS.modifiers.forEach(function (modifier) {
      modifiers_match_matrix[LEFT_SIDE].push(new Array(MENU.modifiers[modifier.mtid].options_list.length).fill(EXACT_MATCH));
      modifiers_match_matrix[RIGHT_SIDE].push(new Array(MENU.modifiers[modifier.mtid].options_list.length).fill(EXACT_MATCH));
    })

    var is_mirror = true;
    // main comparison loop!
    first.PRODUCT_CLASS.modifiers.forEach(function (modifier, midx) {
      const mtid = modifier.mtid;
      var first_option_list = first.modifiers.hasOwnProperty(mtid) ? first.modifiers[mtid] : [];
      var other_option_list = other.modifiers.hasOwnProperty(mtid) ? other.modifiers[mtid] : [];
      // in each modifier, need to determine if it's a SINGLE or MANY select 
      var CATALOG_MODIFIER_INFO = MENU.modifiers[mtid];
      if (CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1) {
        // CASE: SINGLE select modifier, this logic isn't very well-defined. TODO: rework
        if (first_option_list.length === 1) {
          var first_option = first_option_list[0];
          var other_option = other_option_list.length === 1 ? other_option_list[0] : "";
          if (first_option[1] !== other_option[1]) {
            // OID doesn't match, need to set AT_LEAST for JUST the option on the "first" product
            CATALOG_MODIFIER_INFO.options_list.forEach(function (option, oidx) {
              // eslint-disable-next-line
              if (first_option[1] == option.moid) {
                modifiers_match_matrix[LEFT_SIDE][midx][oidx] = AT_LEAST;
                modifiers_match_matrix[RIGHT_SIDE][midx][oidx] = AT_LEAST;
                is_mirror = false;
              }
            });
          }
        }
      }
      else {
        // CASE: MULTI select modifier
        CATALOG_MODIFIER_INFO.options_list.forEach(function (option, oidx) {
          // todo: since the options will be in order, we can be smarter about not using a find here and track 2 indices instead   
          //var finder = modifier_option_find_function_factory(option.moid);     
          // eslint-disable-next-line
          var first_option = first_option_list.find(val => val[1] == option.moid );
          // eslint-disable-next-line
          var other_option = other_option_list.find(val => val[1] == option.moid );
          var first_option_placement = first_option ? first_option[0] : TOPPING_NONE;
          var other_option_placement = other_option ? other_option[0] : TOPPING_NONE;
          const MATCH_CONFIGURATION = MATCH_MATRIX[first_option_placement][other_option_placement];
          modifiers_match_matrix[LEFT_SIDE][midx][oidx] = MATCH_CONFIGURATION[LEFT_SIDE];
          modifiers_match_matrix[RIGHT_SIDE][midx][oidx] = MATCH_CONFIGURATION[RIGHT_SIDE];
          is_mirror = is_mirror && !MATCH_CONFIGURATION[2];
        });
      }
    });
    return {
      mirror: is_mirror,
      match_matrix: modifiers_match_matrix,
      match: [ExtractMatch(modifiers_match_matrix[LEFT_SIDE]), ExtractMatch(modifiers_match_matrix[RIGHT_SIDE])]
    };
  }

  this.Equals = function (other, MENU) {
    var comparison_info = Compare(this, other, MENU);
    return comparison_info.mirror ||
      (comparison_info.match[LEFT_SIDE] === EXACT_MATCH && comparison_info.match[RIGHT_SIDE] === EXACT_MATCH);
  };

  this.RecomputeName = function (MENU, service_time) {
    var PRODUCT_CLASS = this.PRODUCT_CLASS;
    var PRODUCT_CLASS_MENU_ENTRY = MENU.product_classes[PRODUCT_CLASS._id];

    // at this point we only know what product class we belong to. we might be an unmodified product, 
    // but that will need to be determined.
    var BASE_PRODUCT_INSTANCE = PRODUCT_CLASS_MENU_ENTRY.instances[this.base_product_piid];

    var match_info = { 
      // TODO: we don't need to track shortcode separately since we can pull it from the matched product
      shortcodes: [BASE_PRODUCT_INSTANCE.shortcode, BASE_PRODUCT_INSTANCE.shortcode],
      product: [null, null],
      comparison: [[], []],
      comparison_value: [EXACT_MATCH, EXACT_MATCH]
    }

    function CheckMatchForSide(side, comparison, comparison_product) {
      if (match_info.product[side] === null && comparison.match[side] !== NO_MATCH) {
        match_info.product[side] = comparison_product;
        match_info.comparison[side] = comparison.match_matrix[side];
        match_info.comparison_value[side] = comparison.match[side];
        match_info.shortcodes[side] = comparison_product.shortcode;
      }
    }

    function BuildName(product, service_time) {
      /* NOTE/TODO: 2021_05_02, current issue with the following code is a questionable dependency on what makes a complete product if 
          modifier options are disabled for non-dependent reasons (like, OOS or some other combination disable that isn't actually intended to make it impossible to complete a product)
          it's very possible that a more correct logic doesn't look at has_selectable in the modifier map for determining if the product is complete but rather looks at enable_modifier_type.
          if this is changed, then we need to catch creation of impossible-to-build products in the catalog, before they're surfaced to a customer.

          additionally, since we don't have any checks that we're not exceeding MAX_SELECTED as defined by the modifier type, the modifier_map values for enable_left, enable_right, enable_whole
          are not actually correct. but the fix for that might need to live in the WOption.IsEnabled method... but probably not since this is the function where we determine very specifically what 
          our selection count is for LEFT/RIGHT/WHOLE
      */
      console.assert(match_info.product[LEFT_SIDE] !== null && match_info.product[RIGHT_SIDE] !== null, "We should have both matches determined by now.");
      // assign shortcode (easy)
      product.shortcode = product.is_split && match_info.shortcodes[LEFT_SIDE] !== match_info.shortcodes[RIGHT_SIDE] ? match_info.shortcodes.join("|") : match_info.shortcodes[LEFT_SIDE];
      product.incomplete = false;

      // determine if we're comparing to the base product on the left and right sides
      var is_compare_to_base = [
        BASE_PRODUCT_INSTANCE.piid === match_info.product[LEFT_SIDE].piid,
        BASE_PRODUCT_INSTANCE.piid === match_info.product[RIGHT_SIDE].piid];  
      
      // mod map is { MTID: { has_selectable: boolean, meets_minimum: boolean, options: { MOID: {placement, enable_left, enable_right, enable_whole } } } }
      product.modifier_map = {};
      product.advanced_option_eligible = false;
      product.advanced_option_selected = false;
      // split out options beyond the base product into left additions, right additions, and whole additions
      // each entry in these arrays represents the modifier index on the product class and the option index in that particular modifier
      product.additional_options = { left: [], right: [], whole: [] };
      product.exhaustive_options = { left: [], right: [], whole: [] };
      PRODUCT_CLASS.modifiers.forEach(function (pc_modifier, mtidx) {
        const mtid = pc_modifier.mtid;
        const modifier_type_enable_function = pc_modifier.enable;
        const CATALOG_MODIFIER_INFO = MENU.modifiers[mtid];
        const is_single_select = CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1;
        const is_base_product_edge_case = is_single_select && !PRODUCT_CLASS.display_flags.show_name_of_base_product;
        product.modifier_map[mtid] = { has_selectable: false, meets_minimum: false, options: {} };
        const enable_modifier_type = modifier_type_enable_function === null || WFunctional.ProcessProductInstanceFunction(product, modifier_type_enable_function);
        for (var moidx = 0; moidx < CATALOG_MODIFIER_INFO.options_list.length; ++moidx) {
          const option_object = CATALOG_MODIFIER_INFO.options_list[moidx];
          const is_enabled = enable_modifier_type && DisableDataCheck(option_object.disable_data, service_time)
          const option_info = { 
            placement: TOPPING_NONE, 
            // do we need to figure out if we can de-select? answer: probably
            enable_left: is_enabled && option_object.can_split && option_object.IsEnabled(product, TOPPING_LEFT, MENU),
            enable_right: is_enabled && option_object.can_split && option_object.IsEnabled(product, TOPPING_RIGHT, MENU),
            enable_whole: is_enabled && option_object.IsEnabled(product, TOPPING_WHOLE, MENU),
          };
          const enable_left_or_right = option_info.enable_left || option_info.enable_right;
          product.advanced_option_eligible = product.advanced_option_eligible || enable_left_or_right;
          product.modifier_map[mtid].options[option_object.moid] = option_info;
          product.modifier_map[mtid].has_selectable = product.modifier_map[mtid].has_selectable || enable_left_or_right || option_info.enable_whole;
        }

        const num_selected = [0, 0];
        if (product.modifiers.hasOwnProperty(mtid)) {
          product.modifiers[mtid].forEach(function (placed_option) {
            const moid = placed_option[1];
            const location = placed_option[0];
            const moidx = CATALOG_MODIFIER_INFO.options[moid].index;
            product.modifier_map[mtid].options[moid].placement = location;
            switch (location) {
              case TOPPING_LEFT: product.exhaustive_options.left.push([mtid, moid]); ++num_selected[LEFT_SIDE]; product.advanced_option_selected = true; break;
              case TOPPING_RIGHT: product.exhaustive_options.right.push([mtid, moid]); ++num_selected[RIGHT_SIDE]; product.advanced_option_selected = true; break;
              case TOPPING_WHOLE: product.exhaustive_options.whole.push([mtid, moid]); ++num_selected[LEFT_SIDE]; ++num_selected[RIGHT_SIDE]; break;
              default: break;
            }
            const opt_compare_info = [match_info.comparison[LEFT_SIDE][mtidx][moidx], match_info.comparison[RIGHT_SIDE][mtidx][moidx]];
            if ((opt_compare_info[LEFT_SIDE] === AT_LEAST && opt_compare_info[RIGHT_SIDE] === AT_LEAST) || 
                (is_base_product_edge_case && is_compare_to_base[LEFT_SIDE] && is_compare_to_base[RIGHT_SIDE] && 
                  opt_compare_info[LEFT_SIDE] === EXACT_MATCH && opt_compare_info[RIGHT_SIDE] === EXACT_MATCH)) {
              product.additional_options.whole.push([mtid, moid]);
            }
            else if (opt_compare_info[RIGHT_SIDE] === AT_LEAST || 
              (is_base_product_edge_case && is_compare_to_base[RIGHT_SIDE] && opt_compare_info[RIGHT_SIDE] === EXACT_MATCH)) {
              product.additional_options.right.push([mtid, moid]);
            }
            else if (opt_compare_info[LEFT_SIDE] === AT_LEAST || 
              (is_base_product_edge_case && is_compare_to_base[LEFT_SIDE] && opt_compare_info[LEFT_SIDE] === EXACT_MATCH)) {
              product.additional_options.left.push([mtid, moid]);
            }
          });
        }
        const EMPTY_DISPLAY_AS = CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as;
        const MIN_SELECTED = CATALOG_MODIFIER_INFO.modifier_type.min_selected;
        // we check for an incomplete modifier and add an entry if the empty_display_as flag is anything other than OMIT
        if (num_selected[LEFT_SIDE] < MIN_SELECTED && 
            num_selected[RIGHT_SIDE] < MIN_SELECTED) {
          if (EMPTY_DISPLAY_AS !== "OMIT" && product.modifier_map[mtid].has_selectable) { product.exhaustive_options.whole.push([mtid, -1]); }
          product.modifier_map[mtid].meets_minimum = !product.modifier_map[mtid].has_selectable;
          product.incomplete = product.incomplete || product.modifier_map[mtid].has_selectable;
        }
        else if (num_selected[LEFT_SIDE] < MIN_SELECTED) {
          if (EMPTY_DISPLAY_AS !== "OMIT" && product.modifier_map[mtid].has_selectable) { product.exhaustive_options.left.push([mtid, -1]); }
          product.modifier_map[mtid].meets_minimum = !product.modifier_map[mtid].has_selectable;
          product.incomplete = product.incomplete || product.modifier_map[mtid].has_selectable;
        }
        else if (num_selected[RIGHT_SIDE] < MIN_SELECTED) {
          if (EMPTY_DISPLAY_AS !== "OMIT" && product.modifier_map[mtid].has_selectable) { product.exhaustive_options.right.push([mtid, -1]); }
          product.modifier_map[mtid].meets_minimum = !product.modifier_map[mtid].has_selectable;
          product.incomplete = product.incomplete || product.modifier_map[mtid].has_selectable;
        }
        else {
          // both left and right meet the minimum selected criteria
          product.modifier_map[mtid].meets_minimum = true;
        }
      });

      if (product.piid) {
        // if we have a PI ID then that means we're an unmodified product instance from the catalog
        // and we should find that product and assume its name.
        var catalog_pi = PRODUCT_CLASS_MENU_ENTRY.instances[product.piid];
        product.name = catalog_pi.name;
        product.shortname = catalog_pi.shortcode;
        return;
      }

      var additional_options_objects = { };
      Object.keys(product.additional_options).forEach(loc => {
        additional_options_objects[loc] = product.additional_options[loc].map(x => GetModifierOptionFromMIDOID(MENU, x[0], x[1]));
      });

      var split_options = ["∅", "∅"];
      var short_split_options = ["∅", "∅"];
      if (product.additional_options.left.length) {
        split_options[LEFT_SIDE] = ComponentsListName(additional_options_objects.left).join(" + ");
        short_split_options[LEFT_SIDE] = ComponentsListShortname(additional_options_objects.left).join(" + ");
      }
      if (product.additional_options.right.length) {
        split_options[RIGHT_SIDE] = ComponentsListName(additional_options_objects.right).join(" + ");
        short_split_options[RIGHT_SIDE] = ComponentsListShortname(additional_options_objects.right).join(" + ");
      }

      var name_components_list = null;
      var shortname_components_list = null;
      if (product.is_split) {
        name_components_list = ComponentsListName(additional_options_objects.whole);
        shortname_components_list = ComponentsListShortname(additional_options_objects.whole);
        if (match_info.product[LEFT_SIDE].piid === match_info.product[RIGHT_SIDE].piid) {
          if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
            name_components_list.unshift(match_info.product[LEFT_SIDE].name);
            shortname_components_list.unshift(match_info.product[LEFT_SIDE].name);
          }
          name_components_list.push("(" + split_options.join(" | ") + ")");
          shortname_components_list.push("(" + short_split_options.join(" | ") + ")");
          product.description = match_info.product[LEFT_SIDE].description;
        }
        else {
          // split product, different product instance match on each side
          // logical assertion: if name_components for a given side are all false, then it's an exact match
          var names = [
            (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [match_info.product[LEFT_SIDE].name] : [],
            (!is_compare_to_base[RIGHT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [match_info.product[RIGHT_SIDE].name] : []
          ];
          var shortnames = names.slice();
          if (additional_options_objects.left.length) {
            names[LEFT_SIDE] = names[LEFT_SIDE].concat(split_options[LEFT_SIDE]);
            shortnames[LEFT_SIDE] = shortnames[LEFT_SIDE].concat(short_split_options[LEFT_SIDE]);
          }
          if (additional_options_objects.right.length) {
            names[RIGHT_SIDE] = names[RIGHT_SIDE].concat(split_options[RIGHT_SIDE]);
            shortnames[RIGHT_SIDE] = shortnames[RIGHT_SIDE].concat(short_split_options[RIGHT_SIDE]);
          }
          names[LEFT_SIDE].length ? 0 : names[LEFT_SIDE].push("∅");
          names[RIGHT_SIDE].length ? 0 : names[RIGHT_SIDE].push("∅");
          const left_name = names[LEFT_SIDE].length > 1 ? `( ${names[LEFT_SIDE].join(" + ")} )` : names[LEFT_SIDE].join(" + ");
          const right_name = names[RIGHT_SIDE].length > 1 ? `( ${names[RIGHT_SIDE].join(" + ")} )` : names[RIGHT_SIDE].join(" + ");
          const split_name = `${left_name} | ${right_name}`;
          name_components_list.push(name_components_list.length > 0 ? `( ${split_name} )` : split_name);
          shortnames[LEFT_SIDE].length ? 0 : shortnames[LEFT_SIDE].push("∅");
          shortnames[RIGHT_SIDE].length ? 0 : shortnames[RIGHT_SIDE].push("∅");
          const left_shortname = shortnames[LEFT_SIDE].length > 1 ? `( ${shortnames[LEFT_SIDE].join(" + ")} )` : shortnames[LEFT_SIDE].join(" + ");
          const right_shortname = shortnames[RIGHT_SIDE].length > 1 ? `( ${shortnames[RIGHT_SIDE].join(" + ")} )` : shortnames[RIGHT_SIDE].join(" + ");
          const split_shortname = `${left_shortname} | ${right_shortname}`;
          shortname_components_list.push(shortname_components_list.length > 0 ? `( ${split_shortname} )` : split_shortname);
          product.description = `( ${match_info.product[LEFT_SIDE].description} ) | ( ${match_info.product[RIGHT_SIDE].description} )`;
        }
      } // end is_split case
      else {
        name_components_list = ComponentsListName(additional_options_objects.whole);
        shortname_components_list = ComponentsListShortname(additional_options_objects.whole);
        // we're using the left side because we know left and right are the same
        // if exact match to base product, no need to show the name
        if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
          name_components_list.unshift(match_info.product[LEFT_SIDE].name);
          shortname_components_list.unshift(match_info.product[LEFT_SIDE].name);
        }
        if (match_info.comparison_value[LEFT_SIDE] === EXACT_MATCH) {
          // assign PIID
          product.piid = match_info.product[LEFT_SIDE].piid;
          product.is_base = match_info.product[LEFT_SIDE].is_base;
        }
        product.description = match_info.product[LEFT_SIDE].description;
      }
      product.ordinal = match_info.product[LEFT_SIDE].ordinal;
      product.disable_data = match_info.product[LEFT_SIDE].disable_data;
      product.display_flags = match_info.product[LEFT_SIDE].display_flags;
      product.name = name_components_list.join(" + ");
      product.shortname = shortname_components_list.length === 0 ? match_info.product[LEFT_SIDE].shortname : shortname_components_list.join(" + ");
    }

    // iterate through menu, until has_left and has_right are true
    // TODO: product naming with disabled products, see https://app.asana.com/0/1192054646278650/1192627836647899/f
    // a name can be assigned once an exact or at least match is found for a given side
    // NOTE the guarantee of ordering the instances in most modified to base product isn't guaranteed and shouldn't be assumed, but we need it here. how can we order the instances in a helpful way? Need to figure this out
    // answer: pull out the base product from the list and make sure it's last in the ordered list we handle here
    for (var pi_index = 0; pi_index < PRODUCT_CLASS_MENU_ENTRY.instances_list.length; ++pi_index) {
      var comparison_product = PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index];
      var comparison_info = Compare(this, PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index], MENU);
      CheckMatchForSide(LEFT_SIDE, comparison_info, comparison_product);
      CheckMatchForSide(RIGHT_SIDE, comparison_info, comparison_product);
      if (match_info.product[LEFT_SIDE] !== null && match_info.product[RIGHT_SIDE] !== null) {
        // finished, proceed to build the names and assign shortcodes
        return BuildName(this, service_time);
      }
    }
  };

  this.DisplayOptions = function (MENU) {
    var options_sections = [];
    const HandleOption = (x) => {
      if (x[1] === -1) {
        const CATALOG_MODIFIER_INFO = MENU.modifiers[x[0]];
        switch (CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as) {
          // TODO: needs to filter disabled or unavailble options
          case "YOUR_CHOICE_OF": return CATALOG_MODIFIER_INFO.modifier_type.display_name ? CATALOG_MODIFIER_INFO.modifier_type.display_name : CATALOG_MODIFIER_INFO.modifier_type.name;
          case "LIST_CHOICES": 
            const choices = CATALOG_MODIFIER_INFO.options_list.map(x=>x.name);
            return choices.length < 3 ? choices.join(" or ") : [choices.slice(0, -1).join(", "), choices[choices.length-1]].join(", or ");
          default: console.error(`Unknown value for empty_display_as flag: ${CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as}`); return "";
        }
      }
      else {
        const OPTION = GetModifierOptionFromMIDOID(MENU, x[0], x[1]);
        return (!OPTION.display_flags || !OPTION.display_flags.omit_from_name) ? GetModifierOptionFromMIDOID(MENU, x[0], x[1]).name : "";
      }
    }
    if (this.exhaustive_options.whole.length > 0) {
      var option_names = this.exhaustive_options.whole.map(HandleOption).filter(x => x !== "");
      options_sections.push(["Whole", option_names.join(" + ")]);
    }
    if (this.exhaustive_options.left.length > 0) {
      var option_names = this.exhaustive_options.left.map(HandleOption).filter(x => x !== "");
      options_sections.push(["Left", option_names.join(" + ")]);
    }
    if (this.exhaustive_options.right.length > 0) {
      var option_names = this.exhaustive_options.right.map(HandleOption).filter(x => x !== "");
      options_sections.push(["Right", option_names.join(" + ")]);
    }
    return options_sections;
  };

  this.SetBaseProductPIID = function (MENU) {
    var PRODUCT_CLASS_MENU_ENTRY = MENU.product_classes[this.PRODUCT_CLASS._id];
    var BASE_PRODUCT_INSTANCE = PRODUCT_CLASS_MENU_ENTRY.instances_list.find(function (prod) { return prod.is_base === true; });
    if (!BASE_PRODUCT_INSTANCE) {
      console.error(`Cannot find base product instance of ${JSON.stringify(this.PRODUCT_CLASS)}.`);
      return;
    }
    this.base_product_piid = BASE_PRODUCT_INSTANCE.piid;
  }

  this.OrderModifiersAndOptions = function(MENU) { 
    var new_obj = {};
    var sorted_mtids = Object.keys(this.modifiers).sort((a, b) => MENU.modifiers[a].modifier_type.ordinal - MENU.modifiers[b].modifier_type.ordinal)
    for (var mtidx = 0; mtidx < sorted_mtids.length; ++mtidx) {
      const mtid = sorted_mtids[mtidx];
      new_obj[mtid] = this.modifiers[mtid].sort((a, b) => MENU.modifiers[mtid].options[a[1]].index - MENU.modifiers[mtid].options[b[1]].index);
    }
    this.modifiers = new_obj;
  }

  this.Initialize = function (MENU) {
    this.SetBaseProductPIID(MENU);
    this.OrderModifiersAndOptions(MENU);
    this.price = this.ComputePrice(MENU);
    this.RecomputeMetadata(MENU);
    var service_time = moment();
    this.RecomputeName(MENU, service_time);
    this.options_sections = this.DisplayOptions(MENU);
  };

  this.ToDTO = function () {
    return {
      pid: this.PRODUCT_CLASS._id,
      modifiers: this.modifiers
    };
  };

};

export default WCPProduct;