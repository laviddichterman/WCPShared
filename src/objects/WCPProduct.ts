/* eslint-disable no-plusplus */
import moment from 'moment';
import { DisableDataCheck, PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX } from "../common";
import { WFunctional } from "./WFunctional";
import { IProduct, IProductDisplayFlags, IProductInstance, OptionPlacement, ModifiersMap, MODIFIER_MATCH, MODIFIER_LOCATION, WCPProduct, IMenu, WProductMetadata, MetadataModifierMap, IModifierPlacementExpression } from '../types';
import { IsOptionEnabled } from './WCPOption';

const NO_MATCH = MODIFIER_MATCH.NO_MATCH;
const AT_LEAST = MODIFIER_MATCH.AT_LEAST;
const EXACT_MATCH = MODIFIER_MATCH.EXACT_MATCH;
const LEFT_SIDE = MODIFIER_LOCATION.LEFT;
const RIGHT_SIDE = MODIFIER_LOCATION.RIGHT;

type SIDE_MODIFIER_MATCH_MATRIX = MODIFIER_MATCH[][];
type LR_MODIFIER_MATCH_MATRIX = [SIDE_MODIFIER_MATCH_MATRIX, SIDE_MODIFIER_MATCH_MATRIX];
interface WProductCompareResult { mirror: boolean; match_matrix: LR_MODIFIER_MATCH_MATRIX; match: [MODIFIER_MATCH, MODIFIER_MATCH]; };
const GetModifierOptionFromMIDOID = (menu, mid, oid) => menu.modifiers[mid].options[oid];

const ExtractMatch = (matrix) => (
  // we take the min of EXACT_MATCH and the thing we just computed because if there are no modifiers, then we'll get Infinity
  Math.min(EXACT_MATCH, Math.min.apply(0, matrix.map((modcompare_arr) => Math.min.apply(0, modcompare_arr))))
);

const ComponentsList = (source, getter) => source.map((x) => getter(x));

const FilterByOmitFromName = (source) => (source.filter(x => !x.display_flags || !x.display_flags.omit_from_name));
const FilterByOmitFromShortname = (source) => (source.filter(x => !x.display_flags || !x.display_flags.omit_from_shortname));

const ComponentsListName = (source) => ComponentsList(source, x => x.name);

const ComponentsListShortname = (source) => ComponentsList(source, x => x.shortname);

const HandleOptionNameFilterOmitByName = (menu, x) => {
  const OPTION = GetModifierOptionFromMIDOID(menu, x[0], x[1]);
  return (!OPTION.display_flags || !OPTION.display_flags.omit_from_name) ? OPTION.name : "";
}

const HandleOptionNameNoFilter = (menu, x) => (GetModifierOptionFromMIDOID(menu, x[0], x[1]).name);

const HandleOptionCurry = (MENU, getterfxn) => (x) => {
  // TODO: needs to filter disabled or unavailble options
  const LIST_CHOICES = (CATALOG_MODIFIER_INFO) => {
    const choices = CATALOG_MODIFIER_INFO.options_list.map(x => x.name);
    return choices.length < 3 ? choices.join(" or ") : [choices.slice(0, -1).join(", "), choices[choices.length - 1]].join(", or ");
  };
  if (x[1] === -1) {
    const CATALOG_MODIFIER_INFO = MENU.modifiers[x[0]];
    switch (CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as) {
      case "YOUR_CHOICE_OF": return `Your choice of ${CATALOG_MODIFIER_INFO.modifier_type.display_name ? CATALOG_MODIFIER_INFO.modifier_type.display_name : CATALOG_MODIFIER_INFO.modifier_type.name}`;
      case "LIST_CHOICES": return LIST_CHOICES(CATALOG_MODIFIER_INFO);
      default: console.error(`Unknown value for empty_display_as flag: ${CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as}`); return "";
    }
  }
  else {
    return getterfxn(MENU, x);
  }
};

export const CopyWCPProduct = (pi: WCPProduct) => { return { ...pi }; }

//export const WCPProductFromDTO = (dto, MENU) => new WCPProduct(MENU.product_classes[dto.pid].product, "", "", "", 0, dto.modifiers, "", 0, false, {});

/**
 * returns an ordered list of potential prices for a product.
 * Product must be missing some number of INDEPENDENT, SINGLE SELECT modifier types.
 * Independent meaning there isn't a enable function dependence between any of the incomplete
 * modifier types or their options, single select meaning (MIN===MAX===1)
 * @param {WCPProduct} pi - the product instance to use
 * @param {WMenu} menu
 * @return {[Number]} array of prices in ascending order
 */
export function ComputePotentialPrices(pi, menu) {
  const prices = [];
  Object.keys(pi.modifier_map).forEach(mtid => {
    if (!pi.modifier_map[mtid].meets_minimum) {
      const enabled_prices = menu.modifiers[mtid].options_list.filter(x => pi.modifier_map[mtid].options[x.moid].enable_whole).map(x => x.price);
      const deduped_prices = [...new Set(enabled_prices)];
      prices.push(deduped_prices);
    }
  });

  while (prices.length >= 2) {
    const combined_prices = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const price0 of prices[0]) {
      // eslint-disable-next-line no-restricted-syntax
      for (const price1 of prices[1]) {
        combined_prices[price0 + price1] = true;
      }
    }
    prices.splice(0, 2, Object.keys(combined_prices).map(x => Number(x)));
  }
  return prices[0].sort((a, b) => a - b).map(x => x + pi.price);
}

// matrix of how products match indexed by [first placement][second placement] containing [left match, right match, break_mirror]
const MATCH_MATRIX: [MODIFIER_MATCH, MODIFIER_MATCH, boolean][][] = [
  [[EXACT_MATCH, EXACT_MATCH, false], [NO_MATCH, EXACT_MATCH, true], [EXACT_MATCH, NO_MATCH, true], [NO_MATCH, NO_MATCH, true]], // NONE
  [[AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, NO_MATCH, true]], // LEFT
  [[EXACT_MATCH, AT_LEAST, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, EXACT_MATCH, true]], // RIGHT
  [[AT_LEAST, AT_LEAST, true], [EXACT_MATCH, AT_LEAST, true], [AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, false]], // WHOLE
  // [[ NONE ], [ LEFT ], [ RIGHT], [ WHOLE]]
];

