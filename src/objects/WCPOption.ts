import { TOPPING_NONE, LEFT_SIDE, RIGHT_SIDE } from "../common";
import { WFunctional } from "./WFunctional";
import { IMenu, OptionPlacement, WCPProduct, WCPOption } from '../types';

  // matrix of proposed_delta indexed by [current placement][proposed placement]
  const DELTA_MATRIX = [
    [[+0, +0], [+1, +0], [+0, +1], [+1, +1]], // NONE
    [[-1, +0], [-1, +0], [-1, +1], [+0, +1]], // LEFT
    [[+0, -1], [+1, -1], [+0, -1], [+1, +0]], // RIGHT
    [[-1, -1], [+0, -1], [-1, +0], [-1, -1]], // WHOLE
  // [[ NONE ], [ LEFT ], [ RIGHT], [ WHOLE]]
  ];



export function IsOptionEnabled(option: WCPOption, product: WCPProduct, location: OptionPlacement, menu: IMenu) {
  // TODO: needs to factor in disable data for time based disable
    // TODO: needs to return false if we would exceed the limit for this modifier, IF that limit is > 1, because if it's === 1
    // we would handle the limitation by using smarts at the wcpmodifierdir level
    let modifier_placement = product.modifiers[option.mt._id] ? product.modifiers[option.mt._id].find(val => val[1] === option.mo._id) : undefined;
    modifier_placement = modifier_placement === undefined ? TOPPING_NONE : modifier_placement[0];
    // TODO: bake and flavor stuff should move into the enable_filter itself, the option itself should just hold generalized metadata the enable filter function can use/reference
    const {bake_max, flavor_max, bake_differential} = product.PRODUCT_CLASS.display_flags;
    const proposed_delta = DELTA_MATRIX[modifier_placement][location];

    const bake_after = [product.bake_count[LEFT_SIDE] + (option.mo.metadata.bake_factor * proposed_delta[LEFT_SIDE]), product.bake_count[RIGHT_SIDE] + (option.mo.metadata.bake_factor * proposed_delta[1])];
    const flavor_after = [product.flavor_count[LEFT_SIDE] + (option.mo.metadata.flavor_factor * proposed_delta[LEFT_SIDE]), product.flavor_count[RIGHT_SIDE] + (option.mo.metadata.flavor_factor * proposed_delta[1])];
    const passes_bake_diff_test = bake_differential >= Math.abs(bake_after[LEFT_SIDE]-bake_after[RIGHT_SIDE]);
    const has_room_on_left = bake_after[LEFT_SIDE] <= bake_max && flavor_after[LEFT_SIDE] <= flavor_max;
    const has_room_on_right = bake_after[RIGHT_SIDE] <= bake_max && flavor_after[RIGHT_SIDE] <= flavor_max;

    return (!option.mo.enable_function || WFunctional.ProcessProductInstanceFunction(product, option.mo.enable_function)) && has_room_on_left && has_room_on_right && passes_bake_diff_test;
}

// eslint-disable-next-line func-names
// export const WCPOption = function(w_modifier : IOptionType, w_option: IOption, index : number, enable_function : any) {
//   this.modifier = w_modifier;
//   this.moid = w_option._id
//   this.name = w_option.item.display_name;
//   this.shortname = w_option.item.shortcode;
//   this.description = w_option.item.description;
//   this.price = w_option.item.price.amount / 100;
//   this.index = index;
//   this.enable_filter = enable_function;
//   this.flavor_factor = w_option.metadata.flavor_factor;
//   this.bake_factor = w_option.metadata.bake_factor;
//   this.can_split = w_option.metadata.can_split;
//   this.disable_data = w_option.item.disabled;
//   this.display_flags = w_option.display_flags;
//   this.IsEnabled = (product, location, MENU) => {
//     // TODO: needs to factor in disable data for time based disable
//     // TODO: needs to return false if we would exceed the limit for this modifier, IF that limit is > 1, because if it's === 1
//     // we would handle the limitation by using smarts at the wcpmodifierdir level
//     let modifier_placement = product.modifiers[this.modifier._id] ? product.modifiers[this.modifier._id].find(val => val[1] === this.moid) : undefined;
//     modifier_placement = modifier_placement === undefined ? TOPPING_NONE : modifier_placement[0];
//     // TODO: bake and flavor stuff should move into the enable_filter itself, the option itself should just hold generalized metadata the enable filter function can use/reference
//     const {display_flags} = product.PRODUCT_CLASS;
//     const BAKE_MAX = display_flags ? display_flags.bake_max : 100;
//     const FLAVOR_MAX = display_flags ? display_flags.flavor_max : 100;
//     const BAKE_DIFF_MAX = display_flags ? display_flags.bake_differential : 100;
//     const proposed_delta = DELTA_MATRIX[modifier_placement][location];

//     const bake_after = [product.bake_count[LEFT_SIDE] + (this.bake_factor * proposed_delta[LEFT_SIDE]), product.bake_count[RIGHT_SIDE] + (this.bake_factor * proposed_delta[1])];
//     const flavor_after = [product.flavor_count[LEFT_SIDE] + (this.flavor_factor * proposed_delta[LEFT_SIDE]), product.flavor_count[RIGHT_SIDE] + (this.flavor_factor * proposed_delta[1])];
//     const passes_bake_diff_test = BAKE_DIFF_MAX >= Math.abs(bake_after[LEFT_SIDE]-bake_after[RIGHT_SIDE]);
//     const has_room_on_left = bake_after[LEFT_SIDE] <= BAKE_MAX && flavor_after[LEFT_SIDE] <= FLAVOR_MAX;
//     const has_room_on_right = bake_after[RIGHT_SIDE] <= BAKE_MAX && flavor_after[RIGHT_SIDE] <= FLAVOR_MAX;

//     return (!this.enable_filter || WFunctional.ProcessProductInstanceFunction(product, this.enable_filter)) && has_room_on_left && has_room_on_right && passes_bake_diff_test;
//   };
// };