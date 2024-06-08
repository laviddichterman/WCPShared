import { DisableDataCheck, PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX } from "../common";
import { WFunctional } from "./WFunctional";
import type { IProduct, IProductInstance, ProductModifierEntry, WCPProduct, WProductMetadata, MTID_MOID, IOptionInstance, MetadataModifierMap, ModifierDisplayListByLocation, MetadataModifierOptionMapEntry, WProduct, WCPProductV2Dto, IMoney, Selector, CatalogModifierEntry, ICatalogSelectors, ICatalogModifierSelectors, IOption, IProductModifier } from '../types';
import { MODIFIER_MATCH, PRODUCT_LOCATION, DISPLAY_AS, DISABLE_REASON, OptionPlacement, OptionQualifier } from '../types';
import { HandleOptionCurry, HandleOptionNameFilterOmitByName, HandleOptionNameNoFilter, IsOptionEnabled } from './WCPOption';
import { cloneDeep } from 'lodash';
// import { memoize } from 'lodash';

/* TODO: we need to pull out the computations into memoizable functions
this should remove the dependencies on the menu
we also need to remove the menu object itself because it's pre-cached stuff that should be memoized functions based on
catalog data as we get it.
calls to GetModifierOptionFromMIdOId might be easy places to start looking to remove this dependency
*/

const NO_MATCH = MODIFIER_MATCH.NO_MATCH;
const AT_LEAST = MODIFIER_MATCH.AT_LEAST;
const EXACT_MATCH = MODIFIER_MATCH.EXACT_MATCH;
const LEFT_SIDE = PRODUCT_LOCATION.LEFT;
const RIGHT_SIDE = PRODUCT_LOCATION.RIGHT;

type SIDE_MODIFIER_MATCH_MATRIX = MODIFIER_MATCH[][];
type LR_MODIFIER_MATCH_MATRIX = [SIDE_MODIFIER_MATCH_MATRIX, SIDE_MODIFIER_MATCH_MATRIX];
interface WProductCompareResult { mirror: boolean; match_matrix: LR_MODIFIER_MATCH_MATRIX; match: [MODIFIER_MATCH, MODIFIER_MATCH]; };

const ExtractMatch = (matrix: SIDE_MODIFIER_MATCH_MATRIX): MODIFIER_MATCH => (
  // we take the min of EXACT_MATCH and the thing we just computed because if there are no modifiers, then we'll get Infinity
  Math.min(EXACT_MATCH, Math.min.apply(null, matrix.map((modCompareArr) => Math.min.apply(null, modCompareArr))))
);

const ComponentsList = (source: IOption[], getter: (x: IOption) => any) => source.map((x) => getter(x));

const FilterByOmitFromName = (source: IOption[]) => (source.filter(x => !x.displayFlags || !x.displayFlags.omit_from_name));
const FilterByOmitFromShortname = (source: IOption[]) => (source.filter(x => !x.displayFlags || !x.displayFlags.omit_from_shortname));

const ComponentsListName = (source: IOption[]) => ComponentsList(source, (x: IOption) => x.displayName);

const ComponentsListShortname = (source: IOption[]) => ComponentsList(source, (x: IOption) => x.shortcode);

/**
 * returns an ordered list of potential prices for a product.
 * Product must be missing some number of INDEPENDENT, SINGLE SELECT modifier types.
 * Independent meaning there isn't a enable function dependence between any of the incomplete
 * modifier types or their options, single select meaning (MIN===MAX===1)
 * @param {WProductMetadata} metadata - the product instance to use
 * @param {ICatalogModifierSelectors} catModSelectors 
 * @return {IMoney[]} array of prices in ascending order
 */
