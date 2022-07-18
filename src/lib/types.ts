export interface SEMVER { major: number; minor: number; patch: number; };

export interface IWInterval {
  start: number;
  end: number;
};

export type WIntervalTuple = [number, number];
export type IntervalTupleList = WIntervalTuple[];
export type OperatingHoursList = [IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList];
// TODO: convert { [index:number]: boolean } => boolean[];
export interface ServicesEnableMap { [index: number]: boolean };
export interface IWSettings {
  additional_pizza_lead_time: number;
  time_step: number[];
  pipeline_info: {
    baking_pipeline: { slots: Number, time: Number }[];
    transfer_padding: number;
  };
  operating_hours: OperatingHoursList[]
};
export interface IWBlockedOff {
  blocked_off: {
    service: number;
    exclusion_date: string;
    excluded_intervals: IWInterval[];
  }[];
};
export interface AvailabilityInfoMap {
  // the union of blocked off times for the services specified in computation stored as a list of two tuples
  blocked_off_union: IntervalTupleList;
  // the union of operating hours for the services specified in computation stored as a list of two tuples
  operating_intervals: IntervalTupleList;
  // the minutes from current time needed to prepare the order
  leadTime: number;
  // the minimum number of minutes between selectable options for any services specified in computation
  min_time_step: number
};
/**
 * @typedef {[string, IntervalTupleList][][]} JSFEBlockedOff - is stored in the memory/wire format here of:
 * [service_index][<String, [<start, end>]>], 
 *  meaning an array indexed by service_index of...
 * ... an array of two-tuples ...
 * ... whose 0th element is the string representation of the date, and whose 1th element is a list of interval tuples
 */
export type JSFEBlockedOff = ([string, IntervalTupleList])[][];

export enum DayIndex { SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY };

export enum DISPLAY_AS {
  OMIT = 'OMIT',
  YOUR_CHOICE_OF = 'YOUR_CHOICE_OF',
  LIST_CHOICES = 'LIST_CHOICES'
};

export enum MODIFIER_MATCH { NO_MATCH, AT_LEAST, EXACT_MATCH };

export enum PRODUCT_LOCATION { LEFT, RIGHT };

export enum PriceDisplay {
  'FROM_X' = 'FROM_X',
  'VARIES' = 'VARIES',
  'ALWAYS' = 'ALWAYS',
  'MIN_TO_MAX' = 'MIN_TO_MAX',
  'LIST' = 'LIST'
};

export enum ProductInstanceFunctionType {
  'ConstLiteral' = "ConstLiteral",
  'IfElse' = 'IfElse',
  'Logical' = 'Logical',
  'ModifierPlacement' = 'ModifierPlacement',
  'HasAnyOfModifierType' = 'HasAnyOfModifierType'
};

export interface IExternalIDs {
  revelID: string;
  squareID: string;
};

export enum MODIFIER_CLASS {
  SIZE = 'SIZE',
  ADD = 'ADD',
  SUB = 'SUB',
  REMOVAL = 'REMOVAL',
  NOTE = 'NOTE',
  PROMPT = 'PROMPT'
};
export enum CALL_LINE_DISPLAY {
  'SHORTCODE' = 'SHORTCODE',
  'SHORTNAME' = 'SHORTNAME'
};
export enum CURRENCY {
  USD = "USD"
};

export enum OptionPlacement {
  'NONE', 'LEFT', 'RIGHT', 'WHOLE'
};

export enum OptionQualifier {
  'REGULAR', 'LITE', 'HEAVY', 'OTS'
};

export interface IMoney {
  amount: number;
  currency: CURRENCY;
};


export interface IConstLiteralExpression {
  value: number | boolean | string;
};
export interface IIfElseExpression {
  true_branch: IAbstractExpression;
  false_branch: IAbstractExpression;
  test: IAbstractExpression;
};

export enum ProductInstanceFunctionOperator { 'AND' = "AND", 'OR' = "OR", 'NOT' = "NOT", 'EQ' = "EQ", 'NE' = "NE", 'GT' = "GT", 'GE' = "GE", 'LT' = "LT", 'LE' = "LE" };

export interface ILogicalExpression {
  operandA: IAbstractExpression;
  operandB?: IAbstractExpression;
  operator: ProductInstanceFunctionOperator;
};
export interface IModifierPlacementExpression {
  mtid: string;
  moid: string;
};
export interface IHasAnyOfModifierExpression {
  mtid: string;
};

