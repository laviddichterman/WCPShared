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

export interface IWInterval {
  start: number;
  end: number;
};

export enum FulfillmentType {
  PickUp = 'PickUp',
  DineIn = 'DineIn',
  Delivery = 'Delivery',
  Shipping = 'Shipping',
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
  // OrderFunction and value of autogratuity 
  autograt: {
    // autograt refers to OrderInstanceFunction
    function: string;
    percentage: number;
  } | null;
  // serviceCharge refers to OrderInstanceFunction, currently not consumed
  serviceCharge: string | null;
  // minimum time to place an order of this type
  leadTime: number;
  // operating hours for this service type
  operatingHours: OperatingHourSpecification;
  // special hours for this service
  // string in formatISODate format */
  specialHours: DateIntervalsEntries;
  // blocked off times for this service
  // string in formatISODate format */
  blockedOff: DateIntervalsEntries;
  // minimum "length" of the service. Pickup could be over a period of time, or it could be just one moment
  minDuration: number;
  // maximum duration of the service. For time-limited dine-ins this would be the length of their reservation
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

export enum CategoryDisplay {
  'TAB' = 'TAB',
  'TAB_IMMEDIATE' = 'TAB_IMMEDIATE',
  'ACCORDION' = 'ACCORDION',
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
    nesting: CategoryDisplay;
  };
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
  ordinal: number;
  metadata: {
    flavor_factor: number;
    bake_factor: number;
    can_split: boolean;
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
  serviceDisable: string[];
};

export interface IProduct {
  id: string;
  price: IMoney;
  disabled: IWInterval | null;
  serviceDisable: string[];
  externalIDs: KeyValue[];
  displayFlags: {
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

export interface ProductModifierEntry { modifierTypeId: string; options: IOptionInstance[]; };

export interface IProductInstance {
  id: string;
  // reference to the WProductSchema ID for this class of item
  productId: string; //{ type: Schema.Types.ObjectId, ref: 'WProductSchema'},

  // ordinal for product matching
  ordinal: number;

  // applied modifiers for this instance of the product
  modifiers: ProductModifierEntry[];

  // flag to note that this product instance is the "default" form of the product to which all others should be compared
  isBase: boolean;

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
  { enable: DISABLE_REASON.DISABLED_FULFILLMENT_TYPE, fulfillment: string } |
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
  PRODUCT_CLASS: IProduct;
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
  menu: IProductInstance[];
  children: string[];
  menu_name: string;
  subtitle: string | null;
  footer: string | null;
  nesting: CategoryDisplay;
  serviceDisable: string[];
};
export type MenuCategories = Record<string, CategoryEntry>;
export interface ProductEntry { product: IProduct; baseId: string, instances_list: IProductInstance[]; instances: RecordProductInstances; };
export type MenuProducts = Record<string, ProductEntry>;
export type MenuProductInstanceMetadata = Record<string, WProductMetadata>;
export interface ModifierEntry { modifier_type: IOptionType; options_list: WCPOption[]; options: Record<string, WCPOption>; };
export type MenuModifiers = Record<string, ModifierEntry>;
export interface IMenu {
  readonly modifiers: MenuModifiers;
  readonly product_classes: MenuProducts;
  readonly categories: MenuCategories;
  readonly product_instance_metadata: MenuProductInstanceMetadata;
  readonly version: string;
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

export type PurchaseStoreCreditResponse = {
  error: WError[],
  success: true;
  result: PurchaseStoreCreditResponseSuccess;
} | {
  error: WError[],
  success: false;
  result: null;
};

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

export interface JSFECreditV2 {
  readonly validation: ValidateAndLockCreditResponseValid;
  readonly code: string;
  readonly amount_used: IMoney;
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
  //tableId: string | null;
};

export interface FulfillmentDto {
  //status: 'PROPOSED' | 'RESERVED' | 'PREPARED' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  selectedService: string;
  // as formatISODate
  selectedDate: string;
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

// Note: the timeToX should be adjusted by pageLoadTimeLocal to represent a duration
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
}

export enum PaymentMethod {
  Cash = "Cash",
  CreditCard = "CreditCard",
  StoreCredit = "StoreCredit",
  //  External
}

export enum TenderBaseStatus {
  AUTHORIZED = 'AUTHORIZED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED'
}
export interface TenderBase {
  readonly createdAt: number; // millisecond ticks
  readonly status: TenderBaseStatus;
}

export interface PaymentBase extends TenderBase {
  readonly t: PaymentMethod;
  readonly amount: IMoney;
};

export interface StoreCreditPayment extends PaymentBase {
  readonly t: PaymentMethod.StoreCredit;
  readonly payment: {
    readonly code: string;
    readonly lock: EncryptStringLock;
  };
};

export interface CashPayment extends PaymentBase {
  readonly t: PaymentMethod.Cash;
  readonly payment: {
    readonly amountTendered: IMoney;
    readonly change: IMoney;
  };
};

export interface CreditPayment extends PaymentBase {
  readonly t: PaymentMethod.CreditCard;
  readonly payment: {
    readonly processor: "SQUARE";// | "STRIPE";
    readonly processorId: string;
    readonly receiptUrl: string;
    readonly last4: string;
    readonly cardBrand?: string;
    readonly expYear?: string;
    readonly cardholderName?: string;
    readonly billingZip?: string;
  };
};

export interface OrderTax { amount: IMoney; };

export type OrderPayment = CashPayment | CreditPayment | StoreCreditPayment; // ExternalPayment;

export enum DiscountMethod {
  CreditCodeAmount = "CreditCodeAmount"
};

export interface OrderLineDiscountCodeAmount extends TenderBase {
  readonly t: DiscountMethod.CreditCodeAmount;
  readonly discount: {
    readonly amount: IMoney;
    readonly code: string;
    readonly lock: EncryptStringLock;
  };
}

export type OrderLineDiscount = OrderLineDiscountCodeAmount;

export interface WOrderInstancePartial {
  readonly customerInfo: CustomerInfoDto;
  readonly fulfillment: FulfillmentDto;
  readonly cart: CoreCartEntry<WCPProductV2Dto>[];
  readonly metrics: Metrics;
  readonly tip: TipSelection;
  readonly specialInstructions?: string;
};

export type CreateOrderRequestV2 = {
  readonly nonce?: string;
  readonly creditValidations: JSFECreditV2[];
  readonly balance: IMoney;
} & WOrderInstancePartial;


export type WOrderInstance = WOrderInstancePartial & {
  readonly id: string;
  readonly status: 'OPEN' | 'COMPLETED' | 'CANCELED';
  readonly discounts: OrderLineDiscount[];
  readonly payments: OrderPayment[];
  readonly refunds: OrderPayment[];
  readonly taxes: OrderTax[];
  readonly metadata: KeyValue[];
};

export type CategorizedRebuiltCart = Record<string, CoreCartEntry<WProduct>[]>;

export interface CreateOrderResponse {
  readonly success: boolean;
  readonly errors: WError[];
  readonly result: WOrderInstance | null;
};
