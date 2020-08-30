import { TOPPING_NONE, TOPPING_LEFT, TOPPING_RIGHT, TOPPING_WHOLE, LEFT_SIDE, RIGHT_SIDE } from "../common";

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

function ExtractMatchForSide(side, matrix) {
  // we take the min of EXACT_MATCH and the thing we just computed because if there are no modifiers, then we'll get Infinity
  return Math.min(EXACT_MATCH, Math.min.apply(0, matrix.map(function (modcompare_arr) {
    return Math.min.apply(0, modcompare_arr.map(function (comp) {
      return comp[side];
    }));
  })));
};

export function CopyWCPProduct(pi) {
  return new WCPProduct(pi.PRODUCT_CLASS, pi.piid, pi.name, pi.description, pi.ordinal, pi.modifiers, pi.shortcode, pi.base_price, pi.disable_data, pi.is_base, pi.display_flags);
}
export function WCPProductFromDTO(dto, MENU) {
  return new WCPProduct(MENU.product_classes[dto.pid].product, "", "", "", 0, dto.modifiers, "", 0, null, false, {});
}

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
    var modifier_option_find_function_factory = function (moid) {
      return function (val) {
        return val[1] === moid;
      };
    };

    var modifiers_match_matrix = [];

    // need to compare PIDs of first and other, then use the PID to develop the modifiers matrix since one of the two product instances might not have a value for every modifier.
    if (first.PRODUCT_CLASS._id != other.PRODUCT_CLASS._id) {
      // no match on PID so we need to return 0
      return { mirror: false, match_matrix: modifiers_match_matrix, match: [[[NO_MATCH, NO_MATCH]]] }
    }

    // this is a multi-dim array, in order of the MTID as it exists in the product class definition
    // disabled modifier types and modifier options are all present as they shouldn't contribute to comparison mismatch
    // elements of the modifiers_match_matrix are arrays of <LEFT_MATCH, RIGHT_MATCH> tuples
    first.PRODUCT_CLASS.modifiers.forEach(function (MID) {
      modifiers_match_matrix.push(MENU.modifiers[MID].options_list.map(function () { return [EXACT_MATCH, EXACT_MATCH]; }));
    })

    // identify the base PIID of this product class
    // var BASE_PRODUCT_INSTANCE = MENU.catalog.products[first.pid].instances_list.find(function(prod) { return prod.is_base === true; });
    // if (!BASE_PRODUCT_INSTANCE) { 
    //   console.error(`Cannot find base product instance of ${JSON.stringify(this.PRODUCT_CLASS)}.`);
    //   return { mirror: false, match: [[[NO_MATCH, NO_MATCH]]] }
    // }

    var is_mirror = true;
    // main comparison loop!
    first.PRODUCT_CLASS.modifiers.forEach(function (MID, midx) {
      var first_option_list = first.modifiers.hasOwnProperty(MID) ? first.modifiers[MID] : [];
      var other_option_list = other.modifiers.hasOwnProperty(MID) ? other.modifiers[MID] : [];
      // in each modifier, need to determine if it's a SINGLE or MANY select 
      var CATALOG_MODIFIER_INFO = MENU.modifiers[MID];
      if (CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1) {
        // CASE: SINGLE select modifier, this logic isn't very well-defined. TODO: rework
        console.assert(first_option_list.length === 1 && other_option_list.length === 1, "Split options for single select modifiers not supported yet");
        var first_option = first_option_list[0];
        var other_option = other_option_list[0];
        if (first_option[1] !== other_option[1]) {
          // OID doesn't match, need to set AT_LEAST for JUST the option on the "first" product
          CATALOG_MODIFIER_INFO.options_list.forEach(function (option, oidx) {
            if (first_option[1] === option.moid) {
              modifiers_match_matrix[midx][oidx] = [AT_LEAST, AT_LEAST];
              is_mirror = false;
            }
          });
        }
      }
      else {
        // CASE: MULTI select modifier
        CATALOG_MODIFIER_INFO.options_list.forEach(function (option, oidx) {
          // todo: since the options will be in order, we can be smarter about not using a find here and track 2 indices instead   
          var finder = modifier_option_find_function_factory(option.moid);       
          var first_option = first_option_list.find(finder);
          var other_option = other_option_list.find(finder);
          var first_option_placement = first_option ? first_option[0] : TOPPING_NONE;
          var other_option_placement = other_option ? other_option[0] : TOPPING_NONE;
          switch (other_option_placement) {
            case TOPPING_NONE:
              switch (first_option_placement) {
                case TOPPING_NONE: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, EXACT_MATCH]; break;
                case TOPPING_LEFT: modifiers_match_matrix[midx][oidx] = [AT_LEAST, EXACT_MATCH]; is_mirror = false; break;
                case TOPPING_RIGHT: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, AT_LEAST]; is_mirror = false; break;
                case TOPPING_WHOLE: modifiers_match_matrix[midx][oidx] = [AT_LEAST, AT_LEAST]; is_mirror = false; break;
                default: console.assert(false, "invalid topping value");
              }
              break;
            case TOPPING_LEFT:
              switch (first_option_placement) {
                case TOPPING_NONE: modifiers_match_matrix[midx][oidx] = [NO_MATCH, EXACT_MATCH]; is_mirror = false; break;
                case TOPPING_LEFT: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, EXACT_MATCH]; is_mirror = false; break;
                case TOPPING_RIGHT: modifiers_match_matrix[midx][oidx] = [NO_MATCH, NO_MATCH]; break;
                case TOPPING_WHOLE: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, AT_LEAST]; is_mirror = false; break;
                default: console.assert(false, "invalid topping value");
              }
              break;
            case TOPPING_RIGHT:
              switch (first_option_placement) {
                case TOPPING_NONE: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, NO_MATCH]; is_mirror = false; break;
                case TOPPING_LEFT: modifiers_match_matrix[midx][oidx] = [NO_MATCH, NO_MATCH]; break;
                case TOPPING_RIGHT: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, EXACT_MATCH]; is_mirror = false; break;
                case TOPPING_WHOLE: modifiers_match_matrix[midx][oidx] = [AT_LEAST, EXACT_MATCH]; is_mirror = false; break;
                default: console.assert(false, "invalid topping value");
              }
              break;
            case TOPPING_WHOLE:
              switch (first_option_placement) {
                case TOPPING_NONE: modifiers_match_matrix[midx][oidx] = [NO_MATCH, NO_MATCH]; is_mirror = false; break;
                case TOPPING_LEFT: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, NO_MATCH]; is_mirror = false; break;
                case TOPPING_RIGHT: modifiers_match_matrix[midx][oidx] = [NO_MATCH, EXACT_MATCH]; is_mirror = false; break;
                case TOPPING_WHOLE: modifiers_match_matrix[midx][oidx] = [EXACT_MATCH, EXACT_MATCH]; break;
                default: console.assert(false, "invalid topping value");
              }
              break;
            default: console.assert(false, "invalid topping value");
          }
        });
      }
    });
    var temp = {
      mirror: is_mirror,
      match_matrix: modifiers_match_matrix,
      match: [ExtractMatchForSide(LEFT_SIDE, modifiers_match_matrix), ExtractMatchForSide(RIGHT_SIDE, modifiers_match_matrix)]
    };
