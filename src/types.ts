export enum DISPLAY_AS {
  OMIT = 'OMIT',
  YOUR_CHOICE_OF = 'YOUR_CHOICE_OF', 
  LIST_CHOICES = 'LIST_CHOICES'
};

export enum MODIFIER_MATCH { NO_MATCH, AT_LEAST, EXACT_MATCH };

export enum MODIFIER_LOCATION { LEFT, RIGHT };

export enum PriceDisplay { 
  'FROM_X', 
  'VARIES',
  'ALWAYS', 
  'MIN_TO_MAX', 
  'LIST' 
};

export enum ProductInstanceFunctionType { 'ConstLiteral', 'IfElse', 'Logical', 'ModifierPlacement', 'HasAnyOfModifierType' };

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
  'SHORTCODE', 'SHORTNAME'
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

export interface IDisabled { 
  start: number;
  end: number;
};

export interface ICategory {
  _id: string;
  name: string;
  description?: string,
  ordinal: number;
  parent_id?: string;
  subheading?: string,
  footnotes?: string,
  display_flags: {
    call_line_name: string;
    call_line_display: keyof typeof CALL_LINE_DISPLAY;
  };
};

export interface ICatalogItem {
    display_name?: string;
    description?: string;
    shortcode?: string;
    price: IMoney;
    externalIDs?: IExternalIDs;
    disabled?: IDisabled;
    permanent_disable?: boolean;
};

export interface IOptionType {
  _id: string;
  name: string;
  display_name: string;
  externalIDs?: IExternalIDs;
  ordinal: number;
  min_selected: number;
  max_selected: number;
  display_flags: {
    omit_section_if_no_available_options: boolean;
    omit_options_if_not_available: boolean;
    use_toggle_if_only_two_options: boolean;
    hidden: boolean;
    empty_display_as: keyof typeof DISPLAY_AS;
    modifier_class: keyof typeof MODIFIER_CLASS;
    template_string: string;
    multiple_item_separator: string;
    non_empty_group_prefix: string;
    non_empty_group_suffix: string;
  };
};
export interface IOption {
  _id: string;
  item: ICatalogItem;
  catalog_item?: ICatalogItem;
  ordinal: number;
  option_type_id: string; //{ type: Schema.Types.ObjectId, ref: 'WOptionTypeSchema', required: true }, 
  metadata: {
    flavor_factor: number;
    bake_factor: number;
    can_split: boolean;
  };
  enable_function?: string;// { type: Schema.Types.ObjectId, ref: 'WProductInstanceFunction', autopopulate: true },
  display_flags: {
    omit_from_shortname: boolean;
    omit_from_name: boolean;
  };
};

export interface IOptionInstance {
  option_id: string;
  placement: keyof typeof OptionPlacement;
  qualifier?: keyof typeof OptionQualifier;
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
  _id: string;
  item?: ICatalogItem;
  price: IMoney;
  disabled?: IDisabled;
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
  modifiers: { mtid: string, enable?: string }[];
  category_ids: string[];
};

export interface ModifiersMap { [index:string] : IOptionInstance[] };

export interface IProductInstance {
  _id: string;
  // reference to the WProductSchema ID for this class of item
  product_id: string; //{ type: Schema.Types.ObjectId, ref: 'WProductSchema'},

  // ordinal for product matching
  ordinal: number;

  // applied modifiers for this instance of the product
  modifiers: { 
    modifier_type_id: string;
    options: IOptionInstance[];
  }[];
  
  // flag to note that this product instance is the "default" form of the product to which all others should be compared
  is_base: boolean;

  display_flags: IProductDisplayFlags,
  item?: ICatalogItem;
};

export interface IConstLiteralExpression {
  value: any;
};
export interface IIfElseExpression {
  true_branch: IAbstractExpression;
  false_branch: IAbstractExpression;
  test: IAbstractExpression;
};

export enum ProductInstanceFunctionOperator { 'AND', 'OR', 'NOT', 'EQ', 'NE', 'GT', 'GE', 'LT', 'LE' };

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

export interface IAbstractExpression {
  const_literal?: IConstLiteralExpression;
  if_else?: IIfElseExpression;
  logical?: ILogicalExpression;
  modifier_placement?: IModifierPlacementExpression;
  has_any_of_modifier?: IHasAnyOfModifierExpression;
  discriminator: keyof typeof ProductInstanceFunctionType;
};

export interface IProductInstanceFunction {
  expression: IAbstractExpression;
  name: string;
};

export interface ICatalogModifiers { [index:string]: { options: IOption[]; modifier_type: IOptionType; }; };
export interface ICatalogCategories { [index:string]: { category: ICategory; children: string[]; products: string[]; }; };
export interface ICatalogProducts { [index:string]: { product: IProduct, instances: IProductInstance[] }};
export interface ICatalog {
  modifiers: ICatalogModifiers;
  categories: ICatalogCategories;
  products: ICatalogProducts;
  product_instance_functions: IProductInstanceFunction[]
  version: string;
  apiver: {major: number; minor: number; patch: number;};
};

export interface WProductMetadata { 
  processed_name: string;
  processed_description: string;
  base_product_instance_id: string;
  exhaustive_options : any;
  is_split: boolean;
}

export interface WCPProduct { 
  PRODUCT_CLASS: IProduct;
  piid: string;
  name: string;
  description: string;
  modifiers: ModifiersMap;
  ordinal: number;
  is_base: boolean;
  shortcode: string;
  display_flags: IProductDisplayFlags;
  base_product_piid: string;
};

export interface WCPOption {
  mt: IOptionType;
  mo: IOption;
  index: number;
};

export interface CategoryEntry { menu: WCPProduct[]; children: string[]; menu_name: string; subtitle: string | null };
export interface MenuCategories { [index:string]: CategoryEntry };
export interface ProductEntry { product: IProduct; instances_list: WCPProduct[]; instances: { [index:string]: WCPProduct}};
export interface MenuProducts {[index:string] : ProductEntry};
export interface ModifierEntry {modifier_type: IOptionType; options_list: WCPOption[]; options: {[index:string]: WCPOption}};
export interface MenuModifiers { [index:string]: ModifierEntry};
export interface IMenu { 
  modifiers: MenuModifiers;
  product_classes: MenuProducts;
  categories: MenuCategories;
  version: string;
};