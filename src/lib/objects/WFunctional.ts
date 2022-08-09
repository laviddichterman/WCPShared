import { startCase, snakeCase } from "lodash";
import { GetPlacementFromMIDOID } from "../common";
import {
  ConstLiteralDiscriminator,
  ConstModifierPlacementLiteralExpression,
  IAbstractExpression,
  ICatalog,
  ICatalogModifiers,
  IConstLiteralExpression,
  IHasAnyOfModifierExpression,
  IIfElseExpression,
  ILogicalExpression,
  IModifierPlacementExpression,
  IOption,
  IProductInstanceFunction,
  MetadataField,
  OptionPlacement,
  OptionQualifier,
  ProductInstanceFunctionOperator,
  ProductInstanceFunctionType,
  ProductMetadataExpression,
  PRODUCT_LOCATION,
  WCPProduct
} from '../types';


const ProductInstanceFunctionOperatorToHumanString = function (op: ProductInstanceFunctionOperator) {
  switch (op) {
    case ProductInstanceFunctionOperator.AND: return 'and';
    case ProductInstanceFunctionOperator.EQ: return 'equals';
    case ProductInstanceFunctionOperator.GE: return 'is greater than or equal to';
    case ProductInstanceFunctionOperator.GT: return 'is greater than';
    case ProductInstanceFunctionOperator.LE: return 'is less than or equal to';
    case ProductInstanceFunctionOperator.LT: return 'is less than';
    case ProductInstanceFunctionOperator.NE: return 'does not equal';
    case ProductInstanceFunctionOperator.NOT: return 'is not';
    case ProductInstanceFunctionOperator.OR: return 'or';
  }
}

const ModifierPlacementCompareToPlacementHumanReadable = function (placementExtraction: string, placementLiteral: ConstModifierPlacementLiteralExpression, required: boolean) {
  switch (placementLiteral.value) {
    case OptionPlacement.LEFT: return `${placementExtraction} is ${required ? "not " : ""} on the left`;
    case OptionPlacement.RIGHT: return `${placementExtraction} is ${required ? "not " : ""} on the right`;
    case OptionPlacement.NONE: return `${placementExtraction} is ${required ? "not " : ""} selected`;
    case OptionPlacement.WHOLE: return `${placementExtraction} is ${required ? "" : "not "} selected`;
  }
}

