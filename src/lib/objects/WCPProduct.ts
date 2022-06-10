import { DisableDataCheck, PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX } from "../common";
import { WFunctional } from "./WFunctional";
import { IProduct, IProductInstance, OptionPlacement, ModifiersMap, MODIFIER_MATCH, MODIFIER_LOCATION, WCPProduct, WProductMetadata, MTID_MOID, ModifierEntry, WCPOption, MenuModifiers, IWModifiersInstance, IOptionInstance, OptionQualifier, MetadataModifierMap, ModifierDisplayListByLocation, ProductEntry, MenuProductInstanceFunctions, DISPLAY_AS } from '../types';
import { IsOptionEnabled } from './WCPOption';

const NO_MATCH = MODIFIER_MATCH.NO_MATCH;
const AT_LEAST = MODIFIER_MATCH.AT_LEAST;
const EXACT_MATCH = MODIFIER_MATCH.EXACT_MATCH;
const LEFT_SIDE = MODIFIER_LOCATION.LEFT;
const RIGHT_SIDE = MODIFIER_LOCATION.RIGHT;

type SIDE_MODIFIER_MATCH_MATRIX = MODIFIER_MATCH[][];
type LR_MODIFIER_MATCH_MATRIX = [SIDE_MODIFIER_MATCH_MATRIX, SIDE_MODIFIER_MATCH_MATRIX];
interface WProductCompareResult { mirror: boolean; match_matrix: LR_MODIFIER_MATCH_MATRIX; match: [MODIFIER_MATCH, MODIFIER_MATCH]; };
const GetModifierOptionFromMIdOId = (menuModifiers: MenuModifiers, mid: string, oid: string) => menuModifiers[mid].options[oid];

const ExtractMatch = (matrix: SIDE_MODIFIER_MATCH_MATRIX): MODIFIER_MATCH => (
  // we take the min of EXACT_MATCH and the thing we just computed because if there are no modifiers, then we'll get Infinity
  Math.min(EXACT_MATCH, Math.min.apply(null, matrix.map((modCompareArr) => Math.min.apply(null, modCompareArr))))
);

const ComponentsList = (source: WCPOption[], getter: (x: WCPOption) => any) => source.map((x) => getter(x));

const FilterByOmitFromName = (source: WCPOption[]) => (source.filter(x => !x.mo.display_flags || !x.mo.display_flags.omit_from_name));
const FilterByOmitFromShortname = (source: WCPOption[]) => (source.filter(x => !x.mo.display_flags || !x.mo.display_flags.omit_from_shortname));

const ComponentsListName = (source: WCPOption[]) => ComponentsList(source, (x: WCPOption) => x.mo.item.display_name);

const ComponentsListShortname = (source: WCPOption[]) => ComponentsList(source, (x: WCPOption) => x.mo.item.shortcode);

const HandleOptionNameFilterOmitByName = (menuModifiers: MenuModifiers, x: MTID_MOID) => {
  const OPTION = GetModifierOptionFromMIdOId(menuModifiers, x[0], x[1]);
  return (!OPTION.mo.display_flags || !OPTION.mo.display_flags.omit_from_name) ? OPTION.mo.item.display_name : "";
}

const HandleOptionNameNoFilter = (menuModifiers: MenuModifiers, x: MTID_MOID) => (GetModifierOptionFromMIdOId(menuModifiers, x[0], x[1]).mo.item.display_name);

