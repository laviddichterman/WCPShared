import type { Polygon } from 'geojson';

export type NullablePartial<T,
  NK extends keyof T = { [K in keyof T]: null extends T[K] ? K : never }[keyof T],
  NP = Partial<Pick<T, NK>> & Pick<T, Exclude<keyof T, NK>>
> = { [K in keyof NP]-?: NP[K] | null };

// export type NestedKeyOf<ObjectType extends object> =
//   { [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
//     ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
//     : `${Key}`
//   }[keyof ObjectType & (string | number)];

export type Selector<T> = (id: string) => (T | undefined);
export type SelectIds = () => string[];
export interface EntitySelector<T> {
  selectById: Selector<T>;
  selectIds: SelectIds;
};

export interface SEMVER { major: number; minor: number; patch: number; };

export interface WError {
  category: string;
  code: string;
  detail: string;
};

export interface KeyValue { key: string; value: string; };

export enum DayOfTheWeek {
  SUNDAY,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY
};

/**
 * A version of {@link Interval} that has both start and end resolved to DateType or number.
 */
export interface WNormalizedInterval<DateType extends Date = Date> {
  /** The start of the interval. */
  start: DateType | number;
  /** The end of the interval. */
  end: DateType | number;
}
export interface IWInterval {
  start: number;
  end: number;
};

/**
 * Availability interval.
 * if rrule === "" 
 * then interval represents the start and end time of when the thing is available. 
 * -1 for either start or end means the value is unbounded.
 * if rrule !== "" then ...
 **/
export interface IRecurringInterval {
  interval: IWInterval;
  rrule: string; // empty string means just use the interval
}

export enum FulfillmentType {
  PickUp = 'PickUp',
  DineIn = 'DineIn',
  Delivery = 'Delivery',
  Shipping = 'Shipping',
  ThirdParty = 'ThirdParty'
}

export type OperatingHourSpecification = {
  [DayOfTheWeek.SUNDAY]: IWInterval[];
  [DayOfTheWeek.MONDAY]: IWInterval[];
  [DayOfTheWeek.TUESDAY]: IWInterval[];
  [DayOfTheWeek.WEDNESDAY]: IWInterval[];
  [DayOfTheWeek.THURSDAY]: IWInterval[];
  [DayOfTheWeek.FRIDAY]: IWInterval[];
  [DayOfTheWeek.SATURDAY]: IWInterval[];
};

export type DateIntervalEntry = {
  key: string;
  value: IWInterval[];
};
export type DateIntervalsEntries = DateIntervalEntry[];

export interface FulfillmentConfig {
  id: string;
  // shorthand for the fulfillment
  shortcode: string;
  // flag to indicate this is available for selection by guests
  exposeFulfillment: boolean;
  // the user visible name of the fulfillment
  displayName: string;
  // display order of the fulfillment
  ordinal: number;
  // what "type" of service is this?
  service: FulfillmentType;
  // terms that must be agreed to for this fulfillment
  terms: string[];
  // UI messaging strings
  messages: {
    // description of the fulfillment
    DESCRIPTION: string | null;
    CONFIRMATION: string;
    INSTRUCTIONS: string;
  };
  // menu page categoryId
  menuBaseCategoryId: string;
  // order page categoryId
  orderBaseCategoryId: string;
  // order page supplementary categoryId
  orderSupplementaryCategoryId: string | null;
  // if pre-payment is required
  requirePrepayment: boolean;
  // if pre-payment is allowed
  allowPrepayment: boolean;
  // if any form of tipping or gratuity is allowed
  allowTipping: boolean;
  // OrderFunction and value of autogratuity 
  autograt: {
    // autograt refers to OrderInstanceFunction
    function: string;
    percentage: number;
  } | null;
  // serviceCharge refers to OrderInstanceFunction, currently not consumed
  serviceCharge: string | null;

  // leadTimeOffset time (+ or -) to place an order of this type, in relation to the prep time for the products
  leadTimeOffset: number;

