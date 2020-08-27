import { TOPPING_NONE, TOPPING_LEFT, TOPPING_RIGHT, TOPPING_WHOLE, LEFT_SIDE, RIGHT_SIDE } from "../common";
import { WFunctional } from "./WFunctional";

export const WCPOption = function (w_modifier, w_option, index, enable_function) {
  this.modifier = w_modifier;
  this.moid = w_option._id
  this.name = w_option.item.display_name;
  this.shortname = w_option.item.shortcode;
  this.description = w_option.item.description;
  this.price = w_option.item.price.amount / 100;
  this.index = index;
  this.enable_filter = enable_function;
  this.flavor_factor = w_option.metadata.flavor_factor;
  this.bake_factor = w_option.metadata.bake_factor;
  this.can_split = w_option.metadata.can_split;
  this.disable_data = w_option.item.disabled;
  this.IsEnabled = function (product, location, MENU) {
    // TODO: needs to factor in disable data for time based disable
    // TODO: needs to return false if we would exceed the limit for this modifier, IF that limit is > 1, because if it's === 1
    // we would handle the limitation by using smarts at the wcpmodifierdir level
    var modifier_option_find_function = function (val) {
      return val[1] === this.moid;
    };
    modifier_option_find_function = modifier_option_find_function.bind(this);
    var modifier_placement = product.modifiers[this.modifier._id] ? product.modifiers[this.modifier._id].find(modifier_option_find_function) : undefined;
    modifier_placement = modifier_placement === undefined ? TOPPING_NONE : modifier_placement[0];
    // TODO: bake and flavor stuff should move into the enable_filter itself, the option itself should just hold generalized metadata the enable filter function can use/reference
    var display_flags = product.PRODUCT_CLASS.display_flags;
    var BAKE_MAX = display_flags ? display_flags.bake_max : 100;
    var FLAVOR_MAX = display_flags ? display_flags.flavor_max : 100;
    var BAKE_DIFF_MAX = display_flags ? display_flags.bake_differential : 100;
    var proposed_delta = [0, 0];
    switch (location) {
      case TOPPING_LEFT: 
        switch (modifier_placement) {
          case TOPPING_NONE: proposed_delta = [+1, +0]; break;  // +1, +0
          case TOPPING_LEFT: proposed_delta = [-1, +0]; break;  // -1, +0
          case TOPPING_RIGHT: proposed_delta = [+1, -1]; break; // +1, -1
          case TOPPING_WHOLE: proposed_delta = [+0, -1]; break; // +0, -1
        }
        break;
      case TOPPING_RIGHT: 
        switch (modifier_placement) {
          case TOPPING_NONE: proposed_delta = [+0, +1]; break;  // +0, +1
          case TOPPING_LEFT: proposed_delta = [-1, +1]; break;  // -1, +1
          case TOPPING_RIGHT: proposed_delta = [+0, -1]; break; // +0, -1
          case TOPPING_WHOLE: proposed_delta = [-1, +0]; break; // -1, +0
        }
        break;
      case TOPPING_WHOLE: 
        switch (modifier_placement) {
          case TOPPING_NONE: proposed_delta = [+1, +1]; break;  // +1, +1
          case TOPPING_LEFT: proposed_delta = [+0, +1]; break;  // +0, +1
          case TOPPING_RIGHT: proposed_delta = [+1, +0]; break; // +1, +0
          case TOPPING_WHOLE: proposed_delta = [-1, -1]; break; // -1, -1
        }
        break;
      default: console.assert(false, "case not expected"); break;
    }

    var bake_after = [product.bake_count[LEFT_SIDE] + (this.bake_factor * proposed_delta[LEFT_SIDE]), product.bake_count[RIGHT_SIDE] + (this.bake_factor * proposed_delta[1])];
    var flavor_after = [product.flavor_count[LEFT_SIDE] + (this.flavor_factor * proposed_delta[LEFT_SIDE]), product.flavor_count[RIGHT_SIDE] + (this.flavor_factor * proposed_delta[1])];
    var passes_bake_diff_test = BAKE_DIFF_MAX >= Math.abs(bake_after[LEFT_SIDE]-bake_after[RIGHT_SIDE]);
    var has_room_on_left = bake_after[LEFT_SIDE] <= BAKE_MAX && flavor_after[LEFT_SIDE] <= FLAVOR_MAX;
    var has_room_on_right = bake_after[RIGHT_SIDE] <= BAKE_MAX && flavor_after[RIGHT_SIDE] <= FLAVOR_MAX;

    return (!this.enable_filter || WFunctional.ProcessProductInstanceFunction(product, this.enable_filter)) && has_room_on_left && has_room_on_right && passes_bake_diff_test;
  };
};

export default WCPOption;