export function CreateWCPProduct(product_class: IProduct, piid: string, name: string, description: string, ordinal: number, modifiers: ModifiersMap, shortcode: string, is_base: boolean, display_flags: IProductDisplayFlags, base_product_piid: string) {
  return { PRODUCT_CLASS: product_class, piid, name, description, modifiers, shortcode, is_base, display_flags, ordinal, base_product_piid } as WCPProduct;
}

export function CreateWCPProductFromPI(prod: IProduct, pi: IProductInstance, base_piid: string) {
  return CreateWCPProduct(
    prod,
    pi._id,
    pi.item?.display_name || "",
    pi.item?.description || "",
    pi.ordinal,
    pi.modifiers.reduce((o, key) => ({ ...o, [key.modifier_type_id]: key.options.map(x => { return { ...x } }) }), {}), // this is a deep copy
    pi.item?.shortcode || "",
    pi.is_base,
    pi.display_flags,
    base_piid);
}

export function WProductCompare(a: WCPProduct, b: WCPProduct, MENU: IMenu) {
  // this is a multi-dim array, in order of the MTID as it exists in the product class definition
  // disabled modifier types and modifier options are all present as they shouldn't contribute to comparison mismatch
  // elements of the modifiers_match_matrix are arrays of <LEFT_MATCH, RIGHT_MATCH> tuples
  const modifiers_match_matrix: LR_MODIFIER_MATCH_MATRIX = [[], []];

  // need to compare PIDs of first and other, then use the PID to develop the modifiers matrix since one of the two product instances might not have a value for every modifier.
  if (a.PRODUCT_CLASS._id !== b.PRODUCT_CLASS._id) {
    // no match on PID so we need to return 0
    return { mirror: false, match_matrix: modifiers_match_matrix, match: [NO_MATCH, NO_MATCH] } as WProductCompareResult;
  }

  a.PRODUCT_CLASS.modifiers.forEach((modifier) => {
    modifiers_match_matrix[LEFT_SIDE].push(Array(MENU.modifiers[modifier.mtid].options_list.length).fill(EXACT_MATCH));
    modifiers_match_matrix[RIGHT_SIDE].push(Array(MENU.modifiers[modifier.mtid].options_list.length).fill(EXACT_MATCH));
  })

  let is_mirror = true;
  // main comparison loop!
  a.PRODUCT_CLASS.modifiers.forEach((modifier, midx) => {
    const mtid = modifier.mtid;
    const first_option_list = Object.hasOwn(a.modifiers, mtid) ? a.modifiers[mtid] : [];
    const other_option_list = Object.hasOwn(b.modifiers, mtid) ? b.modifiers[mtid] : [];
    // in each modifier, need to determine if it's a SINGLE or MANY select 
    const CATALOG_MODIFIER_INFO = MENU.modifiers[mtid];
    if (CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1) {
      // CASE: SINGLE select modifier, this logic isn't very well-defined. TODO: rework
      if (first_option_list.length === 1) {
        const first_option = first_option_list[0];
        if (other_option_list.length != 1) {
          console.error(`got other option list of ${JSON.stringify(other_option_list)} but we were expecting a list of length 1`);
          // we log this error because we're not sure how the logic was working before converting to typescript
        }
        if (other_option_list.length === 1 && first_option.option_id !== other_option_list[0].option_id) {
          // OID doesn't match, need to set AT_LEAST for JUST the option on the "first" product
          CATALOG_MODIFIER_INFO.options_list.forEach((option, oidx) => {
            // eslint-disable-next-line
            if (first_option.option_id == option.mo._id) {
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
      CATALOG_MODIFIER_INFO.options_list.forEach((option, oidx) => {
        // todo: since the options will be in order, we can be smarter about not using a find here and track 2 indices instead   
        // var finder = modifier_option_find_function_factory(option.moid);     
        // eslint-disable-next-line eqeqeq
        const first_option = first_option_list.find(val => val.option_id == option.mo._id);
        // eslint-disable-next-line eqeqeq
        const other_option = other_option_list.find(val => val.option_id == option.mo._id);
        const first_option_placement = first_option ? OptionPlacement[first_option.placement] : OptionPlacement.NONE;
        const other_option_placement = other_option ? OptionPlacement[other_option.placement] : OptionPlacement.NONE;
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
  } as WProductCompareResult;
}

export function WProductEquals(a: WCPProduct, b: WCPProduct, MENU: IMenu) {
  const comparison_info = WProductCompare(a, b, MENU);
  return comparison_info.mirror ||
    (comparison_info.match[LEFT_SIDE] === EXACT_MATCH && comparison_info.match[RIGHT_SIDE] === EXACT_MATCH);
};



type MatchTemplateObject = { [index: string]: string };
const RunTemplating = (product: WCPProduct, MENU: IMenu, metadata: WProductMetadata) => {
  const HandleOption = HandleOptionCurry(MENU, HandleOptionNameNoFilter);
  const name_template_match_array = product.name.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
  const description_template_match_array = product.description.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
  if (name_template_match_array === null && description_template_match_array === null) {
    return metadata;
  }
  const name_template_match_obj = name_template_match_array ? name_template_match_array.reduce((acc: MatchTemplateObject, x) => ({ ...acc, [x]: "" }), {}) : {};
  const description_template_match_obj = description_template_match_array ? description_template_match_array.reduce((acc: MatchTemplateObject, x) => ({ ...acc, [x]: "" }), {}) : {};
  product.PRODUCT_CLASS.modifiers.forEach((pc_modifier) => {
    const { mtid } = pc_modifier;
    const modifier_flags = MENU.modifiers[mtid].modifier_type.display_flags;
    if (modifier_flags && modifier_flags.template_string !== "") {
      const template_string_with_braces = `{${modifier_flags.template_string}}`;
      const template_in_name = Object.hasOwn(name_template_match_obj, template_string_with_braces);
      const template_in_description = Object.hasOwn(description_template_match_obj, template_string_with_braces);
      if (template_in_name || template_in_description) {
        const filtered_exhaustive_options = metadata.exhaustive_options.whole.filter(x => x[0] === mtid);
        const modifier_values = filtered_exhaustive_options.map(HandleOption).filter(x => x !== "");
        if (modifier_values.length > 0) {
          const modifier_values_joined_string = modifier_flags.non_empty_group_prefix + modifier_values.join(modifier_flags.multiple_item_separator) + modifier_flags.non_empty_group_suffix;
          if (template_in_name) {
            name_template_match_obj[template_string_with_braces] = modifier_values_joined_string;
          }
          if (template_in_description) {
            description_template_match_obj[template_string_with_braces] = modifier_values_joined_string;
          }
        }
      }
    }
  });
  return {
    ...metadata,
    processed_name: product.name.replace(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX, (m) => Object.hasOwn(name_template_match_obj, m) ? name_template_match_obj[m] : ""),
    processed_description: product.description.replace(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX, (m) => Object.hasOwn(description_template_match_obj, m) ? description_template_match_obj[m] : "")
  } as WProductMetadata;
}

interface IMatchInfo { shortcodes : [string, string]; product: [WCPProduct | null, WCPProduct | null], comparison: LR_MODIFIER_MATCH_MATRIX; comparison_value: [MODIFIER_MATCH, MODIFIER_MATCH] };

export function WCPProductGenerateMetadata(a: WCPProduct, MENU: IMenu, service_time: moment.Moment) {
  const metadata = {
    processed_name: a.name,
    processed_description: a.description,
    modifier_map: {},
    advanced_option_eligible: false,
    advanced_option_selected: false,
    additional_modifiers: {},
    exhaustive_modifiers: {}
  } as WProductMetadata;

  const { PRODUCT_CLASS } = a;
  const PRODUCT_CLASS_MENU_ENTRY = MENU.product_classes[PRODUCT_CLASS._id];

  // at this point we only know what product class we belong to. we might be an unmodified product, 
  // but that will need to be determined.
  const BASE_PRODUCT_INSTANCE = PRODUCT_CLASS_MENU_ENTRY.instances[a.base_product_piid];

  const match_info = {
    // TODO: we don't need to track shortcode separately since we can pull it from the matched product
    shortcodes: [BASE_PRODUCT_INSTANCE.shortcode, BASE_PRODUCT_INSTANCE.shortcode],
    product: [null, null],
    comparison: [[], []],
    comparison_value: [EXACT_MATCH, EXACT_MATCH]
  } as IMatchInfo;

  const CheckMatchForSide = (side: MODIFIER_LOCATION, comparison : WProductCompareResult, comparison_product : WCPProduct) => {
    if (match_info.product[side] === null && comparison.match[side] !== NO_MATCH) {
      match_info.product[side] = comparison_product;
      match_info.comparison[side] = comparison.match_matrix[side];
      match_info.comparison_value[side] = comparison.match[side];
      match_info.shortcodes[side] = comparison_product.shortcode;
    }
  }

  // iterate through menu, until has_left and has_right are true
  // TODO: product naming with disabled products, see https://app.asana.com/0/1192054646278650/1192627836647899/f
  // a name can be assigned once an exact or at least match is found for a given side
  // instances_list is ordered by WProductSchema.ordinal and that should arrange products according to how we
  // want this function to find the appropriate name. Meaning the ordinal for base product has the highest number 
  // and the most modified products have the lowest numbers
  for (let pi_index = 0; pi_index < PRODUCT_CLASS_MENU_ENTRY.instances_list.length; ++pi_index) {
    const comparison_product = PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index];
    const comparison_info = WProductCompare(a, PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index], MENU);
    CheckMatchForSide(LEFT_SIDE, comparison_info, comparison_product);
    CheckMatchForSide(RIGHT_SIDE, comparison_info, comparison_product);
    if (match_info.product[LEFT_SIDE] !== null && match_info.product[RIGHT_SIDE] !== null) {
      // finished, proceed to build the names and assign shortcodes
      break;
    }
  }


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
  a.shortcode = metadata.is_split && match_info.shortcodes[LEFT_SIDE] !== match_info.shortcodes[RIGHT_SIDE] ? match_info.shortcodes.join("|") : match_info.shortcodes[LEFT_SIDE];
  metadata.incomplete = false;

  // determine if we're comparing to the base product on the left and right sides
  const is_compare_to_base = [
    BASE_PRODUCT_INSTANCE.piid === match_info.product[LEFT_SIDE]?.piid,
    BASE_PRODUCT_INSTANCE.piid === match_info.product[RIGHT_SIDE]?.piid];

  // split out options beyond the base product into left additions, right additions, and whole additions
  // each entry in these arrays represents the modifier index on the product class and the option index in that particular modifier
  PRODUCT_CLASS.modifiers.forEach((pc_modifier, mtidx) => {
    const { mtid } = pc_modifier;
    const modifier_type_enable_function = pc_modifier.enable;
    const CATALOG_MODIFIER_INFO = MENU.modifiers[mtid];
    const is_single_select = CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1;
    const is_base_product_edge_case = is_single_select && !PRODUCT_CLASS.display_flags.show_name_of_base_product;
    metadata.modifier_map[mtid] = { has_selectable: false, meets_minimum: false, options: {} };
    const enable_modifier_type = modifier_type_enable_function === null || WFunctional.ProcessProductInstanceFunction(a, modifier_type_enable_function);
    for (let moidx = 0; moidx < CATALOG_MODIFIER_INFO.options_list.length; ++moidx) {
      const option_object = CATALOG_MODIFIER_INFO.options_list[moidx];
      const is_enabled = enable_modifier_type && DisableDataCheck(option_object.mo.catalog_item?.disabled, service_time)
      const option_info = {
        placement: OptionPlacement.NONE,
        // do we need to figure out if we can de-select? answer: probably
        enable_left: is_enabled && option_object.mo.metadata.can_split && option_object.IsEnabled(a, OptionPlacement.LEFT, MENU),
        enable_right: is_enabled && option_object.mo.metadata.can_split && option_object.IsEnabled(a, OptionPlacement.RIGHT, MENU),
        enable_whole: is_enabled && option_object.IsEnabled(a, OptionPlacement.WHOLE, MENU),
      };
      const enable_left_or_right = option_info.enable_left || option_info.enable_right;
      metadata.advanced_option_eligible = metadata.advanced_option_eligible || enable_left_or_right;
      metadata.modifier_map[mtid].options[option_object.mo._id] = option_info;
      metadata.modifier_map[mtid].has_selectable = metadata.modifier_map[mtid].has_selectable || enable_left_or_right || option_info.enable_whole;
    }

    const num_selected = [0, 0];
    if (Object.hasOwn(a.modifiers, mtid)) {
      a.modifiers[mtid].forEach((placed_option) => {
        const moid = placed_option.option_id;
        const location = OptionPlacement[placed_option.placement];
        const moidx = CATALOG_MODIFIER_INFO.options[moid].index;
        metadata.modifier_map[mtid].options[moid].placement = location;
        switch (location) {
          case OptionPlacement.LEFT: metadata.exhaustive_modifiers.left.push([mtid, moid]); ++num_selected[LEFT_SIDE]; metadata.advanced_option_selected = true; break;
          case OptionPlacement.RIGHT: metadata.exhaustive_modifiers.right.push([mtid, moid]); ++num_selected[RIGHT_SIDE]; metadata.advanced_option_selected = true; break;
          case OptionPlacement.WHOLE: metadata.exhaustive_modifiers.whole.push([mtid, moid]); ++num_selected[LEFT_SIDE]; ++num_selected[RIGHT_SIDE]; break;
          default: break;
        }
        const opt_compare_info = [match_info.comparison[LEFT_SIDE][mtidx][moidx], match_info.comparison[RIGHT_SIDE][mtidx][moidx]];
        if ((opt_compare_info[LEFT_SIDE] === AT_LEAST && opt_compare_info[RIGHT_SIDE] === AT_LEAST) ||
          (is_base_product_edge_case && is_compare_to_base[LEFT_SIDE] && is_compare_to_base[RIGHT_SIDE] &&
            opt_compare_info[LEFT_SIDE] === EXACT_MATCH && opt_compare_info[RIGHT_SIDE] === EXACT_MATCH)) {
          metadata.additional_modifiers.whole.push([mtid, moid]);
        }
        else if (opt_compare_info[RIGHT_SIDE] === AT_LEAST ||
          (is_base_product_edge_case && is_compare_to_base[RIGHT_SIDE] && opt_compare_info[RIGHT_SIDE] === EXACT_MATCH)) {
          metadata.additional_modifiers.right.push([mtid, moid]);
        }
        else if (opt_compare_info[LEFT_SIDE] === AT_LEAST ||
          (is_base_product_edge_case && is_compare_to_base[LEFT_SIDE] && opt_compare_info[LEFT_SIDE] === EXACT_MATCH)) {
          metadata.additional_modifiers.left.push([mtid, moid]);
        }
      });
    }
    const EMPTY_DISPLAY_AS = CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as;
    const MIN_SELECTED = CATALOG_MODIFIER_INFO.modifier_type.min_selected;
    // we check for an incomplete modifier and add an entry if the empty_display_as flag is anything other than OMIT
    if (num_selected[LEFT_SIDE] < MIN_SELECTED &&
      num_selected[RIGHT_SIDE] < MIN_SELECTED) {
      if (EMPTY_DISPLAY_AS !== "OMIT" && metadata.modifier_map[mtid].has_selectable) { metadata.exhaustive_modifiers.whole.push([mtid, -1]); }
      metadata.modifier_map[mtid].meets_minimum = !metadata.modifier_map[mtid].has_selectable;
      metadata.incomplete = metadata.incomplete || metadata.modifier_map[mtid].has_selectable;
    }
    else if (num_selected[LEFT_SIDE] < MIN_SELECTED) {
      if (EMPTY_DISPLAY_AS !== "OMIT" && metadata.modifier_map[mtid].has_selectable) { metadata.exhaustive_modifiers.left.push([mtid, -1]); }
      metadata.modifier_map[mtid].meets_minimum = !metadata.modifier_map[mtid].has_selectable;
      metadata.incomplete = metadata.incomplete || metadata.modifier_map[mtid].has_selectable;
    }
    else if (num_selected[RIGHT_SIDE] < MIN_SELECTED) {
      if (EMPTY_DISPLAY_AS !== "OMIT" && metadata.modifier_map[mtid].has_selectable) { metadata.exhaustive_modifiers.right.push([mtid, -1]); }
      metadata.modifier_map[mtid].meets_minimum = !metadata.modifier_map[mtid].has_selectable;
      metadata.incomplete = metadata.incomplete || metadata.modifier_map[mtid].has_selectable;
    }
    else {
      // both left and right meet the minimum selected criteria
      metadata.modifier_map[mtid].meets_minimum = true;
    }
  });

  if (a.piid) {
    // if we have a PI ID then that means we're an unmodified product instance from the catalog
    // and we should find that product and assume its name.
    const catalog_pi = PRODUCT_CLASS_MENU_ENTRY.instances[a.piid];
    a.name = catalog_pi.name;
    a.shortname = catalog_pi.shortcode;
    RunTemplating(a);
    return;
  }

  const additional_options_objects = {};
  Object.keys(a.additional_options).forEach(loc => {
    additional_options_objects[loc] = a.additional_options[loc].map(x => GetModifierOptionFromMIDOID(MENU, x[0], x[1]));
  });

  const split_options = ["∅", "∅"];
  const short_split_options = ["∅", "∅"];
  const num_split_options_name = [0, 0];
  const num_split_options_shortname = [0, 0];
  if (a.additional_options.left.length) {
    const left_name_filtered_opts = FilterByOmitFromName(additional_options_objects.left);
    const left_shortname_filtered_opts = FilterByOmitFromShortname(additional_options_objects.left);
    num_split_options_name[LEFT_SIDE] = left_name_filtered_opts.length;
    num_split_options_shortname[LEFT_SIDE] = left_shortname_filtered_opts.length;
    split_options[LEFT_SIDE] = ComponentsListName(left_name_filtered_opts).join(" + ");
    short_split_options[LEFT_SIDE] = ComponentsListShortname(left_shortname_filtered_opts).join(" + ");
  }
  if (a.additional_options.right.length) {
    const right_name_filtered_opts = FilterByOmitFromName(additional_options_objects.right);
    const right_shortname_filtered_opts = FilterByOmitFromShortname(additional_options_objects.right);
    num_split_options_name[RIGHT_SIDE] = right_name_filtered_opts.length;
    num_split_options_shortname[RIGHT_SIDE] = right_shortname_filtered_opts.length;
    split_options[RIGHT_SIDE] = ComponentsListName(right_name_filtered_opts).join(" + ");
    short_split_options[RIGHT_SIDE] = ComponentsListShortname(right_shortname_filtered_opts).join(" + ");
  }

  let name_components_list = null;
  let shortname_components_list = null;
  if (a.is_split) {
    name_components_list = ComponentsListName(FilterByOmitFromName(additional_options_objects.whole));
    shortname_components_list = ComponentsListShortname(FilterByOmitFromShortname(additional_options_objects.whole));
    if (match_info.product[LEFT_SIDE].piid === match_info.product[RIGHT_SIDE].piid) {
      if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
        name_components_list.unshift(match_info.product[LEFT_SIDE].name);
        shortname_components_list.unshift(match_info.product[LEFT_SIDE].name);
      }
      name_components_list.push(`(${split_options.join(" | ")})`);
      shortname_components_list.push(`(${short_split_options.join(" | ")})`);
      a.description = match_info.product[LEFT_SIDE].description;
    }
    else {
      // split product, different product instance match on each side
      // logical assertion: if name_components for a given side are all false, then it's an exact match
      const names = [
        (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [match_info.product[LEFT_SIDE].name] : [],
        (!is_compare_to_base[RIGHT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [match_info.product[RIGHT_SIDE].name] : []
      ];
      const shortnames = names.slice();
      if (additional_options_objects.left.length) {
        names[LEFT_SIDE] = names[LEFT_SIDE].concat(split_options[LEFT_SIDE]);
        shortnames[LEFT_SIDE] = shortnames[LEFT_SIDE].concat(short_split_options[LEFT_SIDE]);
      }
      if (additional_options_objects.right.length) {
        names[RIGHT_SIDE] = names[RIGHT_SIDE].concat(split_options[RIGHT_SIDE]);
        shortnames[RIGHT_SIDE] = shortnames[RIGHT_SIDE].concat(short_split_options[RIGHT_SIDE]);
      }
      if (names[LEFT_SIDE].length) { names[LEFT_SIDE].push("∅") };
      if (names[RIGHT_SIDE].length) { names[RIGHT_SIDE].push("∅") };
      const left_name = names[LEFT_SIDE].length > 1 || num_split_options_name[LEFT_SIDE] > 1 ? `( ${names[LEFT_SIDE].join(" + ")} )` : names[LEFT_SIDE].join(" + ");
      const right_name = names[RIGHT_SIDE].length > 1 || num_split_options_name[RIGHT_SIDE] > 1 ? `( ${names[RIGHT_SIDE].join(" + ")} )` : names[RIGHT_SIDE].join(" + ");
      const split_name = `${left_name} | ${right_name}`;
      name_components_list.push(name_components_list.length > 0 ? `( ${split_name} )` : split_name);
      if (shortnames[LEFT_SIDE].length) { shortnames[LEFT_SIDE].push("∅") }
      if (shortnames[RIGHT_SIDE].length) { shortnames[RIGHT_SIDE].push("∅") }
      const left_shortname = shortnames[LEFT_SIDE].length > 1 || num_split_options_shortname[LEFT_SIDE] > 1 ? `( ${shortnames[LEFT_SIDE].join(" + ")} )` : shortnames[LEFT_SIDE].join(" + ");
      const right_shortname = shortnames[RIGHT_SIDE].length > 1 || num_split_options_shortname[RIGHT_SIDE] > 1 ? `( ${shortnames[RIGHT_SIDE].join(" + ")} )` : shortnames[RIGHT_SIDE].join(" + ");
      const split_shortname = `${left_shortname} | ${right_shortname}`;
      shortname_components_list.push(shortname_components_list.length > 0 ? `( ${split_shortname} )` : split_shortname);
      a.description = match_info.product[LEFT_SIDE].description && match_info.product[RIGHT_SIDE].description ? `( ${match_info.product[LEFT_SIDE].description} ) | ( ${match_info.product[RIGHT_SIDE].description} )` : "";
    }
  } // end is_split case
  else {
    name_components_list = ComponentsListName(FilterByOmitFromName(additional_options_objects.whole));
    shortname_components_list = ComponentsListShortname(FilterByOmitFromShortname(additional_options_objects.whole));
    // we're using the left side because we know left and right are the same
    // if exact match to base product, no need to show the name
    if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
      name_components_list.unshift(match_info.product[LEFT_SIDE].name);
      shortname_components_list.unshift(match_info.product[LEFT_SIDE].name);
    }
    if (match_info.comparison_value[LEFT_SIDE] === EXACT_MATCH) {
      // assign PIID
      a.piid = match_info.product[LEFT_SIDE].piid;
      a.is_base = match_info.product[LEFT_SIDE].is_base;
    }
    a.description = match_info.product[LEFT_SIDE].description;
  }
  a.ordinal = match_info.product[LEFT_SIDE].ordinal;
  a.display_flags = match_info.product[LEFT_SIDE].display_flags;
  a.name = name_components_list.join(" + ");
  a.shortname = shortname_components_list.length === 0 ? match_info.product[LEFT_SIDE].shortname : shortname_components_list.join(" + ");
  RunTemplating(a);
}



}

export function WCPProductInitialize(a: WCPProduct, MENU: IMenu, service_time: moment.Moment) {
  this.SetBaseProductPIID(MENU);
  this.OrderModifiersAndOptions(MENU);
  this.price = this.ComputePrice(MENU);
  this.RecomputeMetadata(MENU);
  this.RecomputeName(MENU, service_time);
  this.options_sections = this.DisplayOptions(MENU);
}

// we need to take a map of these fields and allow name to be null if piid is _NOT_ set, piid should only be set if it's an exact match of a product instance in the catalog
export const WCPProductTODODELETE = function (product_class, piid, name, description, ordinal, modifiers, shortcode, is_base, display_flag: ) {
  this.PRODUCT_CLASS = product_class;
  this.piid = piid;
  this.name = name;
  this.description = description;
  this.ordinal = ordinal;
  this.is_base = is_base;
  this.shortcode = shortcode;
  this.display_flags = display_flags;
  this.base_product_piid = null;
  // product.modifiers[mtid] = [[placement, option_id]]
  // enum is 0: none, 1: left, 2: right, 3: both
  this.modifiers = DeepCopyPlacedOptions(modifiers);
  // memoized metadata
  this.price = null;
  this.is_split = false;
  this.bake_count = [0, 0];
  this.flavor_count = [0, 0];

  this.ComputePrice = (MENU) => {
    let price = this.PRODUCT_CLASS.price.amount / 100;
    Object.keys(this.modifiers).forEach(mtid => {
      this.modifiers[mtid].forEach((opt) => {
        if (opt[0] !== OptionPlacement.NONE) {
          price += MENU.modifiers[mtid].options[opt[1]].price;
        }
      });
    });
    return price;
  };

  this.RecomputeMetadata = (MENU) => {
    // recomputes bake_count, flavor_count, is_split
    const bake_count_compute = [0, 0];
    const flavor_count_compute = [0, 0];
    let is_split_compute = false;
    Object.keys(this.modifiers).forEach(mtid => {
      this.modifiers[mtid].forEach((opt) => {
        const option_obj = MENU.modifiers[mtid].options[opt[1]];
        if (opt[0] === OptionPlacement.LEFT || opt[0] === OptionPlacement.WHOLE) {
          bake_count_compute[LEFT_SIDE] += option_obj.bake_factor;
          flavor_count_compute[LEFT_SIDE] += option_obj.flavor_factor;
        }
        if (opt[0] === OptionPlacement.RIGHT || opt[0] === OptionPlacement.WHOLE) {
          bake_count_compute[RIGHT_SIDE] += option_obj.bake_factor;
          flavor_count_compute[RIGHT_SIDE] += option_obj.flavor_factor;
        }
        is_split_compute = is_split_compute || opt[0] === OptionPlacement.LEFT || opt[0] === OptionPlacement.RIGHT;
      });
    });
    this.bake_count = bake_count_compute;
    this.flavor_count = flavor_count_compute;
    this.is_split = is_split_compute;
  };



  this.Equals = (other: WCPProduct, MENU: IMenu) => WProductEquals(this, other, MENU);

  // eslint-disable-next-line consistent-return
  this.RecomputeName = (MENU, service_time) => {
    const { PRODUCT_CLASS } = this;
    const PRODUCT_CLASS_MENU_ENTRY = MENU.product_classes[PRODUCT_CLASS._id];

    // at this point we only know what product class we belong to. we might be an unmodified product, 
    // but that will need to be determined.
    const BASE_PRODUCT_INSTANCE = PRODUCT_CLASS_MENU_ENTRY.instances[this.base_product_piid];

    const match_info = {
      // TODO: we don't need to track shortcode separately since we can pull it from the matched product
      shortcodes: [BASE_PRODUCT_INSTANCE.shortcode, BASE_PRODUCT_INSTANCE.shortcode],
      product: [null, null],
      comparison: [[], []],
      comparison_value: [EXACT_MATCH, EXACT_MATCH]
    }

    const CheckMatchForSide = (side, comparison, comparison_product) => {
      if (match_info.product[side] === null && comparison.match[side] !== NO_MATCH) {
        match_info.product[side] = comparison_product;
        match_info.comparison[side] = comparison.match_matrix[side];
        match_info.comparison_value[side] = comparison.match[side];
        match_info.shortcodes[side] = comparison_product.shortcode;
      }
    }

    const RunTemplating = (product) => {
      const HandleOption = HandleOptionCurry(MENU, HandleOptionNameNoFilter);
      const name_template_match_array = product.name.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
      const description_template_match_array = product.description.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
      if (name_template_match_array === null && description_template_match_array === null) {
        product.processed_name = product.name;
        product.processed_description = product.description;
        return;
      }
      const name_template_match_obj = name_template_match_array ? name_template_match_array.reduce((acc, x) => Object.assign(acc, { [x]: "" }), {}) : {};
      const description_template_match_obj = description_template_match_array ? description_template_match_array.reduce((acc, x) => Object.assign(acc, { [x]: "" }), {}) : {};
      PRODUCT_CLASS.modifiers.forEach((pc_modifier) => {
        const { mtid } = pc_modifier;
        const modifier_flags = MENU.modifiers[mtid].modifier_type.display_flags;
        if (modifier_flags && modifier_flags.template_string !== "") {
          const template_string_with_braces = `{${modifier_flags.template_string}}`;
          const template_in_name = Object.hasOwn(name_template_match_obj, template_string_with_braces);
          const template_in_description = Object.hasOwn(description_template_match_obj, template_string_with_braces);
          if (template_in_name || template_in_description) {
            const filtered_exhaustive_options = product.exhaustive_options.whole.filter(x => x[0] === mtid);
            const modifier_values = filtered_exhaustive_options.map(HandleOption).filter(x => x !== "");
            if (modifier_values.length > 0) {
              const modifier_values_joined_string = modifier_flags.non_empty_group_prefix + modifier_values.join(modifier_flags.multiple_item_separator) + modifier_flags.non_empty_group_suffix;
              if (template_in_name) {
                name_template_match_obj[template_string_with_braces] = modifier_values_joined_string;
              }
              if (template_in_description) {
                description_template_match_obj[template_string_with_braces] = modifier_values_joined_string;
              }
            }
          }
        }
      });
      product.processed_name = product.name.replace(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX, (m) => Object.hasOwn(name_template_match_obj, m) ? name_template_match_obj[m] : "");
      product.processed_description = product.description.replace(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX, (m) => Object.hasOwn(description_template_match_obj, m) ? description_template_match_obj[m] : "");
    }

    const BuildName = (product, service_time) => {

      // TODO PULL THIS OUT to helper function
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
      const is_compare_to_base = [
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
      PRODUCT_CLASS.modifiers.forEach((pc_modifier, mtidx) => {
        const { mtid } = pc_modifier;
        const modifier_type_enable_function = pc_modifier.enable;
        const CATALOG_MODIFIER_INFO = MENU.modifiers[mtid];
        const is_single_select = CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1;
        const is_base_product_edge_case = is_single_select && !PRODUCT_CLASS.display_flags.show_name_of_base_product;
        product.modifier_map[mtid] = { has_selectable: false, meets_minimum: false, options: {} };
        const enable_modifier_type = modifier_type_enable_function === null || WFunctional.ProcessProductInstanceFunction(product, modifier_type_enable_function);
        for (let moidx = 0; moidx < CATALOG_MODIFIER_INFO.options_list.length; ++moidx) {
          const option_object = CATALOG_MODIFIER_INFO.options_list[moidx];
          const is_enabled = enable_modifier_type && DisableDataCheck(option_object.disable_data, service_time)
          const option_info = {
            placement: OptionPlacement.NONE,
            // do we need to figure out if we can de-select? answer: probably
            enable_left: is_enabled && option_object.can_split && option_object.IsEnabled(product, OptionPlacement.LEFT, MENU),
            enable_right: is_enabled && option_object.can_split && option_object.IsEnabled(product, OptionPlacement.RIGHT, MENU),
            enable_whole: is_enabled && option_object.IsEnabled(product, OptionPlacement.WHOLE, MENU),
          };
          const enable_left_or_right = option_info.enable_left || option_info.enable_right;
          product.advanced_option_eligible = product.advanced_option_eligible || enable_left_or_right;
          product.modifier_map[mtid].options[option_object.moid] = option_info;
          product.modifier_map[mtid].has_selectable = product.modifier_map[mtid].has_selectable || enable_left_or_right || option_info.enable_whole;
        }

        const num_selected = [0, 0];
        if (Object.hasOwn(product.modifiers, mtid)) {
          product.modifiers[mtid].forEach((placed_option) => {
            const moid = placed_option[1];
            const location = placed_option[0];
            const moidx = CATALOG_MODIFIER_INFO.options[moid].index;
            product.modifier_map[mtid].options[moid].placement = location;
            switch (location) {
              case OptionPlacement.LEFT: product.exhaustive_options.left.push([mtid, moid]); ++num_selected[LEFT_SIDE]; product.advanced_option_selected = true; break;
              case OptionPlacement.RIGHT: product.exhaustive_options.right.push([mtid, moid]); ++num_selected[RIGHT_SIDE]; product.advanced_option_selected = true; break;
              case OptionPlacement.WHOLE: product.exhaustive_options.whole.push([mtid, moid]); ++num_selected[LEFT_SIDE]; ++num_selected[RIGHT_SIDE]; break;
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
        const catalog_pi = PRODUCT_CLASS_MENU_ENTRY.instances[product.piid];
        product.name = catalog_pi.name;
        product.shortname = catalog_pi.shortcode;
        RunTemplating(product);
        return;
      }

      const additional_options_objects = {};
      Object.keys(product.additional_options).forEach(loc => {
        additional_options_objects[loc] = product.additional_options[loc].map(x => GetModifierOptionFromMIDOID(MENU, x[0], x[1]));
      });

      const split_options = ["∅", "∅"];
      const short_split_options = ["∅", "∅"];
      const num_split_options_name = [0, 0];
      const num_split_options_shortname = [0, 0];
      if (product.additional_options.left.length) {
        const left_name_filtered_opts = FilterByOmitFromName(additional_options_objects.left);
        const left_shortname_filtered_opts = FilterByOmitFromShortname(additional_options_objects.left);
        num_split_options_name[LEFT_SIDE] = left_name_filtered_opts.length;
        num_split_options_shortname[LEFT_SIDE] = left_shortname_filtered_opts.length;
        split_options[LEFT_SIDE] = ComponentsListName(left_name_filtered_opts).join(" + ");
        short_split_options[LEFT_SIDE] = ComponentsListShortname(left_shortname_filtered_opts).join(" + ");
      }
      if (product.additional_options.right.length) {
        const right_name_filtered_opts = FilterByOmitFromName(additional_options_objects.right);
        const right_shortname_filtered_opts = FilterByOmitFromShortname(additional_options_objects.right);
        num_split_options_name[RIGHT_SIDE] = right_name_filtered_opts.length;
        num_split_options_shortname[RIGHT_SIDE] = right_shortname_filtered_opts.length;
        split_options[RIGHT_SIDE] = ComponentsListName(right_name_filtered_opts).join(" + ");
        short_split_options[RIGHT_SIDE] = ComponentsListShortname(right_shortname_filtered_opts).join(" + ");
      }

      let name_components_list = null;
      let shortname_components_list = null;
      if (product.is_split) {
        name_components_list = ComponentsListName(FilterByOmitFromName(additional_options_objects.whole));
        shortname_components_list = ComponentsListShortname(FilterByOmitFromShortname(additional_options_objects.whole));
        if (match_info.product[LEFT_SIDE].piid === match_info.product[RIGHT_SIDE].piid) {
          if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
            name_components_list.unshift(match_info.product[LEFT_SIDE].name);
            shortname_components_list.unshift(match_info.product[LEFT_SIDE].name);
          }
          name_components_list.push(`(${split_options.join(" | ")})`);
          shortname_components_list.push(`(${short_split_options.join(" | ")})`);
          product.description = match_info.product[LEFT_SIDE].description;
        }
        else {
          // split product, different product instance match on each side
          // logical assertion: if name_components for a given side are all false, then it's an exact match
          const names = [
            (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [match_info.product[LEFT_SIDE].name] : [],
            (!is_compare_to_base[RIGHT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [match_info.product[RIGHT_SIDE].name] : []
          ];
          const shortnames = names.slice();
          if (additional_options_objects.left.length) {
            names[LEFT_SIDE] = names[LEFT_SIDE].concat(split_options[LEFT_SIDE]);
            shortnames[LEFT_SIDE] = shortnames[LEFT_SIDE].concat(short_split_options[LEFT_SIDE]);
          }
          if (additional_options_objects.right.length) {
            names[RIGHT_SIDE] = names[RIGHT_SIDE].concat(split_options[RIGHT_SIDE]);
            shortnames[RIGHT_SIDE] = shortnames[RIGHT_SIDE].concat(short_split_options[RIGHT_SIDE]);
          }
          if (names[LEFT_SIDE].length) { names[LEFT_SIDE].push("∅") };
          if (names[RIGHT_SIDE].length) { names[RIGHT_SIDE].push("∅") };
          const left_name = names[LEFT_SIDE].length > 1 || num_split_options_name[LEFT_SIDE] > 1 ? `( ${names[LEFT_SIDE].join(" + ")} )` : names[LEFT_SIDE].join(" + ");
          const right_name = names[RIGHT_SIDE].length > 1 || num_split_options_name[RIGHT_SIDE] > 1 ? `( ${names[RIGHT_SIDE].join(" + ")} )` : names[RIGHT_SIDE].join(" + ");
          const split_name = `${left_name} | ${right_name}`;
          name_components_list.push(name_components_list.length > 0 ? `( ${split_name} )` : split_name);
          if (shortnames[LEFT_SIDE].length) { shortnames[LEFT_SIDE].push("∅") }
          if (shortnames[RIGHT_SIDE].length) { shortnames[RIGHT_SIDE].push("∅") }
          const left_shortname = shortnames[LEFT_SIDE].length > 1 || num_split_options_shortname[LEFT_SIDE] > 1 ? `( ${shortnames[LEFT_SIDE].join(" + ")} )` : shortnames[LEFT_SIDE].join(" + ");
          const right_shortname = shortnames[RIGHT_SIDE].length > 1 || num_split_options_shortname[RIGHT_SIDE] > 1 ? `( ${shortnames[RIGHT_SIDE].join(" + ")} )` : shortnames[RIGHT_SIDE].join(" + ");
          const split_shortname = `${left_shortname} | ${right_shortname}`;
          shortname_components_list.push(shortname_components_list.length > 0 ? `( ${split_shortname} )` : split_shortname);
          product.description = match_info.product[LEFT_SIDE].description && match_info.product[RIGHT_SIDE].description ? `( ${match_info.product[LEFT_SIDE].description} ) | ( ${match_info.product[RIGHT_SIDE].description} )` : "";
        }
      } // end is_split case
      else {
        name_components_list = ComponentsListName(FilterByOmitFromName(additional_options_objects.whole));
        shortname_components_list = ComponentsListShortname(FilterByOmitFromShortname(additional_options_objects.whole));
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
      product.display_flags = match_info.product[LEFT_SIDE].display_flags;
      product.name = name_components_list.join(" + ");
      product.shortname = shortname_components_list.length === 0 ? match_info.product[LEFT_SIDE].shortname : shortname_components_list.join(" + ");
      RunTemplating(product);
    }

    // iterate through menu, until has_left and has_right are true
    // TODO: product naming with disabled products, see https://app.asana.com/0/1192054646278650/1192627836647899/f
    // a name can be assigned once an exact or at least match is found for a given side
    // instances_list is ordered by WProductSchema.ordinal and that should arrange products according to how we
    // want this function to find the appropriate name. Meaning the ordinal for base product has the highest number 
    // and the most modified products have the lowest numbers
    for (let pi_index = 0; pi_index < PRODUCT_CLASS_MENU_ENTRY.instances_list.length; ++pi_index) {
      const comparison_product = PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index];
      const comparison_info = Compare(this, PRODUCT_CLASS_MENU_ENTRY.instances_list[pi_index], MENU);
      CheckMatchForSide(LEFT_SIDE, comparison_info, comparison_product);
      CheckMatchForSide(RIGHT_SIDE, comparison_info, comparison_product);
      if (match_info.product[LEFT_SIDE] !== null && match_info.product[RIGHT_SIDE] !== null) {
        // finished, proceed to build the names and assign shortcodes
        return BuildName(this, service_time);
      }
    }
  };

  this.DisplayOptions = (MENU) => {
    const HandleOption = HandleOptionCurry(MENU, HandleOptionNameFilterOmitByName);
    const options_sections = [];
    if (this.exhaustive_options.whole.length > 0) {
      const option_names = this.exhaustive_options.whole.map(HandleOption).filter(x => x !== "");
      options_sections.push(["Whole", option_names.join(" + ")]);
    }
    if (this.exhaustive_options.left.length > 0) {
      const option_names = this.exhaustive_options.left.map(HandleOption).filter(x => x !== "");
      options_sections.push(["Left", option_names.join(" + ")]);
    }
    if (this.exhaustive_options.right.length > 0) {
      const option_names = this.exhaustive_options.right.map(HandleOption).filter(x => x !== "");
      options_sections.push(["Right", option_names.join(" + ")]);
    }
    return options_sections;
  };

  this.SetBaseProductPIID = (MENU) => {
    const PRODUCT_CLASS_MENU_ENTRY = MENU.product_classes[this.PRODUCT_CLASS._id];
    const BASE_PRODUCT_INSTANCE = PRODUCT_CLASS_MENU_ENTRY.instances_list.find((prod) => prod.is_base === true);
    if (!BASE_PRODUCT_INSTANCE) {
      console.error(`Cannot find base product instance of ${JSON.stringify(this.PRODUCT_CLASS)}.`);
      return;
    }
    this.base_product_piid = BASE_PRODUCT_INSTANCE.piid;
  }

  this.OrderModifiersAndOptions = (MENU) => {
    const new_obj = {};
    const sorted_mtids = Object.keys(this.modifiers).sort((a, b) => MENU.modifiers[a].modifier_type.ordinal - MENU.modifiers[b].modifier_type.ordinal)
    for (let mtidx = 0; mtidx < sorted_mtids.length; ++mtidx) {
      const mtid = sorted_mtids[mtidx];
      new_obj[mtid] = this.modifiers[mtid].sort((a, b) => MENU.modifiers[mtid].options[a[1]].index - MENU.modifiers[mtid].options[b[1]].index);
    }
    this.modifiers = new_obj;
  }

  this.Initialize = (MENU) => {
    this.SetBaseProductPIID(MENU);
    this.OrderModifiersAndOptions(MENU);
    this.price = this.ComputePrice(MENU);
    this.RecomputeMetadata(MENU);
    const service_time = moment();
    this.RecomputeName(MENU, service_time);
    this.options_sections = this.DisplayOptions(MENU);
  };

  this.ToDTO = () => ({
    pid: this.PRODUCT_CLASS._id,
    modifiers: this.modifiers
  });

};

export default WCPProduct;