  // minimum time to place an order of this type
  // TODO: remove
  leadTime: number;
  // operating hours for this service type
  operatingHours: OperatingHourSpecification;
  // special hours for this service
  // string in formatISODate format */
  specialHours: DateIntervalsEntries;
  // blocked off times for this service
  // string in formatISODate format */
  blockedOff: DateIntervalsEntries;
  // // relative start time (in minutes) of the fulfillment resource allocation. Could be when the reservation starts or when the delivery window starts relative to the time the order will be ready.
  // relativeStartTime: number;
  // // relative end time (in minutes) of the fulfillment resource allocation. Could be when the reservation ends or when the delivery window ends, relative to the time the order is ready.
  // relativeEndTime: number;
  // DEPRECIATED minimum "length" of the service. Pickup could be over a period of time, or it could be just one moment
  minDuration: number;
  // DEPRECIATED maximum duration of the service. For time-limited dine-ins this would be the length of their reservation
  maxDuration: number;
  // allow service time start selection every {timeStep} minutes
  timeStep: number;
  // maximum party size
  maxGuests?: number;
  // maybe this is a ServiceArea object with data about conditions for validity within a service area.
  // Perhaps it's a list of serviceAreas and their cost
  // definitely deferring that work for now.
  serviceArea?: Polygon;
  // we might need some printer and KDS setting in here too... 
  // maybe split that to another interface and have socketio only surface the public stuff?
};

export interface PostBlockedOffToFulfillmentsRequest {
  fulfillmentIds: string[];
  date: string;
  interval: IWInterval;
};

export type SetLeadTimesRequest = Record<string, number>;

// export interface IPublicStoreConfiguration {
//   SQUARE_LOCATION: string;
//   SQUARE_APPLICATION_ID: string;
//   STORE_NAME: string;
//   STORE_ADDRESS: string;
//   STORE_PHONE_NUMBER: string;
//   DEFAULT_FULFILLMENTID: string;
//   TAX_RATE: number;
//   ALLOW_ADVANCED: boolean;
//   DELIVERY_LINK: string;
//   DELIVERY_FEE: IMoney;
//   ALLOW_TIPPING: boolean;
//   TIP_PREAMBLE: string;
//   AUTOGRAT_THRESHOLD: number;
//   ORDER_RESPONSE_PREAMBLE: string;
//   LOCATION_INFO: string;
//   EMAIL_ADDRESS: string;
//   SPECIAL_REQUEST_MESSAGES: {
//     VEGAN?: string;
//     SLICING?: string;
//     HALF?: string;
//     WELLDONE?: string;
//   }
// };

// export interface IStoreConfiguration {
//   GOOGLE_CLIENTID: string;
//   GOOGLE_CLIENT_SECRET: string;
//   GOOGLE_REFRESH_TOKEN: string;
//   GOOGLE_GEOCODE_KEY: string;
//   SQUARE_TOKEN: string;
//   SQUARE_LOCATION_ALTERNATE: string;
//   SQUARE_LOCATION_3P: string;
//   THIRD_PARTY_FULFILLMENT: string;
//   STORE_CREDIT_SHEET: string;
// };

