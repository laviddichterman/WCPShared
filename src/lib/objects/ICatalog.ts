
// Returns [ category_map, product_map ] list;
// category_map entries are mapping of catagory_id to { category, children (id list), product (id list) }
// product_map is mapping from productId to { product, instances (list of instance objects)}

import { ReduceArrayToMapByKey } from "../common";
import type { ICatalog, SEMVER, ICatalogModifiers, ICatalogCategories, ICategory, IProduct, IProductInstance, RecordOrderInstanceFunctions, RecordProductInstanceFunctions, ICatalogProducts, IOptionType, IOption, ICatalogSelectors } from "../types";

// orphan_products is list of orphan product ids
const CatalogMapGenerator = (categories: ICategory[], products: IProduct[], product_instances: IProductInstance[]): [ICatalogCategories, ICatalogProducts] => {
  const category_map: ICatalogCategories = categories.reduce((acc, cat) => ({ ...acc, [cat.id]: { category: cat, children: [], products: [] } }), {});
  categories.forEach((curr) => {
    if (curr.parent_id) {
      if (category_map[curr.parent_id]) {
        category_map[curr.parent_id].children.push(curr.id);
      }
      else {
        console.error(`Missing category ID ${curr.parent_id} specified by ${JSON.stringify(curr)}`);
      }
    }
  });
  const product_map: ICatalogProducts = products.reduce((acc, p) => {
    if (p.category_ids.length !== 0) {
      p.category_ids.forEach((cid) => {
        category_map[cid] ? category_map[cid].products.push(p.id) : console.error(`Missing category ID: ${cid} in product: ${JSON.stringify(p)}`);
      });
    }
    return { ...acc, [p.id]: { product: p, instances: [] } };
  }, {});
  product_instances.forEach((curr) => {
    product_map[curr.productId].instances.push(curr.id);
  })
  return [category_map, product_map];
};

const ModifierTypeMapGenerator = (modifier_types: IOptionType[], options: IOption[]) => {
  const modifier_types_map = modifier_types.reduce((acc, m) => ({ ...acc, [m.id]: { options: [], modifierType: m } }), {} as ICatalogModifiers);
  options.forEach(o => {
    if (Object.hasOwn(modifier_types_map, o.modifierTypeId)) {
      modifier_types_map[o.modifierTypeId].options.push(o.id);
    }
    else {
      console.error(`Modifier Type ID ${o.modifierTypeId} referenced by ModifierOption ${o.id} not found!`);
    }
  });
  return modifier_types_map;
};

export const CatalogGenerator = (
  categories: ICategory[],
  modifier_types: IOptionType[],
  options: IOption[],
  products: IProduct[],
  product_instances: IProductInstance[],
  productInstanceFunctions: RecordProductInstanceFunctions,
  orderInstanceFunctions: RecordOrderInstanceFunctions,
  api: SEMVER): ICatalog => {
  const modifier_types_map = ModifierTypeMapGenerator(modifier_types, options);
  const [category_map, product_map] = CatalogMapGenerator(categories, products, product_instances);
  return {
    options: ReduceArrayToMapByKey(options, 'id'),
    productInstances: ReduceArrayToMapByKey(product_instances, 'id'),
    modifiers: modifier_types_map,
    categories: category_map,
    products: product_map,
    productInstanceFunctions: { ...productInstanceFunctions },
    orderInstanceFunctions: { ...orderInstanceFunctions },
    api,
    version: Date.now().toString(36).toUpperCase(),
  };
}

export const ICatalogSelectorWrapper = (catalog: ICatalog): ICatalogSelectors => ({
  categories: () => Object.keys(catalog.categories),
  category: (id) => catalog.categories[id],
  modifierEntries: () => Object.keys(catalog.modifiers),
  modifierEntry: (id) => catalog.modifiers[id],
  option: (id) => catalog.options[id],
  options: () => Object.keys(catalog.options),
  productEntry: (id) => catalog.products[id],
  productEntries: () => Object.keys(catalog.products),
  productInstance: (id) => catalog.productInstances[id],
  productInstances: () => Object.keys(catalog.productInstances),
  productInstanceFunction: (id) => catalog.productInstanceFunctions[id],
  productInstanceFunctions: () => Object.keys(catalog.productInstanceFunctions),
  orderInstanceFunction: (id) => catalog.orderInstanceFunctions[id],
  orderInstanceFunctions: () => Object.keys(catalog.orderInstanceFunctions)
})
