import { GetPlacementFromMIDOID } from "../common";
import {
  MenuProductInstanceFunctions,
  OptionPlacement,
  PRODUCT_LOCATION,
  WCPOption,
  WCPProduct
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

export function IsOptionEnabled(option: WCPOption, product: WCPProduct, bake_count: readonly [number, number], flavor_count: readonly [number, number], location: OptionPlacement, productInstanceFunctions: MenuProductInstanceFunctions) {
  // TODO: needs to factor in disable data for time based disable
  // TODO: needs to return false if we would exceed the limit for this modifier, IF that limit is > 1, because if it's === 1
  // we would handle the limitation by using smarts at the wcpmodifierdir level
  const placement = GetPlacementFromMIDOID(product, String(option.mt.id), String(option.mo.id));
  // TODO: bake and flavor stuff should move into the enable_filter itself, the option itself should just hold generalized metadata the enable filter function can use/reference
  const { bake_max, flavor_max, bake_differential } = product.PRODUCT_CLASS.display_flags;
  const proposed_delta = DELTA_MATRIX[placement.placement][location];

  const bake_after = [bake_count[LEFT_SIDE] + (option.mo.metadata.bake_factor * proposed_delta[LEFT_SIDE]), bake_count[RIGHT_SIDE] + (option.mo.metadata.bake_factor * proposed_delta[1])];
  const flavor_after = [flavor_count[LEFT_SIDE] + (option.mo.metadata.flavor_factor * proposed_delta[LEFT_SIDE]), flavor_count[RIGHT_SIDE] + (option.mo.metadata.flavor_factor * proposed_delta[1])];
  const passes_bake_diff_test = bake_differential >= Math.abs(bake_after[LEFT_SIDE] - bake_after[RIGHT_SIDE]);
  const has_room_on_left = bake_after[LEFT_SIDE] <= bake_max && flavor_after[LEFT_SIDE] <= flavor_max;
  const has_room_on_right = bake_after[RIGHT_SIDE] <= bake_max && flavor_after[RIGHT_SIDE] <= flavor_max;

  return (!option.mo.enable_function || WFunctional.ProcessProductInstanceFunction(product, productInstanceFunctions[String(option.mo.enable_function)])) && has_room_on_left && has_room_on_right && passes_bake_diff_test;
}