import { GetPlacementFromMIDOID } from "../common";
import { IAbstractExpression, ICatalogModifiers, IConstLiteralExpression, IHasAnyOfModifierExpression, IIfElseExpression, ILogicalExpression, IModifierPlacementExpression, IOption, IProductInstanceFunction, OptionPlacement, ProductInstanceFunctionOperator, ProductInstanceFunctionType, WCPProduct } from '../types';
export class WFunctional {
  static ProcessIfElseStatement(prod: WCPProduct, stmt: IIfElseExpression) {
    const branch_test = WFunctional.ProcessAbstractExpressionStatement(prod, stmt.test);
    if (branch_test) {
      return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.true_branch);
    }
    return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.false_branch);
  }

  static ProcessConstLiteralStatement(stmt: IConstLiteralExpression) {
    return stmt.value;
  }

  static ProcessLogicalOperatorStatement(prod: WCPProduct, stmt: ILogicalExpression): boolean {
    switch (stmt.operator) {
      case ProductInstanceFunctionOperator.AND:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) &&
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      case ProductInstanceFunctionOperator.OR:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) ||
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      case ProductInstanceFunctionOperator.NOT:
        return !WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA);
      case ProductInstanceFunctionOperator.EQ:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) ===
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      case ProductInstanceFunctionOperator.NE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) !==
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      case ProductInstanceFunctionOperator.GT:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) >
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      case ProductInstanceFunctionOperator.GE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) >=
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      case ProductInstanceFunctionOperator.LT:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) <
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      case ProductInstanceFunctionOperator.LE:
        return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.operandA) <=
          WFunctional.ProcessAbstractExpressionStatement(prod, <IAbstractExpression>stmt.operandB);
      default:
        throw ("unmatched logical operator");
    }
    return false;
  }

  static ProcessModifierPlacementExtractionOperatorStatement(prod: WCPProduct, stmt: IModifierPlacementExpression) {
    return GetPlacementFromMIDOID(prod, stmt.mtid, stmt.moid).placement;
  }

  static ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod: WCPProduct, stmt: IHasAnyOfModifierExpression) {
    return Object.hasOwn(prod.modifiers, stmt.mtid) ?
      prod.modifiers[stmt.mtid].filter(x => x.placement !== OptionPlacement.NONE).length > 0 : false;
  }

  static ProcessAbstractExpressionStatement(prod: WCPProduct, stmt: IAbstractExpression): any {
    switch (stmt.discriminator) {
      case ProductInstanceFunctionType.ConstLiteral:
        return WFunctional.ProcessConstLiteralStatement(stmt.expr);
      case ProductInstanceFunctionType.IfElse:
        return WFunctional.ProcessIfElseStatement(prod, stmt.expr);
      case ProductInstanceFunctionType.Logical:
        return WFunctional.ProcessLogicalOperatorStatement(prod, stmt.expr);
      case ProductInstanceFunctionType.ModifierPlacement:
        return WFunctional.ProcessModifierPlacementExtractionOperatorStatement(prod, stmt.expr);
      case ProductInstanceFunctionType.HasAnyOfModifierType:
        return WFunctional.ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod, stmt.expr);
      default:
        throw ("bad abstract expression");
    }
    return false;
  }

  static ProcessProductInstanceFunction(prod: WCPProduct, func: IProductInstanceFunction) {
    return WFunctional.ProcessAbstractExpressionStatement(prod, func.expression);
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
