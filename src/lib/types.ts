import type { CreatePaymentResponse } from 'square';
import type { Polygon } from 'geojson';

export type NullablePartial<T,
  NK extends keyof T = { [K in keyof T]: null extends T[K] ? K : never }[keyof T],
  NP = Partial<Pick<T, NK>> & Pick<T, Exclude<keyof T, NK>>
  > = { [K in keyof NP]-?: NP[K] | null };

export interface SEMVER { major: number; minor: number; patch: number; };

export enum DayOfTheWeek {
  SUNDAY,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY
};

export interface IWInterval {
  start: number;
  end: number;
};

export enum FulfillmentType {
  PICKUP,
  DINEIN,
  DELIVERY,
  SHIPPING,
}

export interface FulfillmentConfig {
  id: string;
  service: FulfillmentType;
  terms: string[];
  // autograt function is a to-be-defined type reference
  autograt: boolean | string;
  // serviceCharge function is a to-be-defined type reference, same as autograt function
  serviceCharge: number | string;
  leadTime: number;
  operatingHours: Record<DayOfTheWeek, IntervalTupleList>;
  specialHours: Record<string /* in yyyyMMdd format */, IntervalTupleList>;
  blockedOff: IWInterval[];
  minDuration: number;
  maxDuration: number;
  timeStep: number;
  maxGuests?: number;
  // maybe this is a ServiceArea object with data about conditions for validity within a service area.
  // definitely deferring that work for now.
  serviceArea?: Polygon;
};