const HandleOptionCurry = (menuModifiers: MenuModifiers, getterFxn: (menuModifiers: MenuModifiers, x: MTID_MOID) => string | undefined) => (x: MTID_MOID) => {
  // TODO: needs to filter disabled or unavailable options
  const LIST_CHOICES = (CATALOG_MODIFIER_INFO: ModifierEntry) => {
    const choices = CATALOG_MODIFIER_INFO.options_list.map(x => x.mo.item.display_name);
    return choices.length < 3 ? choices.join(" or ") : [choices.slice(0, -1).join(", "), choices[choices.length - 1]].join(", or ");
  };
  if (x[1] === "") {
    const CATALOG_MODIFIER_INFO = menuModifiers[x[0]];
    switch (CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as) {
      case DISPLAY_AS.YOUR_CHOICE_OF: return `Your choice of ${CATALOG_MODIFIER_INFO.modifier_type.display_name ? CATALOG_MODIFIER_INFO.modifier_type.display_name : CATALOG_MODIFIER_INFO.modifier_type.name}`;
      case DISPLAY_AS.LIST_CHOICES: return LIST_CHOICES(CATALOG_MODIFIER_INFO);
      // DISPLAY_AS.OMIT is handled elsewhere
      default: throw (`Unknown value for empty_display_as flag: ${CATALOG_MODIFIER_INFO.modifier_type.display_flags.empty_display_as}`);
    }
  }
  else {
    return getterFxn(menuModifiers, x);
  }
};

export const CopyWCPProduct = (pi: WCPProduct) => { return { ...pi }; }

//export const WCPProductFromDTO = (dto, MENU) => new WCPProduct(MENU.product_classes[dto.pid].product, "", "", "", 0, dto.modifiers, "", 0, false, {});

/**
 * returns an ordered list of potential prices for a product.
 * Product must be missing some number of INDEPENDENT, SINGLE SELECT modifier types.
 * Independent meaning there isn't a enable function dependence between any of the incomplete
 * modifier types or their options, single select meaning (MIN===MAX===1)
 * @param {WProductMetadata} metadata - the product instance to use
 * @param {MenuModifiers} menuModifiers
 * @return {[Number]} array of prices in ascending order
 */
export function ComputePotentialPrices(metadata: WProductMetadata, menuModifiers: MenuModifiers) {
  const prices: number[][] = [];
  Object.keys(metadata.modifier_map).forEach(mtid => {
    if (!metadata.modifier_map[mtid].meets_minimum) {
      const whole_enabled_modifier_options = menuModifiers[mtid].options_list.filter(x => metadata.modifier_map[mtid].options[x.mo._id].enable_whole);
      const enabled_prices = whole_enabled_modifier_options.map(x => x.mo.item.price.amount);
      const deduped_prices = [...new Set(enabled_prices)];
      prices.push(deduped_prices);
    }
  });

  while (prices.length >= 2) {
    const combined_prices: { [index: number]: boolean } = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const price0 of prices[0]) {
      // eslint-disable-next-line no-restricted-syntax
      for (const price1 of prices[1]) {
        combined_prices[price0 + price1] = true;
      }
    }
    prices.splice(0, 2, Object.keys(combined_prices).map(x => Number(x)));
  }
  return prices[0].sort((a, b) => a - b).map(x => x + metadata.price);
}

// matrix of how products match indexed by [first placement][second placement] containing [left match, right match, break_mirror]
const MATCH_MATRIX: [MODIFIER_MATCH, MODIFIER_MATCH, boolean][][] = [
  [[EXACT_MATCH, EXACT_MATCH, false], [NO_MATCH, EXACT_MATCH, true], [EXACT_MATCH, NO_MATCH, true], [NO_MATCH, NO_MATCH, true]], // NONE
  [[AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, NO_MATCH, true]], // LEFT
  [[EXACT_MATCH, AT_LEAST, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, EXACT_MATCH, true]], // RIGHT
  [[AT_LEAST, AT_LEAST, true], [EXACT_MATCH, AT_LEAST, true], [AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, false]], // WHOLE
  // [[ NONE ], [ LEFT ], [ RIGHT], [ WHOLE]]
];

export function CreateWCPProduct(product_class: IProduct, modifiers: ModifiersMap) {
  return { PRODUCT_CLASS: product_class, modifiers } as WCPProduct;
}

