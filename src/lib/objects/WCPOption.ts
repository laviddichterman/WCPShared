import { GetPlacementFromMIDOID } from "../common";
import {
  OptionPlacement,
  PRODUCT_LOCATION,
  WCPProduct,
  OptionEnableState,
  DISABLE_REASON,
  CatalogModifierEntry,
  IOption,
  Selector,
  MTID_MOID,
  DISPLAY_AS,
  ICatalogModifierSelectors,
  ICatalogSelectors
} from '../types';

import { WFunctional } from "./WFunctional";

// matrix of proposed_delta indexed by [current placement][proposed placement]
const DELTA_MATRIX = [
  [[+0, +0], [+1, +0], [+0, +1], [+1, +1]], // NONE
  [[-1, +0], [-1, +0], [-1, +1], [+0, +1]], // LEFT
  [[+0, -1], [+1, -1], [+0, -1], [+1, +0]], // RIGHT
  [[-1, -1], [+0, -1], [-1, +0], [-1, -1]], // WHOLE
  // [[ NONE ], [ LEFT ], [ RIGHT], [ WHOLE]]
];

const LEFT_SIDE = PRODUCT_LOCATION.LEFT;
const RIGHT_SIDE = PRODUCT_LOCATION.RIGHT;

type ModifierNameGetterFunction = (SelectModifierOption: Selector<IOption>, moid: string) => string;

export const ListModifierChoicesByDisplayName = (CATALOG_MODIFIER_INFO: CatalogModifierEntry, SelectModifierOption: Selector<IOption>) => {
  // TODO: needs to filter disabled or unavailable options
  const choices = CATALOG_MODIFIER_INFO.options.map(x => SelectModifierOption(x)?.displayName ?? "Undefined");
  return choices.length < 3 ? choices.join(" or ") : [choices.slice(0, -1).join(", "), choices[choices.length - 1]].join(", or ");
};

export const HandleOptionNameFilterOmitByName: ModifierNameGetterFunction = (modifierOptions, moid) => {
  const OPTION = modifierOptions(moid);
  return (OPTION && !OPTION.displayFlags.omit_from_name) ? OPTION.displayName : "";
}

export const HandleOptionNameNoFilter: ModifierNameGetterFunction = (modifierOptions, moid) => modifierOptions(moid)?.displayName ?? "Undefined";

export const HandleOptionCurry = (catModSelectors: ICatalogModifierSelectors, getterFxn: ModifierNameGetterFunction) => (x: MTID_MOID) => {
  if (x[1] === "") {
    const CATALOG_MODIFIER_INFO = catModSelectors.modifierEntry(x[0]);
    if (CATALOG_MODIFIER_INFO) {
      switch (CATALOG_MODIFIER_INFO.modifierType.displayFlags.empty_display_as) {
        case DISPLAY_AS.YOUR_CHOICE_OF: return `Your choice of ${CATALOG_MODIFIER_INFO.modifierType.displayName ?? CATALOG_MODIFIER_INFO.modifierType.name}`;
        case DISPLAY_AS.LIST_CHOICES: return ListModifierChoicesByDisplayName(CATALOG_MODIFIER_INFO, catModSelectors.option);
        // DISPLAY_AS.OMIT is handled elsewhere
        default: throw (`Unknown value for empty_display_as flag: ${CATALOG_MODIFIER_INFO.modifierType.displayFlags.empty_display_as}`);
      }
    }
  }
  return getterFxn(catModSelectors.option, x[1]);
};

export function IsOptionEnabled(option: IOption, product: WCPProduct, bake_count: readonly [number, number], flavor_count: readonly [number, number], location: OptionPlacement, catalogSelectors: ICatalogSelectors): OptionEnableState {
  // TODO: needs to factor in disable data for time based disable
  // TODO: needs to return false if we would exceed the limit for this modifier, IF that limit is > 1, because if it's === 1
  // we would handle the limitation by using smarts at the wcpmodifierdir level
  const placement = GetPlacementFromMIDOID(product.modifiers, option.modifierTypeId, option.id);
  // TODO: bake and flavor stuff should move into the enable_filter itself, the option itself should just hold generalized metadata the enable filter function can use/reference
  const { bake_max, flavor_max, bake_differential } = product.PRODUCT_CLASS.displayFlags;
  const proposed_delta = DELTA_MATRIX[placement.placement][location];

  const bake_after = [bake_count[LEFT_SIDE] + (option.metadata.bake_factor * proposed_delta[LEFT_SIDE]), bake_count[RIGHT_SIDE] + (option.metadata.bake_factor * proposed_delta[1])];
  const flavor_after = [flavor_count[LEFT_SIDE] + (option.metadata.flavor_factor * proposed_delta[LEFT_SIDE]), flavor_count[RIGHT_SIDE] + (option.metadata.flavor_factor * proposed_delta[1])];
  const passes_bake_diff_test = bake_differential >= Math.abs(bake_after[LEFT_SIDE] - bake_after[RIGHT_SIDE]);
  if (!passes_bake_diff_test) {
    return { enable: DISABLE_REASON.DISABLED_SPLIT_DIFFERENTIAL };
  }
  const passes_weight = bake_after[LEFT_SIDE] <= bake_max && bake_after[RIGHT_SIDE] <= bake_max;
  if (!passes_weight) {
    return { enable: DISABLE_REASON.DISABLED_WEIGHT };
  }
  const passes_flavor = flavor_after[LEFT_SIDE] <= flavor_max && flavor_after[RIGHT_SIDE] <= flavor_max;
  if (!passes_flavor) {
    return { enable: DISABLE_REASON.DISABLED_FLAVORS };
  }
  const enableFunction = option.enable ? catalogSelectors.productInstanceFunction(option.enable) : undefined;
  const passesEnableFunction = !enableFunction || WFunctional.ProcessProductInstanceFunction(product, enableFunction, catalogSelectors) as boolean;
  if (!passesEnableFunction) {
    return { enable: DISABLE_REASON.DISABLED_FUNCTION, functionId: option.enable! };
  }
  return { enable: DISABLE_REASON.ENABLED };
}