//    console.log(temp);
    return temp;
  }

  this.Equals = function (other, MENU) {
    var comparison_info = Compare(this, other, MENU);
    return comparison_info.mirror ||
      (comparison_info.match[LEFT_SIDE] === EXACT_MATCH && comparison_info.match[RIGHT_SIDE] === EXACT_MATCH);
  };

  this.RecomputeName = function (MENU) {
    var PRODUCT_CLASS = this.PRODUCT_CLASS;
    var PRODUCT_CLASS_MENU_ENTRY = MENU.product_classes[PRODUCT_CLASS._id];
    if (this.piid) {
      // if we have a PI ID then that means we're an unmodified product instance from the catalog
      // and we should find that product and assume its name.
      var catalog_pi = PRODUCT_CLASS_MENU_ENTRY.instances[this.piid];
      this.name = catalog_pi.name;
      this.shortname = catalog_pi.shortname;
      this.shortcode = catalog_pi.shortcode;
      return;
    }

    // at this point we only know what product class we belong to. we might be an unmodified product, 
    // but that will need to be determined.
    var BASE_PRODUCT_INSTANCE = PRODUCT_CLASS_MENU_ENTRY.instances[this.base_product_piid];

    var shortcodes = [BASE_PRODUCT_INSTANCE.shortcode, BASE_PRODUCT_INSTANCE.shortcode];
    var menu_match = [null, null];
    var menu_match_compare = [EXACT_MATCH, EXACT_MATCH];
    // name_components is an ordered list of things that are AT_LEAST compared to the menu match, on a per-side basis
    // that makes this a list of list of the tuple <display_left, display_right>
    // note that every modifier that belongs to this product class exists in this list, meaning if a pizza has no toppings, there's still an empty array for that modifier type
    // from the index in this array, we can determine the name or shortnames like this:
    // name_components[mid_index][option_index][side_index] ? MENU.modifiers[this.PRODUCT_CLASS.modifiers[mid_index]].options_list[option_index].item.display_name : ""
    var name_components = [];
    PRODUCT_CLASS.modifiers.forEach(function (MID) {
      name_components.push(MENU.modifiers[MID].options_list.map(function () { return [false, false]; }));
    })

    function ComputeForSide(side, comparison, comparison_product) {
      if (menu_match[side] !== null) {
        return;
      }
      var is_compare_to_base = BASE_PRODUCT_INSTANCE.piid === comparison_product.piid;
      if (comparison.match[side] !== NO_MATCH) {
        PRODUCT_CLASS.modifiers.forEach(function (mtid, mid_index) {
          var CATALOG_MODIFIER_INFO = MENU.modifiers[mtid];
          if (CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1) {
            // if the comparison is to the base product instance, 
            // then single select options THAT ARE SELECTED need to be displayed even if they're exact matches
            //TODO: figure this one out
            var found_selection = -1;
            var base_moid = BASE_PRODUCT_INSTANCE.modifiers[mtid][0][1];
            var base_moidx = -1;
            comparison.match_matrix[mid_index].forEach(function (option_match, oid_index) {
              if (option_match[side] === AT_LEAST) {
                found_selection = oid_index;
              }
              if (MENU.modifiers[mtid].options_list[oid_index].moid === base_moid) {
                base_moidx = oid_index;
              }
            });
            if (found_selection >= 0) {
              name_components[mid_index][found_selection][side] = true;
            }
            else if (is_compare_to_base && !PRODUCT_CLASS.display_flags.show_name_of_base_product) {
              // whatever we have selected is the default option, use the BASE_PRODUCT_INSTANCE to grab that info
              // since the display flag show_name_of_base_product is OFF
              name_components[mid_index][base_moidx][side] = true;
            }
            
          }
          else if (comparison.match[side] === AT_LEAST) {
            comparison.match_matrix[mid_index].forEach(function (option_match, oid_index) {
              if (option_match[side] === AT_LEAST) {
                name_components[mid_index][oid_index][side] = true;
              }
            });
          }
        });
        menu_match[side] = comparison_product;
        menu_match_compare[side] = comparison.match[side];
        shortcodes[side] = comparison_product.shortcode;
      }
    }

    function BuildName(product) {
      console.assert(menu_match[LEFT_SIDE] !== null && menu_match[RIGHT_SIDE] !== null, "We should have both matches determined by now.");
      // assign shortcode (easy)
      product.shortcode = product.is_split && shortcodes[LEFT_SIDE] !== shortcodes[RIGHT_SIDE] ? shortcodes.join("|") : shortcodes[LEFT_SIDE];

      // determine if we're comparing to the base product on the left and right sides
      var is_compare_to_base = [
        BASE_PRODUCT_INSTANCE.piid === menu_match[LEFT_SIDE].piid,
        BASE_PRODUCT_INSTANCE.piid === menu_match[RIGHT_SIDE].piid];  
      
      // split out options beyond the base product into left additions, right additions, and whole additions
      // each entry in these arrays represents the modifier index on the product class and the option index in that particular modifier
      var additional_options = { left: [], right: [], whole: [] };
      for (var mt_index = 0; mt_index < name_components.length; ++mt_index) {
        for (var opt_index = 0; opt_index < name_components[mt_index].length; ++opt_index) {
          if (name_components[mt_index][opt_index][LEFT_SIDE] === true &&
            name_components[mt_index][opt_index][RIGHT_SIDE] === true) {
            additional_options.whole.push([mt_index, opt_index]);
          }
          else if (name_components[mt_index][opt_index][LEFT_SIDE] === true &&
            name_components[mt_index][opt_index][RIGHT_SIDE] === false) {
            additional_options.left.push([mt_index, opt_index]);
          }
          else if (name_components[mt_index][opt_index][LEFT_SIDE] === false &&
            name_components[mt_index][opt_index][RIGHT_SIDE] === true) {
            additional_options.right.push([mt_index, opt_index]);
          }
        }
      }

      function ComponentsList(source, getter) {
        return source.map(function (x) {
          return getter(MENU.modifiers[PRODUCT_CLASS.modifiers[x[0]]].options_list[x[1]]);
        });
      }

      var split_options = ["∅", "∅"];
      var short_split_options = ["∅", "∅"];
      if (additional_options.left.length) {
        split_options[LEFT_SIDE] = ComponentsList(additional_options.left, function (x) { return x.name; }).join(" + ");
        short_split_options[LEFT_SIDE] = ComponentsList(additional_options.left, function (x) { return x.shortname; }).join(" + ");
      }
      if (additional_options.right.length) {
        split_options[RIGHT_SIDE] = ComponentsList(additional_options.right, function (x) { return x.name; }).join(" + ");
        short_split_options[RIGHT_SIDE] = ComponentsList(additional_options.right, function (x) { return x.shortname; }).join(" + ");
      }

      var name_components_list = null;
      var shortname_components_list = null;
      if (product.is_split) {
        name_components_list = ComponentsList(additional_options.whole, function (x) { return x.name; });
        shortname_components_list = ComponentsList(additional_options.whole, function (x) { return x.shortname; });
        if (menu_match[LEFT_SIDE].piid === menu_match[RIGHT_SIDE].piid) {
          if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
            name_components_list.unshift(menu_match[LEFT_SIDE].name);
            shortname_components_list.unshift(menu_match[LEFT_SIDE].name);
          }
          name_components_list.push("(" + split_options.join(" | ") + ")");
          shortname_components_list.push("(" + short_split_options.join(" | ") + ")");
        }
        else {
          // split product, different product instance match on each side
          // logical assertion: if name_components for a given side are all false, then it's an exact match
          var names = [
            (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [menu_match[LEFT_SIDE].name] : [],
            (!is_compare_to_base[RIGHT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [menu_match[RIGHT_SIDE].name] : []
          ];
          var shortnames = names.slice();
          if (additional_options.left.length) {
            names[LEFT_SIDE] = names[LEFT_SIDE].concat(split_options[LEFT_SIDE]);
            shortnames[LEFT_SIDE] = shortnames[LEFT_SIDE].concat(short_split_options[LEFT_SIDE]);
          }
          if (additional_options.right.length) {
            names[RIGHT_SIDE] = names[RIGHT_SIDE].concat(split_options[RIGHT_SIDE]);
            shortnames[RIGHT_SIDE] = shortnames[RIGHT_SIDE].concat(short_split_options[RIGHT_SIDE]);
          }
          names[LEFT_SIDE].length ? 0 : names[LEFT_SIDE].push("∅");
          names[RIGHT_SIDE].length ? 0 : names[RIGHT_SIDE].push("∅");
          name_components_list.push(`( ${names[LEFT_SIDE].join(" + ")} | ${names[RIGHT_SIDE].join(" + ")} )`);
          shortnames[LEFT_SIDE].length ? 0 : shortnames[LEFT_SIDE].push("∅");
          shortnames[RIGHT_SIDE].length ? 0 : shortnames[RIGHT_SIDE].push("∅");
          shortname_components_list.push(`( ${shortnames[LEFT_SIDE].join(" + ")} | ${shortnames[RIGHT_SIDE].join(" + ")} )`);
        }
      } // end is_split case
      else {
        name_components_list = ComponentsList(additional_options.whole, function (x) { return x.name; });
        shortname_components_list = ComponentsList(additional_options.whole, function (x) { return x.shortname; });
        // we're using the left side because we know left and right are the same
        // if exact match to base product, no need to show the name
        if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
          name_components_list.unshift(menu_match[LEFT_SIDE].name);
          shortname_components_list.unshift(menu_match[LEFT_SIDE].name);
        }
        if (menu_match_compare[LEFT_SIDE] === EXACT_MATCH) {
          // assign PIID
          product.piid = menu_match[LEFT_SIDE].piid;
          product.description = menu_match[LEFT_SIDE].description;
          product.ordinal = menu_match[LEFT_SIDE].ordinal;
          product.disable_data = menu_match[LEFT_SIDE].disable_data;
          product.is_base = menu_match[LEFT_SIDE].is_base;
          product.display_flags = menu_match[LEFT_SIDE].display_flags;
        }
      }
      product.name = name_components_list.join(" + ");
      product.shortname = shortname_components_list.length === 0 ? "BASE PRODUCT" : shortname_components_list.join(" + ");
    }

    // iterate through menu, until has_left and has_right are true
    // a name can be assigned once an exact or at least match is found for a given side
    // NOTE the guarantee of ordering the instances in most modified to base product isn't guaranteed and shouldn't be assumed, but we need it here. how can we order the instances in a helpful way? Need to figure this out
    // answer: pull out the base product from the list and make sure it's last in the ordered list we handle here
    for (var pi_index = 0; pi_index < PRODUCT_CLASS_MENU_ENTRY.instances_list.length; ++pi_index) {
      var comparison_product = PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index];
      var comparison_info = Compare(this, PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index], MENU);
      ComputeForSide(LEFT_SIDE, comparison_info, comparison_product);
      ComputeForSide(RIGHT_SIDE, comparison_info, comparison_product);
      if (menu_match[LEFT_SIDE] !== null && menu_match[RIGHT_SIDE] !== null) {
        // TODO: if it's an exact match on both sides, we need to set the PIID accordingly
        // finished, proceed to build the names and assign shortcodes
        return BuildName(this);
      }
    }
  };

  this.SplitOptionsList = function () {
    // generates three lists ordered from top to bottom: whole, left only, right only
    // returns a list of <MTID, OID> tuples
    var ret = { left: [], right: [], whole: [] };
    for (var mid in this.modifiers) {
      this.modifiers[mid].forEach(function (option_placement) {
        switch (option_placement[0]) {
          case TOPPING_LEFT: ret.left.push([mid, option_placement[1]]); break;
          case TOPPING_RIGHT: ret.right.push([mid, option_placement[1]]); break;
          case TOPPING_WHOLE: ret.whole.push([mid, option_placement[1]]); break;
          default: break;
        }
      });
    };
    return ret;
  };


  this.DisplayOptions = function (MENU) {
    var split_options = this.SplitOptionsList();
    var options_sections = [];

    if (split_options.whole.length > 0) {
      var option_names = split_options.whole.map(function (x) { return GetModifierOptionFromMIDOID(MENU, x[0], x[1]).name; });
      options_sections.push(["Whole", option_names.join(" + ")]);
    }
    if (split_options.left.length > 0) {
      var option_names = split_options.left.map(function (x) { return GetModifierOptionFromMIDOID(MENU, x[0], x[1]).name; });
      options_sections.push(["Left", option_names.join(" + ")]);
    }
    if (split_options.right.length > 0) {
      var option_names = split_options.right.map(function (x) { return GetModifierOptionFromMIDOID(MENU, x[0], x[1]).name; });
      options_sections.push(["Right", option_names.join(" + ")]);
    }
    return options_sections;
  };

  this.SetBaseProductPIID = function (MENU) {
    var PRODUCT_CLASS_MENU_ENTRY = MENU.product_classes[this.PRODUCT_CLASS._id];
    var BASE_PRODUCT_INSTANCE = this.is_base ? this : PRODUCT_CLASS_MENU_ENTRY.instances_list.find(function (prod) { return prod.is_base === true; });
    if (!BASE_PRODUCT_INSTANCE) {
      console.error(`Cannot find base product instance of ${JSON.stringify(this.PRODUCT_CLASS)}.`);
      return;
    }
    this.base_product_piid = BASE_PRODUCT_INSTANCE.piid;
  }

  this.Initialize = function (MENU) {
    this.SetBaseProductPIID(MENU);
    this.price = this.ComputePrice(MENU);
    this.RecomputeMetadata(MENU);
    this.RecomputeName(MENU);
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