export function CreateWCPProductFromPI(prod: IProduct, pi: IProductInstance) {
  return CreateWCPProduct(
    prod,
    pi.modifiers.reduce((o, key) => ({ ...o, [key.modifier_type_id]: key.options.map(x => { return { option_id: x.option_id, placement: OptionPlacement[x.placement], qualifier: OptionQualifier[x.qualifier] }; }) }), {}), // this is a deep copy
  );
}

function ModifiersMapGetter(mMap: ModifiersMap): (mtid: string) => IOptionInstance[] {
  return (mtid: string) => Object.hasOwn(mMap, mtid) ? mMap[mtid] : [];
}

function IWModifiersInstanceListGetter(mil: IWModifiersInstance[]): (mtid: string) => IOptionInstance[] {
  const mMap: ModifiersMap = mil.reduce((o, key) => ({ ...o, [key.modifier_type_id]: key.options.map(x => { return { option_id: x.option_id, placement: OptionPlacement[x.placement], qualifier: OptionQualifier[x.qualifier] }; }) }), {});
  return (mtid: string) => Object.hasOwn(mMap, mtid) ? mMap[mtid] : [];
}
/**
 * Takes two products, a and b, and computes comparison info
 * @param a a WCPProduct
 * @param bModifiersGetter getter/transformation function for the modifiers of the product we're comparing "a" to, 
 * required to be of the same product class
 * @param menuModifiers the modifiers section of the IMenu
 */