export type WIntervalTuple = [number, number];
export type IntervalTupleList = WIntervalTuple[];
export type OperatingHoursList = [IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList, IntervalTupleList];
export interface ServicesEnableMap { [index: number]: boolean };
export interface IWSettings {
  additional_pizza_lead_time: number;
  time_step: number[];
  pipeline_info: {
    baking_pipeline: { slots: Number, time: Number }[];
    transfer_padding: number;
  };
  operating_hours: OperatingHoursList[];
  config: Record<string, number | string | boolean>;
  // {
  // SQUARE_APPLICATION_ID: String,
  // SQUARE_LOCATION: String,
  // MENU_CATID: String,
  // MAIN_CATID: String,
  // SUPP_CATID: String,
  // TAX_RATE: Number,
  // ALLOW_ADVANCED: Boolean,
  // MAX_PARTY_SIZE: Number,
  // DELIVERY_LINK: String,
  // DELIVERY_FEE: Number,
  // AUTOGRAT_THRESHOLD: Number,
  // MESSAGE_REQUEST_VEGAN: String,
  // MESSAGE_REQUEST_HALF: String,
  // MESSAGE_REQUEST_WELLDONE: String,
  // MESSAGE_REQUEST_SLICING: String
  // };
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
  'HasAnyOfModifierType' = 'HasAnyOfModifierType',
  'ProductMetadata' = 'ProductMetadata'
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

export interface IOptionState {
  placement: OptionPlacement;
  qualifier: OptionQualifier;
}

export interface IMoney {
  amount: number;
  currency: CURRENCY;
};

export enum ConstLiteralDiscriminator {
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  STRING = "STRING",
  MODIFIER_PLACEMENT = "MODIFIER_PLACEMENT",
  MODIFIER_QUALIFIER = "MODIFIER_QUALIFIER"
};

export enum MetadataField { 'FLAVOR', 'WEIGHT' };

export type ConstStringLiteralExpression = {
  discriminator: ConstLiteralDiscriminator.STRING;
  value: string;
};
export type ConstNumberLiteralExpression = {
  discriminator: ConstLiteralDiscriminator.NUMBER;
  value: number;
}
export type ConstBooleanLiteralExpression = {
  discriminator: ConstLiteralDiscriminator.BOOLEAN;
  value: boolean;
}
export type ConstModifierPlacementLiteralExpression = {
  discriminator: ConstLiteralDiscriminator.MODIFIER_PLACEMENT;
  value: OptionPlacement;
};
export type ConstModifierQualifierLiteralExpression = {
  discriminator: ConstLiteralDiscriminator.MODIFIER_QUALIFIER;
  value: OptionQualifier;
};

export type IConstLiteralExpression =
  ConstStringLiteralExpression |
  ConstNumberLiteralExpression |
  ConstBooleanLiteralExpression |
  ConstModifierPlacementLiteralExpression |
  ConstModifierQualifierLiteralExpression;

export interface IIfElseExpression {
  true_branch: IAbstractExpression;
  false_branch: IAbstractExpression;
  test: IAbstractExpression;
};

export enum ProductInstanceFunctionOperator {
  'AND' = "AND",
  'OR' = "OR",
  'NOT' = "NOT",
  'EQ' = "EQ",
  'NE' = "NE",
  'GT' = "GT",
  'GE' = "GE",
  'LT' = "LT",
  'LE' = "LE"
};

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

export interface ProductMetadataExpression {
  field: MetadataField;
  location: PRODUCT_LOCATION;
};

export type AbstractExpressionConstLiteral = {
  expr: IConstLiteralExpression;
  discriminator: ProductInstanceFunctionType.ConstLiteral;
};
export type AbstractExpressionProductMetadata = {
  expr: ProductMetadataExpression;
  discriminator: ProductInstanceFunctionType.ProductMetadata;
};
export type AbstractExpressionIfElseExpression = {
  expr: IIfElseExpression;
  discriminator: ProductInstanceFunctionType.IfElse;
};
export type AbstractExpressionLogicalExpression = {
  expr: ILogicalExpression;
  discriminator: ProductInstanceFunctionType.Logical;
};
export type AbstractExpressionModifierPlacementExpression = {
  expr: IModifierPlacementExpression;
  discriminator: ProductInstanceFunctionType.ModifierPlacement;
};
export type AbstractExpressionHasAnyOfModifierExpression = {
  expr: IHasAnyOfModifierExpression;
  discriminator: ProductInstanceFunctionType.HasAnyOfModifierType;
};

export type IAbstractExpression = AbstractExpressionConstLiteral |
  AbstractExpressionProductMetadata |
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

export interface IProductModifier {
  mtid: string;
  enable: string | null;
  service_disable: number[];
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
    // order guide is product instance functions that return a string if they should surface a warning or suggestion to the end user
    order_guide: {
      warnings: string[];
      suggestions: string[];
    }
  };
  timing?: {
    min_prep_time: number;
    additional_unit_prep_time: number;
  };
  modifiers: IProductModifier[];
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

export enum DISABLE_REASON {
  ENABLED = 0,
  DISABLED_BLANKET,
  DISABLED_TIME,
  DISABLED_WEIGHT,
  DISABLED_FLAVORS,
  DISABLED_MAXIMUM,
  DISABLED_FUNCTION,
  DISABLED_NO_SPLITTING,
  DISABLED_SPLIT_DIFFERENTIAL,
  DISABLED_FULFILLMENT_TYPE
};
export type OptionEnableState =
  { enable: DISABLE_REASON.ENABLED } |
  { enable: DISABLE_REASON.DISABLED_BLANKET } |
  { enable: DISABLE_REASON.DISABLED_TIME, interval: IWInterval } |
  { enable: DISABLE_REASON.DISABLED_WEIGHT } |
  { enable: DISABLE_REASON.DISABLED_FLAVORS } |
  { enable: DISABLE_REASON.DISABLED_NO_SPLITTING } |
  { enable: DISABLE_REASON.DISABLED_SPLIT_DIFFERENTIAL } |
  { enable: DISABLE_REASON.DISABLED_MAXIMUM } |
  { enable: DISABLE_REASON.DISABLED_FULFILLMENT_TYPE, fulfillment: number } |
  { enable: DISABLE_REASON.DISABLED_FUNCTION, functionId: string };

export interface MetadataModifierOptionMapEntry extends IOptionState { enable_left: OptionEnableState; enable_right: OptionEnableState; enable_whole: OptionEnableState };
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

export interface WCPProductJsFeDto {
  pid: string;
  modifiers: { [index: string]: [OptionPlacement, string][] };
};

export interface WCPProductV2Dto {
  pid: string;
  modifiers: ModifiersMap;
}

// Mapping from CategoryID to tuple of quantity and product type T
export type CartDto<T> = Record<string, [number, T][]>;

export interface EncryptStringLock {
  enc: string;
  iv: string;
  auth: string;
};

export type ValidateAndLockCreditResponse = {
  valid: true;
  lock: EncryptStringLock;
  amount: number;
  credit_type: "MONEY" | "DISCOUNT"
} | {
  valid: false;
  lock: null;
  amount: 0;
  credit_type: "MONEY"
};

export interface ValidateLockAndSpendRequest {
  code: string;
  amount: number;
  lock: EncryptStringLock;
  updatedBy: string;
}

export type SpendCreditResponse = {
  success: true;
  balance: number;
} | { success: false };

export interface TipSelection {
  value: number;
  isSuggestion: boolean;
  isPercentage: boolean;
};

export interface DeliveryAddressValidateRequest {
  address: string;
  zipcode: string;
  city: string;
  state: string;
}

export interface AddressComponent {
  types: Array<string>;
  long_name: string;
  short_name: string;
};

export interface DeliveryAddressValidateResponse {
  validated_address: string;
  in_area: boolean;
  found: boolean;
  address_components: Array<AddressComponent>;
};

export interface ValidateDeliveryResponseV1 {
  validated_delivery_address: string;
  address1: string;
  address2: string;
  instructions: string;
};

export interface TotalsV2 {
  tip: number;
  balance: number;
}

export interface JSFECreditV2 {
  validation: ValidateAndLockCreditResponse;
  code: string;
  amount_used: number;
};

export interface CreateOrderResponse {
  success: boolean;
  result: CreatePaymentResponse | null;
};

export interface DeliveryInfoDto {
  address: string;
  address2: string;
  zipcode: string;
  deliveryInstructions: string;
  validation: DeliveryAddressValidateResponse | null;
};

export interface DineInInfoDto {
  partySize: number;
};

export interface FulfillmentDto {
  selectedService: number;
  selectedDate: number;
  selectedTime: number;
  dineInInfo: DineInInfoDto | null;
  deliveryInfo: DeliveryInfoDto | null;
}

export interface CustomerInfoDto {
  givenName: string;
  familyName: string;
  mobileNum: string;
  email: string;
  referral: string;
}

export interface CoreCartEntry<T> {
  categoryId: string;
  quantity: number;
  product: T;
};

export interface CartEntry extends CoreCartEntry<WProduct> {
  id: string;
  isLocked: boolean;
};

export interface MetricsDto {
  // the server time of page load
  pageLoadTime: number;
  // the Date.now() on load
  pageLoadTimeLocal: number;
  // max of difference between current time and load time and the previous value of this and the time we think it's been since we last updated it
  roughTicksSinceLoad: number;
  // number of times the user got pushed to a new time
  numTimeBumps: number;
  // current time, or the last time we checked the validity of our availability
  currentTime: number;
  // time to first product added to cart
  timeToFirstProduct: number;
  // time of selecting a service date
  timeToServiceDate: number;
  // time of selecting a service time
  timeToServiceTime: number;
  // completion time for various stages
  timeToStage: number[];
  // time when the user hit submit to send the order
  submitTime: number;
  useragent: string;
}

export interface CreateOrderRequestV2 {
  nonce?: string;
  customerInfo: CustomerInfoDto;
  fulfillmentDto: FulfillmentDto;
  sliced: boolean;
  cart: CoreCartEntry<WCPProductV2Dto>[];
  special_instructions: string;
  totals: TotalsV2;
  store_credit: JSFECreditV2 | null;
  metrics: MetricsDto;
};

export type CategorizedRebuiltCart = Record<string, CoreCartEntry<WProduct>[]>;