type AbstractExpressionConstLiteral = {
  expr: IConstLiteralExpression;
  discriminator: ProductInstanceFunctionType.ConstLiteral;
}
type AbstractExpressionIfElseExpression = {
  expr: IIfElseExpression;
  discriminator: ProductInstanceFunctionType.IfElse;
}
type AbstractExpressionLogicalExpression = {
  expr: ILogicalExpression;
  discriminator: ProductInstanceFunctionType.Logical;
}
type AbstractExpressionModifierPlacementExpression = {
  expr: IModifierPlacementExpression;
  discriminator: ProductInstanceFunctionType.ModifierPlacement;
}
type AbstractExpressionHasAnyOfModifierExpression = {
  expr: IHasAnyOfModifierExpression;
  discriminator: ProductInstanceFunctionType.HasAnyOfModifierType;
}

export type IAbstractExpression = AbstractExpressionConstLiteral |
  AbstractExpressionIfElseExpression |
  AbstractExpressionLogicalExpression |
  AbstractExpressionModifierPlacementExpression |
  AbstractExpressionHasAnyOfModifierExpression;

export interface IProductInstanceFunction {
  id: string;
  expression: IAbstractExpression;
  name: string;
};


export interface ICategory {
  id: string;
  name: string;
  description: string | null;
  ordinal: number;
  parent_id: string | null;
  subheading: string | null,
  footnotes: string | null,
  display_flags: {
    call_line_name: string;
    call_line_display: CALL_LINE_DISPLAY;
  };
};

export interface ICatalogItem {
  display_name: string;
  description: string;
  shortcode: string;
  price: IMoney;
  externalIDs?: IExternalIDs;
  disabled: IWInterval | null;
  permanent_disable?: boolean;
};

export interface IOptionType {
  id: string;
  name: string;
  display_name: string;
  externalIDs?: IExternalIDs;
  ordinal: number;
  min_selected: number;
  max_selected: number | null;
  display_flags: {
    omit_section_if_no_available_options: boolean;
    omit_options_if_not_available: boolean;
    use_toggle_if_only_two_options: boolean;
    hidden: boolean;
    empty_display_as: DISPLAY_AS;
    modifier_class: MODIFIER_CLASS;
    template_string: string;
    multiple_item_separator: string;
    non_empty_group_prefix: string;
    non_empty_group_suffix: string;
  };
};
export interface IOption {
  id: string;
  item: ICatalogItem;
  ordinal: number;
  option_type_id: string;
  metadata: {
    flavor_factor: number;
    bake_factor: number;
    can_split: boolean;
  };
  enable_function: string | null;
  display_flags: {
    omit_from_shortname: boolean;
    omit_from_name: boolean;
  };
};

export interface IOptionState {
  placement: OptionPlacement;
  qualifier: OptionQualifier;
}

export interface IWOptionInstance {
  option_id: string;
  placement: keyof typeof OptionPlacement;
  qualifier: keyof typeof OptionQualifier;
};

export interface IOptionInstance extends IOptionState {
  option_id: string;
};
export interface IProductDisplayFlags {
  menu: {
    // ordering within this product instance's category in menu page
    ordinal: number;
    // flag to hide this from the menu
    hide: boolean;
    // governs how prices get displayed in the menu page according to the enum      
    price_display: keyof typeof PriceDisplay;
    // HTML-friendly message wrapping the display of this PI in the menu page
    adornment: string;
    // suppress the default pizza functionality where the full modifier list is surfaced on the product display
    // and instead use the templating strings to determine what is/isn't displayed
    suppress_exhaustive_modifier_list: boolean;
    // show the modifier option list as part of the menu display for this product instance
    show_modifier_options: boolean;
  };
  order: {
    // ordering within this product instance's category in order page
    ordinal: number;
    // flag to hide this from the ordering page
    hide: boolean;
    // flag to skip going right to customization when the user adds this to their order
    skip_customization: boolean;
    // governs how prices get displayed in the order page according to the enum
    price_display: keyof typeof PriceDisplay;
    // HTML-friendly message wrapping the display of this PI in the order page
    adornment: string;
    // suppress the default pizza functionality where the full modifier list is surfaced on the product display
    // and instead use the templating strings to determine what is/isn't displayed
    suppress_exhaustive_modifier_list: boolean;
  };
};