export function ComputePotentialPrices(metadata: WProductMetadata, catModSelectors: ICatalogModifierSelectors): IMoney[] {
  // TODO: rewrite with map instead of foreach and use an object
  const prices: number[][] = [];
  Object.keys(metadata.modifier_map).forEach(mtid => {
    if (!metadata.modifier_map[mtid].meets_minimum) {
      const whole_enabled_modifier_options = catModSelectors.modifierEntry(mtid)!.options.filter(moId => metadata.modifier_map[mtid].options[moId].enable_whole.enable === DISABLE_REASON.ENABLED);
      const enabled_prices = whole_enabled_modifier_options.map(x => catModSelectors.option(x)!.price.amount);
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
  return prices[0].sort((a, b) => a - b).map(x => ({ amount: x + metadata.price.amount, currency: metadata.price.currency }));
}

// matrix of how products match indexed by [first placement][second placement] containing [left match, right match, break_mirror]
const MATCH_MATRIX: [MODIFIER_MATCH, MODIFIER_MATCH, boolean][][] = [
  [[EXACT_MATCH, EXACT_MATCH, false], [NO_MATCH, EXACT_MATCH, true], [EXACT_MATCH, NO_MATCH, true], [NO_MATCH, NO_MATCH, true]], // NONE
  [[AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, NO_MATCH, true]], // LEFT
  [[EXACT_MATCH, AT_LEAST, true], [NO_MATCH, NO_MATCH, false], [EXACT_MATCH, EXACT_MATCH, true], [NO_MATCH, EXACT_MATCH, true]], // RIGHT
  [[AT_LEAST, AT_LEAST, true], [EXACT_MATCH, AT_LEAST, true], [AT_LEAST, EXACT_MATCH, true], [EXACT_MATCH, EXACT_MATCH, false]], // WHOLE
  // [[ NONE ], [ LEFT ], [ RIGHT], [ WHOLE]]
];

export function CreateWCPProduct(productId: string, modifiers: ProductModifierEntry[]) {
  // todo: check if cloneDeep is still needed here
  return { productId: productId, modifiers: cloneDeep(modifiers) } as WCPProduct;
}

export function CreateProductWithMetadataFromV2Dto(dto: WCPProductV2Dto, catalogSelectors: ICatalogSelectors, service_time: Date | number, fulfillmentId: string): WProduct {
  // TODO: remove this sort and do the sort in the metadata computation
  const wcpProduct = CreateWCPProduct(dto.pid, dto.modifiers);
  const productMetadata = WCPProductGenerateMetadata(wcpProduct.productId, wcpProduct.modifiers, catalogSelectors, service_time, fulfillmentId);
  return { p: wcpProduct, m: productMetadata };
}

export function SortModifersAndOptions(mMap: ProductModifierEntry[], catModSelectors: ICatalogModifierSelectors) {
  return mMap.sort(
    (a, b) => catModSelectors.modifierEntry(a.modifierTypeId)!.modifierType.ordinal - catModSelectors.modifierEntry(b.modifierTypeId)!.modifierType.ordinal).map(
      (modifierEntry) => ({
        modifierTypeId: modifierEntry.modifierTypeId,
        options: modifierEntry.options.slice().sort((a, b) =>
          catModSelectors.option(a.optionId)!.ordinal - catModSelectors.option(b.optionId)!.ordinal)
      })
    )
}

function ProductModifierEntriesGetter(productMods: ProductModifierEntry[]): (mtid: string) => IOptionInstance[] {
  return (mtid: string) => {
    const foundMod = productMods.find(x => x.modifierTypeId === mtid);
    return foundMod ? foundMod.options : [];
  }
}

function MetadataModifiersInstanceListGetter(mil: MetadataModifierMap): (mtid: string) => IOptionInstance[] {
  const mMap: Record<string, IOptionInstance[]> = Object.entries(mil).reduce((o, [k, v]) => ({ ...o, [k]: Object.entries(v.options).map(([moid, opt]) => ({ ...opt, optionId: moid } as IOptionInstance)) }), {});
  return (mtid: string) => Object.hasOwn(mil, mtid) ? mMap[mtid] : [];
}

type ModifierGetter = (mtid: string) => IOptionInstance[];
/**
 * Takes two products, a and b, and computes comparison info
 * @param productModifierDefinition the shared productModifierDefinition of A and B
 * @param aModifiersGetter getter/transformation function for the modifiers of the product 'a'
 * @param bModifiersGetter getter/transformation function for the modifiers of the product we're comparing "a" to, 
 * required to be of the same product class
 * @param partialCatalog the modifiers and options section of the ICatalog
 */
function WProductCompareGeneric(productModifierDefinition: IProductModifier[], aModifiersGetter: ModifierGetter, bModifiersGetter: ModifierGetter, selectModifierEntry: Selector<CatalogModifierEntry>) {
  // this is a multi-dim array, in order of the MTID as it exists in the product class definition
  // disabled modifier types and modifier options are all present as they shouldn't contribute to comparison mismatch
  // elements of the modifiers_match_matrix are arrays of <LEFT_MATCH, RIGHT_MATCH> tuples
  const modifiers_match_matrix: LR_MODIFIER_MATCH_MATRIX = [[], []];
  productModifierDefinition.forEach((modifier) => {
    const modifierOptionsLength = selectModifierEntry(modifier.mtid)?.options?.length ?? 0;
    modifiers_match_matrix[LEFT_SIDE].push(Array(modifierOptionsLength).fill(EXACT_MATCH));
    modifiers_match_matrix[RIGHT_SIDE].push(Array(modifierOptionsLength).fill(EXACT_MATCH));
  })
  let is_mirror = true;
  // main comparison loop!
  productModifierDefinition.forEach((modifier, mIdX) => {
    const mtid = modifier.mtid;
    const first_option_list = aModifiersGetter(mtid);
    const other_option_list = bModifiersGetter(mtid);
    // in each modifier, need to determine if it's a SINGLE or MANY select 
    const CATALOG_MODIFIER_INFO = selectModifierEntry(mtid);
    if (!CATALOG_MODIFIER_INFO) {
      console.error(`Cannot find modifier with ID ${mtid}`);
      return;
    }
    if (CATALOG_MODIFIER_INFO.modifierType.min_selected === 1 && CATALOG_MODIFIER_INFO.modifierType.max_selected === 1) {
      // CASE: SINGLE select modifier, this logic isn't very well-defined. TODO: rework
      if (first_option_list.length === 1) {
        const first_option = first_option_list[0];
        if ((other_option_list.length === 1 && first_option.optionId !== other_option_list[0].optionId) || other_option_list.length !== 1) {
          // OID doesn't match, need to set AT_LEAST for JUST the option on the "first" product
          CATALOG_MODIFIER_INFO.options.forEach((oId, oIdX) => {
            if (first_option.optionId === oId) {
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
      CATALOG_MODIFIER_INFO.options.forEach((oId, oIdX) => {
        // todo: since the options will be in order, we can be smarter about not using a find here and track 2 indices instead   
        // var finder = modifier_option_find_function_factory(option.moid);     
        const first_option = first_option_list.find(val => val.optionId === oId);
        const other_option = other_option_list.find(val => val.optionId === oId);
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

export function WProductMetadataCompareProducts(productClass: IProduct, a: MetadataModifierMap, b: MetadataModifierMap, selectModifierEntry: Selector<CatalogModifierEntry>) {
  return WProductCompareGeneric(productClass.modifiers, MetadataModifiersInstanceListGetter(a), MetadataModifiersInstanceListGetter(b), selectModifierEntry);
}

export function WProductCompareToIProductInstance(a: WCPProduct, b: IProductInstance, catalogSelectors: Pick<ICatalogSelectors, "modifierEntry" | "productEntry">) {
  const productA = catalogSelectors.productEntry(a.productId);
  // need to compare PIDs of first and other, then use the PID to develop the modifiers matrix since one of the two product instances might not have a value for every modifier.
  if (a.productId !== b.productId || !productA) {
    // no match on PID so we need to return 0
    return { mirror: false, match_matrix: [[], []], match: [NO_MATCH, NO_MATCH] } as WProductCompareResult;
  }

  return WProductCompareGeneric(productA.product.modifiers, ProductModifierEntriesGetter(a.modifiers), ProductModifierEntriesGetter(b.modifiers), catalogSelectors.modifierEntry);
}

export function WProductCompare(a: WCPProduct, b: WCPProduct, catalogSelectors: Pick<ICatalogSelectors, "modifierEntry" | "productEntry">) {
  const productA = catalogSelectors.productEntry(a.productId);
  // need to compare PIDs of first and other, then use the PID to develop the modifiers matrix since one of the two product instances might not have a value for every modifier.
  if (a.productId !== b.productId || !productA) {
    // no match on PID so we need to return 0
    return { mirror: false, match_matrix: [[], []], match: [NO_MATCH, NO_MATCH] } as WProductCompareResult;
  }
  return WProductCompareGeneric(productA.product.modifiers, ProductModifierEntriesGetter(a.modifiers), ProductModifierEntriesGetter(b.modifiers), catalogSelectors.modifierEntry);
}

export function WProductEquals(comparison: WProductCompareResult) {
  return comparison.mirror ||
    (comparison.match[LEFT_SIDE] === EXACT_MATCH && comparison.match[RIGHT_SIDE] === EXACT_MATCH);
};

/**
 * 
 * @param catModSelectors: ICatalogModifierSelectors
 * @param exhaustive_modifiers already computed product metadata showing the exhaustive modifiers by section
 * @returns a list of customer facing options display
 */
export function WProductDisplayOptions(catModSelectors: ICatalogModifierSelectors, exhaustive_modifiers: ModifierDisplayListByLocation) {
  const HandleOption = HandleOptionCurry(catModSelectors, HandleOptionNameFilterOmitByName);
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


// TODO: split this out into generic templating code for use in order messages
type MatchTemplateObject = { [index: string]: string };
const RunTemplating = (product: IProduct, catModSelectors: ICatalogModifierSelectors, metadata: WProductMetadata) => {
  const HandleOption = HandleOptionCurry(catModSelectors, HandleOptionNameNoFilter);
  const name_template_match_array = metadata.name.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
  const description_template_match_array = metadata.description.match(PRODUCT_NAME_MODIFIER_TEMPLATE_REGEX);
  if (name_template_match_array === null && description_template_match_array === null) {
    return metadata;
  }
  const name_template_match_obj = name_template_match_array ? name_template_match_array.reduce((acc: MatchTemplateObject, x) => ({ ...acc, [x]: "" }), {}) : {};
  const description_template_match_obj = description_template_match_array ? description_template_match_array.reduce((acc: MatchTemplateObject, x) => ({ ...acc, [x]: "" }), {}) : {};
  product.modifiers.forEach((pc_modifier) => {
    const { mtid } = pc_modifier;
    const modifierEntry = catModSelectors.modifierEntry(mtid);
    if (!modifierEntry) {
      console.error(`Cannot find product modifier type ${mtid}`);
      return;
    }
    const modifier_flags = modifierEntry.modifierType.displayFlags;
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


export function WCPProductGenerateMetadata(productId: string, modifiers: ProductModifierEntry[], catalogSelectors: ICatalogSelectors, service_time: Date | number, fulfillmentId: string) {
  const PRODUCT_CLASS_ENTRY = catalogSelectors.productEntry(productId);
  if (!PRODUCT_CLASS_ENTRY) {
    const errMsg = `Cannot find product class ID ${productId}`;
    console.error(errMsg);
    throw (errMsg);
  }
  const PRODUCT_CLASS = PRODUCT_CLASS_ENTRY.product;

  const bake_count: [number, number] = [0, 0];
  const flavor_count: [number, number] = [0, 0];
  let is_split = false;

  const match_info = {
    product: [null, null],
    comparison: [[], []],
    comparison_value: [EXACT_MATCH, EXACT_MATCH]
  } as IMatchInfo;

  const CheckMatchForSide = (side: PRODUCT_LOCATION, comparison: WProductCompareResult, comparison_product: IProductInstance) => {
    if (match_info.product[side] === null && comparison.match[side] !== NO_MATCH) {
      match_info.product[side] = comparison_product;
      match_info.comparison[side] = comparison.match_matrix[side];
      match_info.comparison_value[side] = comparison.match[side];
    }
  }

  // iterate through menu, until has_left and has_right are true
  // a name can be assigned once an exact or at least match is found for a given side
  // instances_list is ordered by WProductSchema.ordinal and that should arrange products according to how we
  // want this function to find the appropriate name. Meaning the ordinal for base product has the highest number 
  // and the most modified products have the lowest numbers
  // SHOULD WE? we pluck out the base product ID and plop it last in the array so we can ensure matching works as intended?
  PRODUCT_CLASS_ENTRY.instances/*.filter(x=>x !== PRODUCT_CLASS.baseProductId)*/.map(x => catalogSelectors.productInstance(x)!)
    .sort((a, b) => a.ordinal - b.ordinal)
    .forEach(comparison_product => {
      if (match_info.product[LEFT_SIDE] === null || match_info.product[RIGHT_SIDE] === null) {
        const comparison_info = WProductCompareToIProductInstance({ productId, modifiers }, comparison_product, catalogSelectors);
        CheckMatchForSide(LEFT_SIDE, comparison_info, comparison_product);
        CheckMatchForSide(RIGHT_SIDE, comparison_info, comparison_product);
      }
    });

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
    throw (`Unable to determine product metadata. Match info for PC_ID ${PRODUCT_CLASS.id} with modifiers of ${JSON.stringify(modifiers)}: ${JSON.stringify(match_info)}.`);
  }

  let price = PRODUCT_CLASS.price.amount;

  // We need to compute this before the modifier match matrix, otherwise the metadata limits won't be pre-computed
  modifiers.forEach((modifierEntry: ProductModifierEntry) => {
    modifierEntry.options.forEach((opt: IOptionInstance) => {
      const mo = catalogSelectors.option(opt.optionId);
      if (!mo) {
        console.error(`Unable to find specified modifier option ${opt.optionId}`);
        return;
      }
      if (opt.placement === OptionPlacement.LEFT || opt.placement === OptionPlacement.WHOLE) {
        bake_count[LEFT_SIDE] += mo.metadata.bake_factor;
        flavor_count[LEFT_SIDE] += mo.metadata.flavor_factor;
      }
      if (opt.placement === OptionPlacement.RIGHT || opt.placement === OptionPlacement.WHOLE) {
        bake_count[RIGHT_SIDE] += mo.metadata.bake_factor;
        flavor_count[RIGHT_SIDE] += mo.metadata.flavor_factor;
      }
      if (opt.placement !== OptionPlacement.NONE) { price += mo.price.amount; }
      is_split ||= opt.placement === OptionPlacement.LEFT || opt.placement === OptionPlacement.RIGHT;
    });
  });

  const metadata: WProductMetadata = {
    name: '',
    description: '',
    shortname: '',
    pi: [leftPI.id, rightPI.id],
    is_split,
    price: { currency: PRODUCT_CLASS.price.currency, amount: price },
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
    PRODUCT_CLASS.baseProductId === leftPI.id,
    PRODUCT_CLASS.baseProductId === rightPI.id];

  // split out options beyond the base product into left additions, right additions, and whole additions
  // each entry in these arrays represents the modifier index on the product class and the option index in that particular modifier
  PRODUCT_CLASS.modifiers
    .map(productModifier => ({ modifierEntry: catalogSelectors.modifierEntry(productModifier.mtid), productModifier })) // get the catalog modifier entry
    .sort((a, b) => (a.modifierEntry?.modifierType.ordinal ?? 0) - (b.modifierEntry?.modifierType.ordinal ?? 0))
    .forEach(({ modifierEntry, productModifier }, mtIdX) => {
      const { mtid } = productModifier;
      if (!modifierEntry) {
        console.error(`Cannot find modifier ID ${mtid} specified in product class ID ${PRODUCT_CLASS.id}`);
        return;
      }
      const modifier_type_enable_function = productModifier.enable !== null ? catalogSelectors.productInstanceFunction(productModifier.enable) : undefined;
      const is_single_select = modifierEntry.modifierType.min_selected === 1 && modifierEntry.modifierType.max_selected === 1;
      const is_base_product_edge_case = is_single_select && !PRODUCT_CLASS.displayFlags.show_name_of_base_product;
      metadata.modifier_map[mtid] = { has_selectable: false, meets_minimum: false, options: {} };
      const enable_modifier_type: ({ enable: DISABLE_REASON.ENABLED } |
      { enable: DISABLE_REASON.DISABLED_FUNCTION, functionId: string } |
      { enable: DISABLE_REASON.DISABLED_FULFILLMENT_TYPE, fulfillment: string }) =
        productModifier.serviceDisable.indexOf(fulfillmentId) !== -1 ? { enable: DISABLE_REASON.DISABLED_FULFILLMENT_TYPE, fulfillment: fulfillmentId } :
          (!modifier_type_enable_function || WFunctional.ProcessProductInstanceFunction(modifiers, modifier_type_enable_function, catalogSelectors) ?
            { enable: DISABLE_REASON.ENABLED } :
            { enable: DISABLE_REASON.DISABLED_FUNCTION, functionId: modifier_type_enable_function.id });

      // this is a dangerous swap from menu to catalog where we don't have a contract on if we should be going through filtered modifiers at this point or not
      modifierEntry.options.forEach((oId) => {
        const option_object = catalogSelectors.option(oId);
        if (!option_object) {
          console.error(`Unable to find modifier option ${oId} of modifier type: ${modifierEntry.modifierType.name} (${mtid})`)
          return;
        }
        const can_split = option_object.metadata.can_split ? { enable: DISABLE_REASON.ENABLED } : { enable: DISABLE_REASON.DISABLED_NO_SPLITTING };
        const is_enabled = enable_modifier_type.enable === DISABLE_REASON.ENABLED ? DisableDataCheck(option_object.disabled, option_object.availability, service_time) : enable_modifier_type;
        const option_info = {
          placement: OptionPlacement.NONE,
          qualifier: OptionQualifier.REGULAR,
          // do we need to figure out if we can de-select? answer: probably
          enable_left: can_split.enable !== DISABLE_REASON.ENABLED ? can_split : (is_enabled.enable !== DISABLE_REASON.ENABLED ? is_enabled : IsOptionEnabled(option_object, { productId, modifiers }, metadata.bake_count, metadata.flavor_count, OptionPlacement.LEFT, catalogSelectors)),
          enable_right: can_split.enable !== DISABLE_REASON.ENABLED ? can_split : (is_enabled.enable !== DISABLE_REASON.ENABLED ? is_enabled : IsOptionEnabled(option_object, { productId, modifiers }, metadata.bake_count, metadata.flavor_count, OptionPlacement.RIGHT, catalogSelectors)),
          enable_whole: is_enabled.enable !== DISABLE_REASON.ENABLED ? is_enabled : IsOptionEnabled(option_object, { productId, modifiers }, metadata.bake_count, metadata.flavor_count, OptionPlacement.WHOLE, catalogSelectors),
        } as MetadataModifierOptionMapEntry;
        const enable_left_or_right = option_info.enable_left.enable === DISABLE_REASON.ENABLED || option_info.enable_right.enable === DISABLE_REASON.ENABLED;
        metadata.advanced_option_eligible ||= enable_left_or_right;
        metadata.modifier_map[mtid].options[option_object.id] = option_info;
        metadata.modifier_map[mtid].has_selectable ||= enable_left_or_right || option_info.enable_whole.enable === DISABLE_REASON.ENABLED;
      })

      const num_selected = [0, 0];
      const foundProductModifierEntry = modifiers.find(x => x.modifierTypeId === mtid);
      if (foundProductModifierEntry) {
        foundProductModifierEntry.options.forEach((placed_option) => {
          const moid = placed_option.optionId;
          const location = placed_option.placement;
          const moIdX = modifierEntry.options.indexOf(moid);
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
      const EMPTY_DISPLAY_AS = modifierEntry.modifierType.displayFlags.empty_display_as;
      const MIN_SELECTED = modifierEntry.modifierType.min_selected;
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
    metadata.name = leftPI.displayName;
    // NOTE: the following assignment of display name to shortname isn't really what we want for product naming, but the shortcode
    // wasn't being applied for modified products. the team wanted to see 4 Pepper + ex_mozz instead of F + ex_mozz for now
    metadata.shortname = leftPI.shortcode;
    metadata.description = leftPI.description;
    return RunTemplating(PRODUCT_CLASS, catalogSelectors, metadata);
  }

  const additional_options_objects = {
    left: metadata.additional_modifiers.left.map((x: MTID_MOID) => catalogSelectors.option(x[1])!),
    right: metadata.additional_modifiers.right.map((x: MTID_MOID) => catalogSelectors.option(x[1])!),
    whole: metadata.additional_modifiers.whole.map((x: MTID_MOID) => catalogSelectors.option(x[1])!),
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
    if (String(leftPI.id) === String(rightPI.id)) {
      if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.displayFlags.show_name_of_base_product) {
        name_components_list.unshift(leftPI.displayName);
        shortname_components_list.unshift(leftPI.displayName);
      }
      name_components_list.push(`(${split_options.join(" | ")})`);
      shortname_components_list.push(`(${short_split_options.join(" | ")})`);
      metadata.description = leftPI.description;
    }
    else {
      // split product, different product instance match on each side
      // logical assertion: if name_components for a given side are all false, then it's an exact match
      const names = [
        (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.displayFlags.show_name_of_base_product) ? [leftPI.displayName] : [],
        (!is_compare_to_base[RIGHT_SIDE] || PRODUCT_CLASS.displayFlags.show_name_of_base_product) ? [rightPI.displayName] : []
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
      metadata.description = leftPI.description && rightPI.description ? `( ${leftPI.description} ) | ( ${rightPI.description} )` : "";
    }
  } // end is_split case
  else {
    name_components_list = ComponentsListName(FilterByOmitFromName(additional_options_objects.whole));
    shortname_components_list = ComponentsListShortname(FilterByOmitFromShortname(additional_options_objects.whole));
    // we're using the left side because we know left and right are the same
    // if exact match to base product, no need to show the name
    if (!is_compare_to_base[LEFT_SIDE] || PRODUCT_CLASS.displayFlags.show_name_of_base_product) {
      name_components_list.unshift(leftPI.displayName);
      shortname_components_list.unshift(leftPI.shortcode);
    }
    metadata.description = leftPI.description;
  }
  metadata.name = name_components_list.join(" + ");
  metadata.shortname = shortname_components_list.length === 0 ? leftPI.shortcode : shortname_components_list.join(" + ");
  return RunTemplating(PRODUCT_CLASS, catalogSelectors, metadata);
}