export type FulfillmentConfigMap = Record<string, FulfillmentConfig>;
export interface IWSettings {
  additional_pizza_lead_time: number;
  config: Record<string, number | string | boolean>;
  // {
  // SQUARE_APPLICATION_ID: String,
  // SQUARE_LOCATION: String,
  // DEFAULT_FULFILLMENTID: String,
  // TIP_PREAMBLE: String,
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
export interface AvailabilityInfoMap {
  // the union of blocked off times for the services specified in computation stored as a list of IWIntervals
  blockedOffUnion: IWInterval[];
  // the union of operating hours for the services specified in computation stored as a list of IWIntervals
  operatingIntervals: IWInterval[];
  // the minutes from current time needed to prepare the order
  leadTime: number;
  // the minimum number of minutes between selectable options for any services specified in computation
  minTimeStep: number;
  specialHoursUnion: IWInterval[] | null;
};

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

export enum OrderInstanceFunctionType {
  'ConstLiteral' = "ConstLiteral",
  'IfElse' = 'IfElse',
  'Logical' = 'Logical'
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
  'SHORTNAME' = 'SHORTNAME',
  'QUANTITY' = 'QUANTITY'
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
  currency: string; // CURRENCY
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

export interface IIfElseExpression<T> {
  true_branch: T;
  false_branch: T;
  test: T;
};

export enum LogicalFunctionOperator {
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

export interface ILogicalExpression<T> {
  operandA: T;
  operandB?: T;
  operator: LogicalFunctionOperator;
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
  expr: IIfElseExpression<IAbstractExpression>;
  discriminator: ProductInstanceFunctionType.IfElse;
};
export type AbstractExpressionLogicalExpression = {
  expr: ILogicalExpression<IAbstractExpression>;
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

export type AbstractOrderExpressionConstLiteral = {
  expr: IConstLiteralExpression;
  discriminator: OrderInstanceFunctionType.ConstLiteral;
};

export type AbstractOrderExpressionIfElseExpression = {
  expr: IIfElseExpression<AbstractOrderExpression>;
  discriminator: OrderInstanceFunctionType.IfElse;
};
export type AbstractOrderExpressionLogicalExpression = {
  expr: ILogicalExpression<AbstractOrderExpression>;
  discriminator: OrderInstanceFunctionType.Logical;
};

export type AbstractOrderExpression = AbstractOrderExpressionConstLiteral |
  AbstractOrderExpressionIfElseExpression |
  AbstractOrderExpressionLogicalExpression;

export interface OrderInstanceFunction {
  id: string;
  expression: AbstractOrderExpression;
  name: string;
};

export interface PrinterGroup {
  id: string;
  name: string;
  singleItemPerTicket: boolean;
  isExpo: boolean;
  externalIDs: KeyValue[];
};

// Note: Display logic might fallback to a different display option depending on live catalog data
export enum CategoryDisplay {
  // The child categories are displayed inline
  'FLAT' = 'FLAT',
  // The children categories are tabs just below the main category title
  'TAB' = 'TAB',
  // The children categories are displayed as expansion panels/accordions immediately below the main category title
  'ACCORDION' = 'ACCORDION',
  // either 0 child categories and many contained products OR no contained products to many child categories
  // child categories have no child categories
  // metadata fields used to populate columns
  // child categories are used as sortable/filterable columns in the table
  'TABLE' = 'TABLE'
};

export interface ICategory {
  id: string;
  name: string;
  description: string | null;
  ordinal: number;
  parent_id: string | null;
  subheading: string | null;
  footnotes: string | null;
  display_flags: {
    call_line_name: string;
    call_line_display: CALL_LINE_DISPLAY;
    // nesting is a bad name, but it's basically how the category display is desired
    nesting: CategoryDisplay;
  };
  // list of disabled fulfillmentIds
  serviceDisable: string[];
};

export interface IOptionType {
  id: string;
  name: string;
  displayName: string;
  externalIDs: KeyValue[];
  ordinal: number;
  min_selected: number;
  max_selected: number | null;
  displayFlags: {
    is3p: boolean;
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
  modifierTypeId: string;
  displayName: string;
  description: string;
  shortcode: string;
  price: IMoney;
  externalIDs: KeyValue[];
  disabled: IWInterval | null;
  availability: IRecurringInterval[];
  ordinal: number;
  metadata: {
    flavor_factor: number;
    bake_factor: number;
    can_split: boolean;
    allowHeavy: boolean;
    allowLite: boolean;
    allowOTS: boolean;
  };
  enable: string | null;
  displayFlags: {
    omit_from_shortname: boolean;
    omit_from_name: boolean;
  };
};

export interface IOptionInstance extends IOptionState {
  optionId: string;
};
export interface IProductDisplayFlags {
  pos: {
    hide: boolean;
    // name override for the point of sale integration (helps avoid selling a growler to a customer since every growler fill shouldn't have the words "growler fill" in the name)
    name: string;
    // flag to skip going right to customization when a server adds this to a guest check
    skip_customization: boolean;
  }
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
    // flag to skip going right to customization when the guest adds this to their order
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
  // list of disabled fulfillmentIds
  serviceDisable: string[];
};

export interface PrepTiming {
  prepTime: number;
  additionalUnitPrepTime: number;
  // additional unit prep times at a given station ID stack
  prepStationId: number;
};

export interface IProduct {
  id: string;
  price: IMoney;
  disabled: IWInterval | null;
  availability: IRecurringInterval[];
  // list of disabled fulfillmentIds
  serviceDisable: string[];
  externalIDs: KeyValue[];
  displayFlags: {
    is3p: boolean;
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
  timing: PrepTiming | null;
  modifiers: IProductModifier[];
  category_ids: string[];
  baseProductId: string;
  printerGroup: string | null;
};

export interface ProductModifierEntry { modifierTypeId: string; options: IOptionInstance[]; };

export interface IProductInstance {
  id: string;
  // reference to the WProductSchema ID for this class of item
  productId: string; //{ type: Schema.Types.ObjectId, ref: 'WProductSchema'},

  // ordinal for product matching
  ordinal: number;

  // applied modifiers for this instance of the product
  modifiers: ProductModifierEntry[];

  displayFlags: IProductDisplayFlags,

  externalIDs: KeyValue[];

  description: string;

  displayName: string;

  shortcode: string;
};

export type RecordModifierOptions = Record<string, IOption>;
export interface CatalogModifierEntry { options: string[]; modifierType: IOptionType; };
export type ICatalogModifiers = Record<string, CatalogModifierEntry>;
export interface CatalogCategoryEntry { category: ICategory; children: string[]; products: string[]; };
export type ICatalogCategories = Record<string, CatalogCategoryEntry>;
export type RecordProductInstances = Record<string, IProductInstance>;
export interface CatalogProductEntry { product: IProduct; instances: string[]; };
export type ICatalogProducts = Record<string, CatalogProductEntry>;
export type RecordProductInstanceFunctions = Record<string, IProductInstanceFunction>;
export type RecordOrderInstanceFunctions = Record<string, OrderInstanceFunction>;
export interface ICatalog {
  options: RecordModifierOptions;
  modifiers: ICatalogModifiers;
  categories: ICatalogCategories;
  products: ICatalogProducts;
  productInstances: RecordProductInstances;
  productInstanceFunctions: RecordProductInstanceFunctions;
  orderInstanceFunctions: RecordOrderInstanceFunctions;
  version: string;
  api: SEMVER;
};

export interface ICatalogModifierSelectors {
  option: Selector<IOption>;
  modifierEntry: Selector<CatalogModifierEntry>;
}

export type ICatalogSelectors = ICatalogModifierSelectors & {
  options: SelectIds;
  modifierEntries: SelectIds;
  category: Selector<CatalogCategoryEntry>;
  categories: SelectIds;
  productInstance: Selector<IProductInstance>;
  productInstances: SelectIds;
  productEntry: Selector<CatalogProductEntry>;
  productEntries: SelectIds;
  productInstanceFunction: Selector<IProductInstanceFunction>;
  productInstanceFunctions: SelectIds;
  orderInstanceFunction: Selector<OrderInstanceFunction>;
  orderInstanceFunctions: SelectIds;
}

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
  DISABLED_FULFILLMENT_TYPE,
  DISABLED_AVAILABILITY
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
  { enable: DISABLE_REASON.DISABLED_FULFILLMENT_TYPE, fulfillment: string } |
  { enable: DISABLE_REASON.DISABLED_FUNCTION, functionId: string } |
  { enable: DISABLE_REASON.DISABLED_AVAILABILITY, availability: IRecurringInterval[] };

export interface MetadataModifierOptionMapEntry extends IOptionState { enable_left: OptionEnableState; enable_right: OptionEnableState; enable_whole: OptionEnableState };
export interface MetadataModifierMapEntry { has_selectable: boolean, meets_minimum: boolean, options: Record<string, MetadataModifierOptionMapEntry>; };
export type MetadataModifierMap = Record<string, MetadataModifierMapEntry>;
export type MTID_MOID = [string, string];
export interface ModifierDisplayListByLocation { left: MTID_MOID[]; right: MTID_MOID[]; whole: MTID_MOID[]; };
export interface WProductMetadata {
  name: string;
  shortname: string;
  description: string;
  price: IMoney;
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
  productId: string;
  modifiers: ProductModifierEntry[];
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

export interface CategoryEntry {
  // in a new version we should be passing the IDs instead of the instances  
  menu: IProductInstance[];
  children: string[];
  menu_name: string;
  subtitle: string | null;
  footer: string | null;
  nesting: CategoryDisplay;
  // list of disabled fulfillmentIds
  serviceDisable: string[];
};

export interface WCPProductV2Dto {
  pid: string;
  modifiers: ProductModifierEntry[];
}

export interface EncryptStringLock {
  readonly enc: string;
  readonly iv: string;
  readonly auth: string;
};

export enum StoreCreditType {
  'MONEY' = 'MONEY',
  'DISCOUNT' = 'DISCOUNT'
};

export interface ValidateAndLockCreditResponseValid {
  readonly valid: true;
  readonly lock: EncryptStringLock;
  readonly amount: IMoney;
  readonly credit_type: StoreCreditType;
};

export type ValidateAndLockCreditResponse = ValidateAndLockCreditResponseValid | {
  readonly valid: false;
};

export interface IssueStoreCreditRequest {
  amount: IMoney;
  addedBy: string;
  reason: string;
  recipientNameFirst: string;
  recipientNameLast: string;
  recipientEmail: string;
  creditType: StoreCreditType;
  expiration: string | null;
};

export type PurchaseStoreCreditRequest = Omit<IssueStoreCreditRequest, 'creditType' | 'reason' | 'expiration'> & {
  sendEmailToRecipient: boolean;
  senderName: string;
  senderEmail: string;
  recipientMessage: string;
};

export interface PurchaseStoreCreditResponseSuccess {
  referenceId: string;
  code: string;
  squareOrderId: string;
  amount: IMoney;
  last4: string;
  receiptUrl: string;
};
export interface ResponseSuccess<T> {
  success: true;
  result: T;
}
export interface ResponseFailure {
  success: false;
  error: WError[],
}

export type PurchaseStoreCreditResponse = ResponseSuccess<PurchaseStoreCreditResponseSuccess> | ResponseFailure;

export interface ValidateLockAndSpendRequest {
  readonly code: string;
  readonly amount: IMoney;
  readonly lock: EncryptStringLock;
  readonly updatedBy: string;
}

export interface ValidateLockAndSpendSuccess {
  success: true;
  entry: any[];
  index: number;
};

export interface SpendCreditResponseSuccess {
  readonly success: true;
  readonly balance: IMoney;
};
export type SpendCreditResponse = SpendCreditResponseSuccess | { success: false };

export interface TipSelectionPercentage {
  value: number;
  isSuggestion: boolean;
  isPercentage: true;
};
export interface TipSelectionAmount {
  value: IMoney;
  isSuggestion: boolean;
  isPercentage: false;
};
export type TipSelection = TipSelectionPercentage | TipSelectionAmount;

export interface DeliveryAddressValidateRequest {
  fulfillmentId: string;
  address: string;
  zipcode: string;
  city: string;
  state: string;
}

export interface AddressComponent {
  readonly types: Array<string>;
  readonly long_name: string;
  readonly short_name: string;
};

export interface DeliveryAddressValidateResponse {
  readonly validated_address: string;
  readonly in_area: boolean;
  readonly found: boolean;
  readonly address_components: Array<AddressComponent>;
};

export interface DeliveryInfoDto {
  address: string;
  address2: string;
  zipcode: string;
  deliveryInstructions: string;
  validation: DeliveryAddressValidateResponse | null;
};

export interface SeatingSection {
  id: string;
  name: string;
};

export enum SeatingShape {
  RECTANGLE = "RECTANGLE",
  ELLIPSE = "ELLIPSE"
}

export interface SeatingResource {
  id: string;
  name: string;
  // capacity is a soft limit, it indicates the typical or recommended number of guests for this resource
  // the number of seats at this resource, not a hard limit
  capacity: number;
  shape: SeatingShape;
  sectionId: string;
  center: { x: number; y: number; };
  // shapeDims is either radius in x and y direction for ellipses or half the x length and y length for rectangles, pre-rotation 
  shapeDims: { x: number; y: number; };
  rotation: number; // degrees
  // we can't delete seating resources, just disable them
  disabled: boolean;
};

export enum WSeatingStatus {
  "PENDING" = "PENDING", // seating not yet confirmed
  "ASSIGNED" = "ASSIGNED", // seating has been assigned by a human
  "WAITING_ARRIVAL" = "WAITING_ARRIVAL", // waiting for guests to arrive
  "SEATED_WAITING" = "SEATED_WAITING", // some guests are seated, some guests still pending arrival
  "SEATED" = "SEATED", // all guests have arrived and are seated
  "WAITING_FOR_CHECK" = "WAITING_FOR_CHECK", // guests are waiting for the check
  "PAID" = "PAID", // guests have paid the check
  "COMPLETED" = "COMPLETED", // guests have left the table
}

export interface WSeatingInfo {
  tableId: [string]; // list of seating resources assigned to this order
  status: WSeatingStatus;
  mtime: number; // modification time
};

export interface DineInInfoDto {
  partySize: number;
  seating?: WSeatingInfo;
};

export interface ThirdPartyInfo {
  squareId: string;
  source: string;
};

export interface FulfillmentTime {
  // as formatISODate
  selectedDate: string;
  selectedTime: number;
}

export enum WFulfillmentStatus {
  'PROPOSED' = 'PROPOSED', // initial state of a new fulfillment
  'SENT' = 'SENT', // fulfillment has been sent to the fulfiller, this could be a KDS or a printer
  'CONFIRMED' = 'CONFIRMED', // confirmed by fulfiller
  'PROCESSING' = 'PROCESSING', // fulfillment has been started
  'COMPLETED' = 'COMPLETED', // fulfillment has been completed
  'CANCELED' = 'CANCELED' // fulfillment has been canceled
};

export interface FulfillmentDto extends FulfillmentTime {
  status: WFulfillmentStatus;
  selectedService: string;
  dineInInfo?: DineInInfoDto;
  deliveryInfo?: DeliveryInfoDto;
  thirdPartyInfo?: ThirdPartyInfo;
}

export interface CustomerInfoDto {
  givenName: string;
  familyName: string;
  mobileNum: string;
  email: string;
  referral: string;
}

export interface ItemWithQuantity<T> {
  quantity: number;
  product: T;
}

export interface CoreCartEntry<T> extends ItemWithQuantity<T> {
  categoryId: string;
};

// TODO: change CartEntry from WProduct to WCPProduct and derive the metadata via a selector
export interface CartEntry extends CoreCartEntry<WProduct> {
  id: string;
  isLocked: boolean;
};

// Note: the timeToX should be adjusted by pageLoadTimeLocal to represent a duration
// todo: perhaps change this to UxMetrics?
export interface Metrics {
  // parsed from ISO string of the server time given during page load
  pageLoadTime: number;
  // number of times the user got pushed to a new time
  numTimeBumps: number;
  // times the tip was adjusted
  numTipAdjusts: number;
  // times the tip got reset due to being under minimum
  numTipFixed: number;
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
  ipAddress?: string;
}

export enum PaymentMethod {
  Cash = "Cash",
  CreditCard = "CreditCard",
  StoreCredit = "StoreCredit",
  //  External
}

export enum TenderBaseStatus {
  PROPOSED = 'PROPOSED',
  AUTHORIZED = 'AUTHORIZED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED'
}

export type TenderBaseAllocatedStatus = Exclude<TenderBaseStatus, TenderBaseStatus.PROPOSED>;

export type TenderBaseProposed = {
  readonly createdAt: number; // millisecond ticks
  readonly status: TenderBaseStatus.PROPOSED;
}

export type TenderBaseAllocated = {
  readonly createdAt: number; // millisecond ticks
  readonly status: TenderBaseAllocatedStatus;
}
export type TenderBase = TenderBaseAllocated | TenderBaseProposed;

export type PaymentBasePartial = {
  readonly t: PaymentMethod;
  readonly amount: IMoney;
  // the tipAmount below is PART OF the amount field above
  readonly tipAmount: IMoney;
}

type PaymentBaseProposed = PaymentBasePartial & TenderBaseProposed;
type PaymentBaseAllocated = PaymentBasePartial & TenderBaseAllocated & {
  readonly processorId: string;
};

interface StoreCreditPaymentPartial extends PaymentBasePartial {
  readonly t: PaymentMethod.StoreCredit;
  readonly payment: {
    readonly code: string;
    // the balance available at time of locking
    readonly balance: IMoney;
    readonly lock: EncryptStringLock;
  };
};

export type StoreCreditPaymentProposed = PaymentBaseProposed & StoreCreditPaymentPartial;
export type StoreCreditPaymentAllocated = PaymentBaseAllocated & StoreCreditPaymentPartial;

export type StoreCreditPayment = StoreCreditPaymentProposed | StoreCreditPaymentAllocated;

interface CashPaymentPartial extends PaymentBasePartial {
  readonly t: PaymentMethod.Cash;
  readonly payment: {
    readonly amountTendered: IMoney;
    readonly change: IMoney;
  };
}

export type CashPaymentProposed = CashPaymentPartial & PaymentBaseProposed;
export type CashPaymentAllocated = CashPaymentPartial & PaymentBaseAllocated;
export type CashPayment = CashPaymentAllocated | CashPaymentProposed;

export type CreditPaymentProposed = PaymentBaseProposed & {
  readonly t: PaymentMethod.CreditCard;
  readonly payment: {
    sourceId: string;
  }
};

export type CreditPaymentAllocated = PaymentBaseAllocated & {
  readonly processorId: string;
  readonly t: PaymentMethod.CreditCard;
  readonly payment: {
    readonly processor: "SQUARE";
    readonly receiptUrl: string;
    readonly last4: string;
    readonly cardBrand?: string;
    readonly expYear?: string;
    readonly cardholderName?: string;
    readonly billingZip?: string;
  };
};

export type CreditPayment = CreditPaymentProposed | CreditPaymentAllocated;

export interface OrderTax { amount: IMoney; };

export type OrderPaymentProposed = CashPaymentProposed | CreditPaymentProposed | StoreCreditPaymentProposed;
export type OrderPaymentAllocated = CashPaymentAllocated | CreditPaymentAllocated | StoreCreditPaymentAllocated;
export type OrderPayment = CashPayment | CreditPayment | StoreCreditPayment; // ExternalPayment;

export type UnresolvedPayment = (Omit<StoreCreditPayment, 'amount' | 'tipAmount'> | Omit<CreditPayment, 'amount' | 'tipAmount'> | (Omit<CashPayment, 'amount' | 'tipAmount' | 'payment'> & { payment: Omit<CashPayment['payment'], 'change'> }));

export enum DiscountMethod {
  CreditCodeAmount = 'CreditCodeAmount',
  ManualPercentage = 'ManualPercentage',
  ManualAmount = 'ManualAmount'
};

export type OrderManualPercentDiscount = TenderBaseAllocated & {
  readonly t: DiscountMethod.ManualPercentage;
  readonly discount: {
    readonly reason: string;
    readonly percentage: number;
    // whatever the amount is computed to be
    readonly amount: IMoney;
    // maybe add restrictions or pricing rules somehow?
  }
}
export type OrderManualAmountDiscount = TenderBaseAllocated & {
  readonly t: DiscountMethod.ManualAmount;
  readonly discount: {
    readonly reason: string;
    readonly amount: IMoney;
    // the total amount this manual discount is good for
    readonly balance: IMoney;
    // maybe add restrictions or pricing rules somehow?
  }
}

export type OrderLineDiscountCodeAmount = TenderBaseAllocated & {
  readonly t: DiscountMethod.CreditCodeAmount;
  readonly discount: {
    readonly amount: IMoney;
    // the balance available at time of locking
    readonly balance: IMoney;
    readonly code: string;
    readonly lock: EncryptStringLock;
  };
}

export type OrderLineDiscount = OrderLineDiscountCodeAmount | OrderManualAmountDiscount | OrderManualPercentDiscount;

export type UnresolvedDiscount = (Omit<OrderLineDiscountCodeAmount, "discount"> & { discount: Omit<OrderLineDiscountCodeAmount['discount'], 'amount'> }) | (Omit<OrderManualPercentDiscount, "discount"> & { discount: Omit<OrderManualPercentDiscount['discount'], 'amount'> }) | (Omit<OrderManualAmountDiscount, "discount"> & { discount: Omit<OrderManualAmountDiscount['discount'], 'amount'> });

export interface WOrderInstancePartial {
  readonly customerInfo: CustomerInfoDto;
  readonly fulfillment: FulfillmentDto;
  readonly cart: CoreCartEntry<WCPProductV2Dto>[];
  readonly metrics?: Metrics;
  readonly tip: TipSelection;
  readonly specialInstructions?: string;
};

export type CreateOrderRequestV2 = {
  // keep these fields differently named (with the word proposed) so we don't get lazy and accidentally accept a cash payment here
  readonly proposedPayments: (CreditPaymentProposed | StoreCreditPaymentProposed)[]
  readonly proposedDiscounts: OrderLineDiscountCodeAmount[];
} & WOrderInstancePartial;

export enum WOrderStatus {
  'OPEN' = 'OPEN', // order submitted to WARIO, yet to be manually confirmed by staff
  'CONFIRMED' = 'CONFIRMED', // confirmed by staff, not yet charged
  'PROCESSING' = 'PROCESSING', // order has been started, is active
  'COMPLETED' = 'COMPLETED', // order has been completed, fulfilled, and charged
  'CANCELED' = 'CANCELED' // order has been canceled and refunded
};

export interface WOrderInstance extends WOrderInstancePartial {
  readonly id: string;
  readonly status: WOrderStatus;
  // NOTE: discounts are APPLIED IN THE ORDER LISTED, the order should be determined by the business logic
  readonly discounts: OrderLineDiscount[];
  readonly payments: OrderPaymentAllocated[];
  readonly refunds: OrderPaymentAllocated[];
  readonly taxes: OrderTax[];
  // metadata is for storing state in 3p applications
  readonly metadata: KeyValue[];
  // null means not locked, string identifies the lock holder
  readonly locked: string | null;
};

export type CategorizedRebuiltCart = Record<string, CoreCartEntry<WProduct>[]>;

export type CrudOrderResponse = ResponseSuccess<WOrderInstance> | ResponseFailure;

export type ResponseWithStatusCode<T> = T & { status: number; };

export interface RecomputeTotalsResult {
  mainCategoryProductCount: number;
  cartSubtotal: IMoney;
  serviceFee: IMoney;
  subtotalPreDiscount: IMoney;
  subtotalAfterDiscount: IMoney;
  discountApplied: OrderLineDiscount[];
  taxAmount: IMoney;
  tipBasis: IMoney;
  tipMinimum: IMoney;
  tipAmount: IMoney;
  serviceChargeAmount: IMoney;
  total: IMoney;
  paymentsApplied: OrderPayment[];
  balanceAfterPayments: IMoney;
  hasBankersRoundingTaxSkew: boolean;
}

// UpsertProductBatch types
export type CreateIProduct = Omit<IProduct, 'id' | 'baseProductId'>; // CompleteProductWithoutIDs
export type UpdateIProduct = (Pick<IProduct, 'id'> & Partial<Omit<IProduct, 'id'>>); // PartialProductWithIDs
// aka CompleteProductInstanceWithoutIDsOrPartialProductInstanceWithIDs
export type CreateIProductInstance = Omit<IProductInstance, 'id' | 'productId'>;
export type UpdateIProductUpdateIProductInstance = Pick<IProductInstance, 'id'> & Partial<Omit<IProductInstance, 'id' | 'productId'>>;
export type CreateProductBatch = { product: CreateIProduct; instances: CreateIProductInstance[] };
export type UpdateProductBatch = { product: UpdateIProduct; instances: (CreateIProductInstance | UpdateIProductUpdateIProductInstance)[] };
export type UpsertProductBatch = (CreateProductBatch | UpdateProductBatch);
// end UpsertProductBatch types