function WProductCompareGeneric(a: WCPProduct, bModifiersGetter: (mtid: string) => IOptionInstance[], menuModifiers: MenuModifiers) {
  // this is a multi-dim array, in order of the MTID as it exists in the product class definition
  // disabled modifier types and modifier options are all present as they shouldn't contribute to comparison mismatch
  // elements of the modifiers_match_matrix are arrays of <LEFT_MATCH, RIGHT_MATCH> tuples
  const modifiers_match_matrix: LR_MODIFIER_MATCH_MATRIX = [[], []];
  a.PRODUCT_CLASS.modifiers.forEach((modifier) => {
    modifiers_match_matrix[LEFT_SIDE].push(Array(menuModifiers[modifier.mtid].options_list.length).fill(EXACT_MATCH));
    modifiers_match_matrix[RIGHT_SIDE].push(Array(menuModifiers[modifier.mtid].options_list.length).fill(EXACT_MATCH));
  })
  let is_mirror = true;
  // main comparison loop!
  a.PRODUCT_CLASS.modifiers.forEach((modifier, mIdX) => {
    const mtid = modifier.mtid;
    const first_option_list = Object.hasOwn(a.modifiers, mtid) ? a.modifiers[mtid] : [];
    const other_option_list = bModifiersGetter(mtid);
    // in each modifier, need to determine if it's a SINGLE or MANY select 
    const CATALOG_MODIFIER_INFO = menuModifiers[mtid];
    if (CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1) {
      // CASE: SINGLE select modifier, this logic isn't very well-defined. TODO: rework
      if (first_option_list.length === 1) {
        const first_option = first_option_list[0];
        if (other_option_list.length != 1) {
          throw (`got other option list of ${JSON.stringify(other_option_list)} but we were expecting a list of length 1`);
          // we log this error because we're not sure how the logic was working before converting to typescript
        }
        if (other_option_list.length === 1 && first_option.option_id !== other_option_list[0].option_id) {
          // OID doesn't match, need to set AT_LEAST for JUST the option on the "first" product
          CATALOG_MODIFIER_INFO.options_list.forEach((option, oIdX) => {
            // eslint-disable-next-line
            if (first_option.option_id == option.mo._id) {
              modifiers_match_matrix[LEFT_SIDE][mIdX][oIdX] = AT_LEAST;
              modifiers_match_matrix[RIGHT_SIDE][mIdX][oIdX] = AT_LEAST;
              is_mirror = false;
            }
          });
        }
      }
    }
    else {
      // CASE: MULTI select modifier
      CATALOG_MODIFIER_INFO.options_list.forEach((option, oIdX) => {
        // todo: since the options will be in order, we can be smarter about not using a find here and track 2 indices instead   
        // var finder = modifier_option_find_function_factory(option.moid);     
        // eslint-disable-next-line eqeqeq
        const first_option = first_option_list.find(val => val.option_id == option.mo._id);
        // eslint-disable-next-line eqeqeq
        const other_option = other_option_list.find(val => val.option_id == option.mo._id);
        const first_option_placement = first_option?.placement || OptionPlacement.NONE;
        const other_option_placement = other_option?.placement || OptionPlacement.NONE;
        const MATCH_CONFIGURATION = MATCH_MATRIX[first_option_placement][other_option_placement];
        modifiers_match_matrix[LEFT_SIDE][mIdX][oIdX] = MATCH_CONFIGURATION[LEFT_SIDE];
        modifiers_match_matrix[RIGHT_SIDE][mIdX][oIdX] = MATCH_CONFIGURATION[RIGHT_SIDE];
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

export function WProductCompareToIProductInstance(a: WCPProduct, b: IProductInstance, menuModifiers: MenuModifiers) {
  // need to compare PIDs of first and other, then use the PID to develop the modifiers matrix since one of the two product instances might not have a value for every modifier.
  // eslint-disable-next-line eqeqeq
  if (a.PRODUCT_CLASS._id != b.product_id) {
    // no match on PID so we need to return 0
    return { mirror: false, match_matrix: [[], []], match: [NO_MATCH, NO_MATCH] } as WProductCompareResult;
  }
  return WProductCompareGeneric(a, IWModifiersInstanceListGetter(b.modifiers), menuModifiers);
}

export function WProductCompare(a: WCPProduct, b: WCPProduct, menuModifiers: MenuModifiers) {
  // need to compare PIDs of first and other, then use the PID to develop the modifiers matrix since one of the two product instances might not have a value for every modifier.
  if (a.PRODUCT_CLASS._id !== b.PRODUCT_CLASS._id) {
    // no match on PID so we need to return 0
    return { mirror: false, match_matrix: [[], []], match: [NO_MATCH, NO_MATCH] } as WProductCompareResult;
  }
  return WProductCompareGeneric(a, ModifiersMapGetter(b.modifiers), menuModifiers);
}

export function WProductEquals(a: WCPProduct, b: WCPProduct, menuModifiers: MenuModifiers) {
  const comparison_info = WProductCompare(a, b, menuModifiers);
  return comparison_info.mirror ||
    (comparison_info.match[LEFT_SIDE] === EXACT_MATCH && comparison_info.match[RIGHT_SIDE] === EXACT_MATCH);
};

/**
 * 
 * @param MenuModifiers menuModifiers
 * @param exhaustive_modifiers already computed product metadata showing the exhaustive modifiers by section
 * @returns a list of customer facing options display
 */
export function WProductDisplayOptions(menuModifiers: MenuModifiers, exhaustive_modifiers: ModifierDisplayListByLocation) {
  const HandleOption = HandleOptionCurry(menuModifiers, HandleOptionNameFilterOmitByName);
  const options_sections = [];
  if (exhaustive_modifiers.whole.length > 0) {
    const option_names = exhaustive_modifiers.whole.map(HandleOption).filter(x => x && x !== "");
    options_sections.push(["Whole", option_names.join(" + ")]);
  }
  if (exhaustive_modifiers.left.length > 0) {
    const option_names = exhaustive_modifiers.left.map(HandleOption).filter(x => x && x !== "");
    options_sections.push(["Left", option_names.join(" + ")]);
  }
  if (exhaustive_modifiers.right.length > 0) {
    const option_names = exhaustive_modifiers.right.map(HandleOption).filter(x => x && x !== "");
    options_sections.push(["Right", option_names.join(" + ")]);
  }
  return options_sections;
};


type MatchTemplateObject = { [index: string]: string };
const RunTemplating = (product: IProduct, menuModifiers: MenuModifiers, metadata: WProductMetadata) => {
  const HandleOption = HandleOptionCurry(menuModifiers, HandleOptionNameNoFilter);
  const name_template_match_array = metadata.name.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
  const description_template_match_array = metadata.description.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
  if (name_template_match_array === null && description_template_match_array === null) {
    return metadata;
  }
  const name_template_match_obj = name_template_match_array ? name_template_match_array.reduce((acc: MatchTemplateObject, x) => ({ ...acc, [x]: "" }), {}) : {};
  const description_template_match_obj = description_template_match_array ? description_template_match_array.reduce((acc: MatchTemplateObject, x) => ({ ...acc, [x]: "" }), {}) : {};
  product.modifiers.forEach((pc_modifier) => {
    const { mtid } = pc_modifier;
    const modifier_flags = menuModifiers[mtid].modifier_type.display_flags;
    if (modifier_flags && modifier_flags.template_string !== "") {
      const template_string_with_braces = `{${modifier_flags.template_string}}`;
      const template_in_name = Object.hasOwn(name_template_match_obj, template_string_with_braces);
      const template_in_description = Object.hasOwn(description_template_match_obj, template_string_with_braces);
      if (template_in_name || template_in_description) {
        const filtered_exhaustive_modifiers = metadata.exhaustive_modifiers.whole.filter(x => x[0] === mtid);
        const modifier_values = filtered_exhaustive_modifiers.map(HandleOption).filter(x => x && x !== "");
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
    name: metadata.name.replace(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX, (m) => Object.hasOwn(name_template_match_obj, m) ? name_template_match_obj[m] : ""),
    description: metadata.description.replace(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX, (m) => Object.hasOwn(description_template_match_obj, m) ? description_template_match_obj[m] : "")
  } as WProductMetadata;
}

interface IMatchInfo { product: [IProductInstance | null, IProductInstance | null], comparison: LR_MODIFIER_MATCH_MATRIX; comparison_value: [MODIFIER_MATCH, MODIFIER_MATCH] };

export function WCPProductGenerateMetadata(a: WCPProduct, productClassMenu: ProductEntry, menuModifiers: MenuModifiers, productInstanceFunctions: MenuProductInstanceFunctions, service_time: Date) {
  const PRODUCT_CLASS = a.PRODUCT_CLASS;
  const BASE_PRODUCT_INSTANCE = productClassMenu.instances[productClassMenu.base_id];

  const bake_count: [number, number] = [0, 0];
  const flavor_count: [number, number] = [0, 0];
  let is_split = false;

  const match_info = {
    product: [null, null],
    comparison: [[], []],
    comparison_value: [EXACT_MATCH, EXACT_MATCH]
  } as IMatchInfo;

  const CheckMatchForSide = (side: MODIFIER_LOCATION, comparison: WProductCompareResult, comparison_product: IProductInstance) => {
    if (match_info.product[side] === null && comparison.match[side] !== NO_MATCH) {
      match_info.product[side] = comparison_product;
      match_info.comparison[side] = comparison.match_matrix[side];
      match_info.comparison_value[side] = comparison.match[side];
    }
  }

  // iterate through menu, until has_left and has_right are true
  // TODO: product naming with disabled products, see https://app.asana.com/0/1192054646278650/1192627836647899/f
  // a name can be assigned once an exact or at least match is found for a given side
  // instances_list is ordered by WProductSchema.ordinal and that should arrange products according to how we
  // want this function to find the appropriate name. Meaning the ordinal for base product has the highest number 
  // and the most modified products have the lowest numbers
  for (let pi_index = 0; pi_index < productClassMenu.instances_list.length; ++pi_index) {
    const comparison_product = productClassMenu.instances_list[pi_index];
    const comparison_info = WProductCompareToIProductInstance(a, productClassMenu.instances_list[pi_index], menuModifiers);
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
  const leftPI = match_info.product[LEFT_SIDE];
  const rightPI = match_info.product[RIGHT_SIDE];
  if (leftPI === null || rightPI === null) {
    throw ("Unable to determine product metadata");
  }

  let price = PRODUCT_CLASS.price.amount;

  // We need to compute this before the modifier match matrix, otherwise the metadata limits won't be pre-computed
  Object.entries(a.modifiers).forEach(([mtid, options]) => {
    options.forEach((opt) => {
      const mo = menuModifiers[mtid].options[opt.option_id].mo;
      if (opt.placement === OptionPlacement.LEFT || opt.placement === OptionPlacement.WHOLE) {
        bake_count[LEFT_SIDE] += mo.metadata.bake_factor;
        flavor_count[LEFT_SIDE] += mo.metadata.flavor_factor;
      }
      if (opt.placement === OptionPlacement.RIGHT || opt.placement === OptionPlacement.WHOLE) {
        bake_count[RIGHT_SIDE] += mo.metadata.bake_factor;
        flavor_count[RIGHT_SIDE] += mo.metadata.flavor_factor;
      }
      if (opt.placement !== OptionPlacement.NONE) { price += mo.item.price.amount; }
      is_split ||= opt.placement === OptionPlacement.LEFT || opt.placement === OptionPlacement.RIGHT;
    });
  });

  const metadata: WProductMetadata = {
    name: '',
    description: '',
    shortname: '',
    pi: [leftPI, rightPI],
    is_split,
    price: price / 100,
    incomplete: false,
    modifier_map: {} as MetadataModifierMap,
    advanced_option_eligible: false,
    advanced_option_selected: false,
    additional_modifiers: { left: [], right: [], whole: [] } as ModifierDisplayListByLocation,
    exhaustive_modifiers: { left: [], right: [], whole: [] } as ModifierDisplayListByLocation,
    bake_count,
    flavor_count,
  };

  // determine if we're comparing to the base product on the left and right sides
  const is_compare_to_base = [
    BASE_PRODUCT_INSTANCE._id === leftPI._id,
    BASE_PRODUCT_INSTANCE._id === rightPI._id];

  // split out options beyond the base product into left additions, right additions, and whole additions
  // each entry in these arrays represents the modifier index on the product class and the option index in that particular modifier
  PRODUCT_CLASS.modifiers.forEach((pc_modifier, mtIdX) => {
    const { mtid } = pc_modifier;
    const modifier_type_enable_function = pc_modifier.enable;
    const CATALOG_MODIFIER_INFO = menuModifiers[mtid];
    const is_single_select = CATALOG_MODIFIER_INFO.modifier_type.min_selected === 1 && CATALOG_MODIFIER_INFO.modifier_type.max_selected === 1;
    const is_base_product_edge_case = is_single_select && !PRODUCT_CLASS.display_flags.show_name_of_base_product;
    metadata.modifier_map[mtid] = { has_selectable: false, meets_minimum: false, options: {} };
    const enable_modifier_type = modifier_type_enable_function === null || WFunctional.ProcessProductInstanceFunction(a, productInstanceFunctions[modifier_type_enable_function._id]);
    for (let moIdX = 0; moIdX < CATALOG_MODIFIER_INFO.options_list.length; ++moIdX) {
      const option_object = CATALOG_MODIFIER_INFO.options_list[moIdX];
      const is_enabled = enable_modifier_type && DisableDataCheck(option_object.mo.item.disabled, service_time)
      const option_info = {
        placement: OptionPlacement.NONE,
        // do we need to figure out if we can de-select? answer: probably
        enable_left: is_enabled && option_object.mo.metadata.can_split && IsOptionEnabled(option_object, a, metadata.bake_count, metadata.flavor_count, OptionPlacement.LEFT, productInstanceFunctions),
        enable_right: is_enabled && option_object.mo.metadata.can_split && IsOptionEnabled(option_object, a, metadata.bake_count, metadata.flavor_count, OptionPlacement.RIGHT, productInstanceFunctions),
        enable_whole: is_enabled && IsOptionEnabled(option_object, a, metadata.bake_count, metadata.flavor_count, OptionPlacement.WHOLE, productInstanceFunctions),
      };
      const enable_left_or_right = option_info.enable_left || option_info.enable_right;
      metadata.advanced_option_eligible ||= enable_left_or_right;
      metadata.modifier_map[mtid].options[option_object.mo._id] = option_info;
      metadata.modifier_map[mtid].has_selectable ||= enable_left_or_right || option_info.enable_whole;
    }

    const num_selected = [0, 0];
    if (Object.hasOwn(a.modifiers, mtid)) {
      a.modifiers[mtid].forEach((placed_option) => {
        const moid = placed_option.option_id;
        const location = placed_option.placement;
        const moIdX = CATALOG_MODIFIER_INFO.options[moid].index;
        metadata.modifier_map[mtid].options[moid].placement = location;
        switch (location) {
          case OptionPlacement.LEFT: metadata.exhaustive_modifiers.left.push([mtid, moid]); ++num_selected[LEFT_SIDE]; metadata.advanced_option_selected = true; break;
          case OptionPlacement.RIGHT: metadata.exhaustive_modifiers.right.push([mtid, moid]); ++num_selected[RIGHT_SIDE]; metadata.advanced_option_selected = true; break;
          case OptionPlacement.WHOLE: metadata.exhaustive_modifiers.whole.push([mtid, moid]); ++num_selected[LEFT_SIDE]; ++num_selected[RIGHT_SIDE]; break;
          default: break;
        }
        const opt_compare_info = [match_info.comparison[LEFT_SIDE][mtIdX][moIdX], match_info.comparison[RIGHT_SIDE][mtIdX][moIdX]];
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
      if (EMPTY_DISPLAY_AS !== DISPLAY_AS.OMIT && metadata.modifier_map[mtid].has_selectable) { metadata.exhaustive_modifiers.whole.push([mtid, ""]); }
      metadata.modifier_map[mtid].meets_minimum = !metadata.modifier_map[mtid].has_selectable;
      metadata.incomplete ||= metadata.modifier_map[mtid].has_selectable;
    }
    else if (num_selected[LEFT_SIDE] < MIN_SELECTED) {
      if (EMPTY_DISPLAY_AS !== DISPLAY_AS.OMIT && metadata.modifier_map[mtid].has_selectable) { metadata.exhaustive_modifiers.left.push([mtid, ""]); }
      metadata.modifier_map[mtid].meets_minimum = !metadata.modifier_map[mtid].has_selectable;
      metadata.incomplete ||= metadata.modifier_map[mtid].has_selectable;
    }
    else if (num_selected[RIGHT_SIDE] < MIN_SELECTED) {
      if (EMPTY_DISPLAY_AS !== DISPLAY_AS.OMIT && metadata.modifier_map[mtid].has_selectable) { metadata.exhaustive_modifiers.right.push([mtid, ""]); }
      metadata.modifier_map[mtid].meets_minimum = !metadata.modifier_map[mtid].has_selectable;
      metadata.incomplete ||= metadata.modifier_map[mtid].has_selectable;
    }
    else {
      // both left and right meet the minimum selected criteria
      metadata.modifier_map[mtid].meets_minimum = true;
    }
  });

  // check for an exact match before going through all the name computation
  if (!is_split && match_info.comparison_value[LEFT_SIDE] === EXACT_MATCH && match_info.comparison_value[RIGHT_SIDE] === EXACT_MATCH) {
    // if we're an unmodified product instance from the catalog,
    // we should find that product and assume its name.
    metadata.name = leftPI.item.display_name;
    metadata.shortname = leftPI.item.shortcode;
    metadata.description = leftPI.item.description;
    return RunTemplating(PRODUCT_CLASS, menuModifiers, metadata);
  }

  const additional_options_objects = {
    left: metadata.additional_modifiers.left.map((x: MTID_MOID) => GetModifierOptionFromMIdOId(menuModifiers, x[0], x[1])),
    right: metadata.additional_modifiers.right.map((x: MTID_MOID) => GetModifierOptionFromMIdOId(menuModifiers, x[0], x[1])),
    whole: metadata.additional_modifiers.whole.map((x: MTID_MOID) => GetModifierOptionFromMIdOId(menuModifiers, x[0], x[1])),
  };

  const split_options = ["∅", "∅"];
  const short_split_options = ["∅", "∅"];
  const num_split_options_name = [0, 0];
  const num_split_options_shortname = [0, 0];
  if (metadata.additional_modifiers.left.length) {
    const left_name_filtered_opts = FilterByOmitFromName(additional_options_objects.left);
    const left_shortname_filtered_opts = FilterByOmitFromShortname(additional_options_objects.left);
    num_split_options_name[LEFT_SIDE] = left_name_filtered_opts.length;
    num_split_options_shortname[LEFT_SIDE] = left_shortname_filtered_opts.length;
    split_options[LEFT_SIDE] = ComponentsListName(left_name_filtered_opts).join(" + ");
    short_split_options[LEFT_SIDE] = ComponentsListShortname(left_shortname_filtered_opts).join(" + ");
  }
  if (metadata.additional_modifiers.right.length) {
    const right_name_filtered_opts = FilterByOmitFromName(additional_options_objects.right);
    const right_shortname_filtered_opts = FilterByOmitFromShortname(additional_options_objects.right);
    num_split_options_name[RIGHT_SIDE] = right_name_filtered_opts.length;
    num_split_options_shortname[RIGHT_SIDE] = right_shortname_filtered_opts.length;
    split_options[RIGHT_SIDE] = ComponentsListName(right_name_filtered_opts).join(" + ");
    short_split_options[RIGHT_SIDE] = ComponentsListShortname(right_shortname_filtered_opts).join(" + ");
  }

  let name_components_list = null;
  let shortname_components_list = null;
  if (metadata.is_split) {
    name_components_list = ComponentsListName(FilterByOmitFromName(additional_options_objects.whole));
    shortname_components_list = ComponentsListShortname(FilterByOmitFromShortname(additional_options_objects.whole));
    if (leftPI._id === leftPI._id) {
      if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
        name_components_list.unshift(leftPI.item.display_name);
        shortname_components_list.unshift(leftPI.item.display_name);
      }
      name_components_list.push(`(${split_options.join(" | ")})`);
      shortname_components_list.push(`(${short_split_options.join(" | ")})`);
      metadata.description = leftPI.item.description;
    }
    else {
      // split product, different product instance match on each side
      // logical assertion: if name_components for a given side are all false, then it's an exact match
      const names = [
        (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [leftPI.item.display_name] : [],
        (!is_compare_to_base[RIGHT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) ? [rightPI.item.display_name] : []
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
      metadata.description = leftPI.item.description && rightPI.item.description ? `( ${leftPI.item.description} ) | ( ${rightPI.item.description} )` : "";
    }
  } // end is_split case
  else {
    name_components_list = ComponentsListName(FilterByOmitFromName(additional_options_objects.whole));
    shortname_components_list = ComponentsListShortname(FilterByOmitFromShortname(additional_options_objects.whole));
    // we're using the left side because we know left and right are the same
    // if exact match to base product, no need to show the name
    if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.display_flags.show_name_of_base_product) {
      name_components_list.unshift(leftPI.item.display_name);
      shortname_components_list.unshift(leftPI.item.display_name);
    }
    metadata.description = leftPI.item.description;
  }
  metadata.name = name_components_list.join(" + ");
  metadata.shortname = shortname_components_list.length === 0 ? leftPI.item.shortcode : shortname_components_list.join(" + ");
  return RunTemplating(PRODUCT_CLASS, menuModifiers, metadata);
}