export interface IProduct {
  id: string;
  item?: ICatalogItem;
  price: IMoney;
  disabled: IWInterval | null;
  service_disable: number[];

  display_flags: {
    flavor_max: number;
    bake_max: number;
    bake_differential: number;
    show_name_of_base_product: boolean;
    singular_noun: string;
  };
  timing?: {
    min_prep_time: number;
    additional_unit_prep_time: number;
  };
  modifiers: { mtid: string, enable: string | null }[];
  category_ids: string[];
};

export type ModifiersMap = Record<string, IOptionInstance[]>;

export interface IWModifiersInstance {
  modifier_type_id: string;
  options: IWOptionInstance[];
};
export interface IProductInstance {
  id: string;
  // reference to the WProductSchema ID for this class of item
  product_id: string; //{ type: Schema.Types.ObjectId, ref: 'WProductSchema'},

  // ordinal for product matching
  ordinal: number;

  // applied modifiers for this instance of the product
  modifiers: IWModifiersInstance[];

  // flag to note that this product instance is the "default" form of the product to which all others should be compared
  is_base: boolean;

  display_flags: IProductDisplayFlags,
  item: ICatalogItem;
};

export interface CatalogModifierEntry { options: IOption[]; modifier_type: IOptionType; };
export type ICatalogModifiers = Record<string, CatalogModifierEntry>;
export interface CatalogCategoryEntry { category: ICategory; children: string[]; products: string[]; };
export type ICatalogCategories = Record<string, CatalogCategoryEntry>;
export interface CatalogProductEntry { product: IProduct; instances: IProductInstance[]; };
export type ICatalogProducts = Record<string, CatalogProductEntry>;
export type RecordProductInstanceFunctions = Record<string, IProductInstanceFunction>;
export interface ICatalog {
  modifiers: ICatalogModifiers;
  categories: ICatalogCategories;
  products: ICatalogProducts;
  product_instance_functions: RecordProductInstanceFunctions;
  version: string;
  api: SEMVER;
};

export interface MetadataModifierOptionMapEntry extends IOptionState { enable_left: boolean; enable_right: boolean; enable_whole: boolean };
export interface MetadataModifierMapEntry { has_selectable: boolean, meets_minimum: boolean, options: Record<string, MetadataModifierOptionMapEntry>; };
export type MetadataModifierMap = Record<string, MetadataModifierMapEntry>;
export type MTID_MOID = [string, string];
export interface ModifierDisplayListByLocation { left: MTID_MOID[]; right: MTID_MOID[]; whole: MTID_MOID[]; };
export interface WProductMetadata {
  name: string;
  shortname: string;
  description: string;
  price: number;
  pi: [string, string];
  is_split: boolean;
  incomplete: boolean;
  modifier_map: MetadataModifierMap;
  advanced_option_eligible: boolean;
  advanced_option_selected: boolean;
  additional_modifiers: ModifierDisplayListByLocation;
  exhaustive_modifiers: ModifierDisplayListByLocation;
  bake_count: [number, number];
  flavor_count: [number, number];
}

export interface WCPProduct {
  PRODUCT_CLASS: IProduct;
  modifiers: ModifiersMap;
};

export interface WProduct {
  p: WCPProduct;
  m: WProductMetadata;
}

export interface WCPOption {
  mt: IOptionType;
  mo: IOption;
  index: number;
};

export interface CategoryEntry { menu: IProductInstance[]; children: string[]; menu_name: string; subtitle: string | null, footer: string | null; };
export type MenuCategories = Record<string, CategoryEntry>;
export interface ProductEntry { product: IProduct; base_id: string, instances_list: IProductInstance[]; instances: Record<string, IProductInstance>; };
export type MenuProducts = Record<string, ProductEntry>;
export type MenuProductInstanceMetadata = Record<string, WProductMetadata>;
export interface ModifierEntry { modifier_type: IOptionType; options_list: WCPOption[]; options: Record<string, WCPOption>; };
export type MenuModifiers = Record<string, ModifierEntry>;
export interface IMenu {
  readonly modifiers: MenuModifiers;
  readonly product_classes: MenuProducts;
  readonly categories: MenuCategories;
  readonly product_instance_functions: RecordProductInstanceFunctions;
  readonly product_instance_metadata: MenuProductInstanceMetadata;
  readonly version: string;

};