export class WFunctional {
  static ProcessIfElseStatement(prod: WCPProduct, stmt: IIfElseExpression, cat: ICatalog) {
    const branch_test = WFunctional.ProcessAbstractExpressionStatement(prod, stmt.test, cat);
    if (branch_test) {
      return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.true_branch, cat);
    }
    return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.false_branch, cat);
  }

  static ProcessIfElseStatementWithTracking(prod: WCPProduct, stmt: IIfElseExpression, cat: ICatalog): [string | number | boolean | OptionPlacement, IAbstractExpression[]] {
    const branchTestResult = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.test, cat);
    const branchResult = branchTestResult[0] ?
      WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.true_branch, cat) :
      WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.false_branch, cat);
    return branchResult[0] === true ? branchResult : [false, [<IAbstractExpression>{
      discriminator: ProductInstanceFunctionType.Logical,
      expr: {
        operator: ProductInstanceFunctionOperator.AND,
        operandA: branchTestResult[1][0],
        operandB: branchResult[1][0]
      }
    }]];
  }

  static ProcessConstLiteralStatement(stmt: IConstLiteralExpression) {
    return stmt.value;
  }

  static ProcessLogicalOperatorStatement(prod: WCPProduct, stmt: ILogicalExpression, cat: ICatalog): boolean {
    switch (stmt.operator) {
      case ProductInstanceFunctionOperator.AND:
        return Boolean(WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat)) &&
          Boolean(WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat));
      case ProductInstanceFunctionOperator.OR:
        return Boolean(WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat)) ||
          Boolean(WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat));
      case ProductInstanceFunctionOperator.NOT:
        return !WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat);
      case ProductInstanceFunctionOperator.EQ:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) ===
          WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat);
      case ProductInstanceFunctionOperator.NE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) !==
          WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat);
      case ProductInstanceFunctionOperator.GT:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) >
          WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat);
      case ProductInstanceFunctionOperator.GE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) >=
          WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat);
      case ProductInstanceFunctionOperator.LT:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) <
          WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat);
      case ProductInstanceFunctionOperator.LE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) <=
          WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandB!, cat);
    }
  }

  static ProcessLogicalOperatorStatementWithTracking(prod: WCPProduct, stmt: ILogicalExpression, cat: ICatalog): [boolean, IAbstractExpression[]] {
    switch (stmt.operator) {
      case ProductInstanceFunctionOperator.AND:
        const andResultA = <[boolean, IAbstractExpression[]]>WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        if (andResultA[0]) {
          return <[boolean, IAbstractExpression[]]>WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        }
        return andResultA;
      case ProductInstanceFunctionOperator.OR:
        const orResultA = <[boolean, IAbstractExpression[]]>WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        if (orResultA[0]) {
          return orResultA;
        }
        const orResultB = <[boolean, IAbstractExpression[]]>WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        return orResultB[0] == orResultB[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
      case ProductInstanceFunctionOperator.NOT:
        const notResult = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        return !notResult[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
      case ProductInstanceFunctionOperator.EQ:
        const eqResultA = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        const eqResultB = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        return eqResultA[0] == eqResultB[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
      case ProductInstanceFunctionOperator.NE:
        const neqResultA = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        const neqResultB = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        return neqResultA[0] != neqResultB[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
      case ProductInstanceFunctionOperator.GT:
        const gtResultA = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        const gtResultB = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        return gtResultA[0] > gtResultB[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
      case ProductInstanceFunctionOperator.GE:
        const geResultA = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        const geResultB = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        return geResultA[0] >= geResultB[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
      case ProductInstanceFunctionOperator.LT:
        const ltResultA = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        const ltResultB = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        return ltResultA[0] < ltResultB[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
      case ProductInstanceFunctionOperator.LE:
        const leResultA = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandA, cat);
        const leResultB = WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, stmt.operandB!, cat);
        return leResultA[0] <= leResultB[0] ? [true, []] : [false, [<IAbstractExpression>{ discriminator: ProductInstanceFunctionType.Logical, expr: stmt }]];
    }
  }

  static ProcessModifierPlacementExtractionOperatorStatement(prod: WCPProduct, stmt: IModifierPlacementExpression) {
    return GetPlacementFromMIDOID(prod.modifiers, stmt.mtid, stmt.moid).placement;
  }

  static ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod: WCPProduct, stmt: IHasAnyOfModifierExpression) {
    return Object.hasOwn(prod.modifiers, stmt.mtid) ?
      prod.modifiers[stmt.mtid].filter(x => x.placement !== OptionPlacement.NONE).length > 0 : false;
  }

  static ProcessProductMetadataExpression(prod: WCPProduct, stmt: ProductMetadataExpression, cat: ICatalog) {
    return Object.entries(prod.modifiers).reduce((acc, [key, value]) => {
      const catalogModifierType = cat.modifiers[key];
      return (acc + value.reduce((acc2, optInstance) => {
        const option = catalogModifierType.options.find(x => x.id === optInstance.option_id);
        if (!option) {
          console.error(`Unexpectedly missing modifier option ${JSON.stringify(optInstance)}`);
          return acc2;
        }
        const metadataTypeMultiplier = stmt.field === MetadataField.FLAVOR ? option.metadata.flavor_factor : option.metadata.bake_factor;
        switch (stmt.location) {
          case PRODUCT_LOCATION.LEFT:
            return acc2 + (metadataTypeMultiplier * (optInstance.placement === OptionPlacement.LEFT || optInstance.placement === OptionPlacement.WHOLE ? 1 : 0));
          case PRODUCT_LOCATION.RIGHT:
            return acc2 + (metadataTypeMultiplier * (optInstance.placement === OptionPlacement.RIGHT || optInstance.placement === OptionPlacement.WHOLE ? 1 : 0));
        }
      }, 0));
    }, 0)
  }

  static ProcessAbstractExpressionStatement(prod: WCPProduct, stmt: IAbstractExpression, cat: ICatalog): string | number | boolean | OptionPlacement {
    switch (stmt.discriminator) {
      case ProductInstanceFunctionType.ConstLiteral:
        return WFunctional.ProcessConstLiteralStatement(stmt.expr);
      case ProductInstanceFunctionType.IfElse:
        return WFunctional.ProcessIfElseStatement(prod, stmt.expr, cat);
      case ProductInstanceFunctionType.Logical:
        return WFunctional.ProcessLogicalOperatorStatement(prod, stmt.expr, cat);
      case ProductInstanceFunctionType.ModifierPlacement:
        return WFunctional.ProcessModifierPlacementExtractionOperatorStatement(prod, stmt.expr);
      case ProductInstanceFunctionType.HasAnyOfModifierType:
        return WFunctional.ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod, stmt.expr);
      case ProductInstanceFunctionType.ProductMetadata:
        return WFunctional.ProcessProductMetadataExpression(prod, stmt.expr, cat);
    }
  }

  static ProcessAbstractExpressionStatementWithTracking(prod: WCPProduct, stmt: IAbstractExpression, cat: ICatalog): [string | number | boolean | OptionPlacement, IAbstractExpression[]] {
    switch (stmt.discriminator) {
      case ProductInstanceFunctionType.ConstLiteral:
        return [WFunctional.ProcessConstLiteralStatement(stmt.expr), []];
      case ProductInstanceFunctionType.IfElse:
        return WFunctional.ProcessIfElseStatementWithTracking(prod, stmt.expr, cat);
      case ProductInstanceFunctionType.Logical:
        return WFunctional.ProcessLogicalOperatorStatementWithTracking(prod, stmt.expr, cat);
      case ProductInstanceFunctionType.ModifierPlacement:
        return [WFunctional.ProcessModifierPlacementExtractionOperatorStatement(prod, stmt.expr), []];
      case ProductInstanceFunctionType.HasAnyOfModifierType:
        const result = WFunctional.ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod, stmt.expr);
        return [result, result ? [] : [stmt]];
      case ProductInstanceFunctionType.ProductMetadata:
        return [WFunctional.ProcessProductMetadataExpression(prod, stmt.expr, cat), []];
    }
  }

  static ProcessProductInstanceFunction(prod: WCPProduct, func: IProductInstanceFunction, cat: ICatalog) {
    return WFunctional.ProcessAbstractExpressionStatement(prod, func.expression, cat);
  }

  static ProcessProductInstanceFunctionWithTracking(prod: WCPProduct, func: IProductInstanceFunction, cat: ICatalog) {
    return WFunctional.ProcessAbstractExpressionStatementWithTracking(prod, func.expression, cat);
  }

  static AbstractExpressionStatementToString(stmt: IAbstractExpression, mods: ICatalogModifiers): string {
    function logical(expr: ILogicalExpression) {
      const operandAString = WFunctional.AbstractExpressionStatementToString(expr.operandA, mods);
      return expr.operator === ProductInstanceFunctionOperator.NOT || !expr.operandB ? `NOT (${operandAString})` : `(${operandAString} ${expr.operator} ${WFunctional.AbstractExpressionStatementToString(expr.operandB, mods)})`;
    }
    function modifierPlacement(expr: IModifierPlacementExpression) {
      if (!Object.hasOwn(mods, expr.mtid)) {
        return "";
      }
      const val = mods[expr.mtid];
      const opt = val.options.find(x => x.id === expr.moid) as unknown as IOption;
      return `${val.modifier_type.name}.${opt.item.display_name}`;
    }
    switch (stmt.discriminator) {
      case ProductInstanceFunctionType.ConstLiteral:
        switch (stmt.expr.discriminator) {
          case ConstLiteralDiscriminator.BOOLEAN:
            return stmt.expr.value === true ? "True" : "False";
          case ConstLiteralDiscriminator.NUMBER:
            return Number(stmt.expr.value).toString();
          case ConstLiteralDiscriminator.STRING:
            return String(stmt.expr.value);
          case ConstLiteralDiscriminator.MODIFIER_PLACEMENT:
            return String(OptionPlacement[stmt.expr.value]);
          case ConstLiteralDiscriminator.MODIFIER_QUALIFIER:
            return String(OptionQualifier[stmt.expr.value]);
        }
      case ProductInstanceFunctionType.IfElse:
        return `IF(${WFunctional.AbstractExpressionStatementToString(stmt.expr.test, mods)}) { ${WFunctional.AbstractExpressionStatementToString(stmt.expr.true_branch, mods)} } ELSE { ${WFunctional.AbstractExpressionStatementToString(stmt.expr.false_branch, mods)} }`;
      case ProductInstanceFunctionType.Logical:
        return logical(stmt.expr);
      case ProductInstanceFunctionType.ModifierPlacement:
        return modifierPlacement(stmt.expr);
      case ProductInstanceFunctionType.HasAnyOfModifierType:
        return `ANY ${mods[(stmt.expr).mtid].modifier_type.name}`;
      case ProductInstanceFunctionType.ProductMetadata:
        return `:${MetadataField[stmt.expr.field]}@${PRODUCT_LOCATION[stmt.expr.location]}`;
    }
  }

  static AbstractExpressionStatementToHumanReadableString(stmt: IAbstractExpression, mods: ICatalogModifiers): string {
    function logical(expr: ILogicalExpression) {
      const operandAString = WFunctional.AbstractExpressionStatementToHumanReadableString(expr.operandA, mods);
      if (expr.operator === ProductInstanceFunctionOperator.NOT || !expr.operandB) {
        if (expr.operandA.discriminator === ProductInstanceFunctionType.HasAnyOfModifierType) {
          return `no ${mods[expr.operandA.expr.mtid].modifier_type.name} modifiers are selected`
        }
        return `not ${operandAString}`;
      }
      const operandBString = WFunctional.AbstractExpressionStatementToHumanReadableString(expr.operandB, mods);
      if (expr.operandA.discriminator === ProductInstanceFunctionType.ModifierPlacement &&
        expr.operandB.discriminator === ProductInstanceFunctionType.ConstLiteral &&
        expr.operandB.expr.discriminator === ConstLiteralDiscriminator.MODIFIER_PLACEMENT) {
        if (expr.operator === ProductInstanceFunctionOperator.EQ) {
          return ModifierPlacementCompareToPlacementHumanReadable(operandAString, expr.operandB.expr, true);
        } else if (expr.operator === ProductInstanceFunctionOperator.NE) {
          return ModifierPlacementCompareToPlacementHumanReadable(operandAString, expr.operandB.expr, false);
        }
      } else if (expr.operandB.discriminator === ProductInstanceFunctionType.ModifierPlacement &&
        expr.operandA.discriminator === ProductInstanceFunctionType.ConstLiteral &&
        expr.operandA.expr.discriminator === ConstLiteralDiscriminator.MODIFIER_PLACEMENT) {
        if (expr.operator === ProductInstanceFunctionOperator.EQ) {
          return ModifierPlacementCompareToPlacementHumanReadable(operandBString, expr.operandA.expr, true);
        } else if (expr.operator === ProductInstanceFunctionOperator.NE) {
          return ModifierPlacementCompareToPlacementHumanReadable(operandBString, expr.operandA.expr, false);
        }
      }
      return `${operandAString} ${ProductInstanceFunctionOperatorToHumanString(expr.operator)} ${operandBString}`;
    }
    function modifierPlacement(expr: IModifierPlacementExpression) {
      if (!Object.hasOwn(mods, expr.mtid)) {
        return "";
      }
      const val = mods[expr.mtid];
      const opt = val.options.find(x => x.id === expr.moid)!;
      return `${opt.item.display_name}`;
    }
    switch (stmt.discriminator) {
      case ProductInstanceFunctionType.ConstLiteral:
        switch (stmt.expr.discriminator) {
          case ConstLiteralDiscriminator.BOOLEAN:
            return stmt.expr.value === true ? "True" : "False";
          case ConstLiteralDiscriminator.NUMBER:
            return Number(stmt.expr.value).toString();
          case ConstLiteralDiscriminator.STRING:
            return String(stmt.expr.value);
          case ConstLiteralDiscriminator.MODIFIER_PLACEMENT:
            return startCase(snakeCase((OptionPlacement[stmt.expr.value])));
          case ConstLiteralDiscriminator.MODIFIER_QUALIFIER:
            return startCase(snakeCase((OptionQualifier[stmt.expr.value])));
        }
      case ProductInstanceFunctionType.IfElse:
        return `if ${WFunctional.AbstractExpressionStatementToHumanReadableString(stmt.expr.test, mods)} then ${WFunctional.AbstractExpressionStatementToHumanReadableString(stmt.expr.true_branch, mods)}, otherwise ${WFunctional.AbstractExpressionStatementToString(stmt.expr.false_branch, mods)}`;
      case ProductInstanceFunctionType.Logical:
        return logical(stmt.expr);
      case ProductInstanceFunctionType.ModifierPlacement:
        return modifierPlacement(stmt.expr);
      case ProductInstanceFunctionType.HasAnyOfModifierType:
        return `any ${mods[(stmt.expr).mtid].modifier_type.name} modifiers selected`;
      case ProductInstanceFunctionType.ProductMetadata:
        return `:${MetadataField[stmt.expr.field]}@${PRODUCT_LOCATION[stmt.expr.location]}`;
    }
  }

  // TODO: add function to test an AbstractExpression for completeness see https://app.asana.com/0/1184794277483753/1200242818246330
  // maybe this is recursive or just looks at the current level for the UI and requires the caller to recurse the tree, or maybe we provide both
}
