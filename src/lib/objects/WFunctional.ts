import { GetPlacementFromMIDOID } from "../common";
import { IAbstractExpression, ICatalog, ICatalogModifiers, IConstLiteralExpression, IHasAnyOfModifierExpression, IIfElseExpression, ILogicalExpression, IModifierPlacementExpression, IOption, IProductInstanceFunction, MetadataField, OptionPlacement, ProductInstanceFunctionOperator, ProductInstanceFunctionType, ProductMetadataExpression, PRODUCT_LOCATION, WCPProduct } from '../types';
export class WFunctional {
  static ProcessIfElseStatement(prod: WCPProduct, stmt: IIfElseExpression, cat: ICatalog) {
    const branch_test = WFunctional.ProcessAbstractExpressionStatement(prod, stmt.test, cat);
    if (branch_test) {
      return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.true_branch, cat);
    }
    return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.false_branch, cat);
  }

  static ProcessConstLiteralStatement(stmt: IConstLiteralExpression) {
    return stmt.value;
  }

  static ProcessLogicalOperatorStatement(prod: WCPProduct, stmt: ILogicalExpression, cat: ICatalog): boolean {
    switch (stmt.operator) {
      case ProductInstanceFunctionOperator.AND:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) &&
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
      case ProductInstanceFunctionOperator.OR:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) ||
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
      case ProductInstanceFunctionOperator.NOT:
        return !WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat);
      case ProductInstanceFunctionOperator.EQ:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) ===
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
      case ProductInstanceFunctionOperator.NE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) !==
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
      case ProductInstanceFunctionOperator.GT:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) >
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
      case ProductInstanceFunctionOperator.GE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) >=
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
      case ProductInstanceFunctionOperator.LT:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) <
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
      case ProductInstanceFunctionOperator.LE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA, cat) <=
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB, cat);
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

  static ProcessAbstractExpressionStatement(prod: WCPProduct, stmt: IAbstractExpression, cat: ICatalog): any {
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
      default:
        throw ("bad abstract expression");
    }
  }

  static ProcessProductInstanceFunction(prod: WCPProduct, func: IProductInstanceFunction, cat: ICatalog) {
    return WFunctional.ProcessAbstractExpressionStatement(prod, func.expression, cat);
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
        return String(stmt.expr.value);
      case ProductInstanceFunctionType.IfElse:
        return `IF(${WFunctional.AbstractExpressionStatementToString(stmt.expr.test, mods)}) { ${WFunctional.AbstractExpressionStatementToString(stmt.expr.true_branch, mods)} } ELSE { ${WFunctional.AbstractExpressionStatementToString(stmt.expr.false_branch, mods)} }`;
      case ProductInstanceFunctionType.Logical:
        return logical(stmt.expr);
      case ProductInstanceFunctionType.ModifierPlacement:
        return modifierPlacement(stmt.expr);
      case ProductInstanceFunctionType.HasAnyOfModifierType:
        return `ANY ${mods[(stmt.expr).mtid].modifier_type.name}`;
      default:
        throw ("bad abstract expression");
    }
  }

  // TODO: add function to test an AbstractExpression for completeness see https://app.asana.com/0/1184794277483753/1200242818246330
  // maybe this is recursive or just looks at the current level for the UI and requires the caller to recurse the tree, or maybe we provide both
}
