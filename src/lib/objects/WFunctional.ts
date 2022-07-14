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
        return WFunctional.ProcessConstLiteralStatement(<IConstLiteralExpression>stmt.const_literal);
      case ProductInstanceFunctionType.IfElse:
        return WFunctional.ProcessIfElseStatement(prod, <IIfElseExpression>stmt.if_else);
      case ProductInstanceFunctionType.Logical:
        return WFunctional.ProcessLogicalOperatorStatement(prod, <ILogicalExpression>stmt.logical);
      case ProductInstanceFunctionType.ModifierPlacement:
        return WFunctional.ProcessModifierPlacementExtractionOperatorStatement(prod, <IModifierPlacementExpression>stmt.modifier_placement);
      case ProductInstanceFunctionType.HasAnyOfModifierType:
        return WFunctional.ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod, <IHasAnyOfModifierExpression>stmt.has_any_of_modifier);
      default:
        throw ("bad abstract expression");
    }
    return false;
  }

  static ProcessProductInstanceFunction(prod: WCPProduct, func: IProductInstanceFunction) {
    return WFunctional.ProcessAbstractExpressionStatement(prod, func.expression);
  }

  static AbstractExpressionStatementToString(stmt: IAbstractExpression, mods: ICatalogModifiers): string {
    const logical = () => {
      const logicalExpr = <ILogicalExpression>stmt.logical;
      const operandAString = WFunctional.AbstractExpressionStatementToString(logicalExpr.operandA, mods);
      return logicalExpr.operator === ProductInstanceFunctionOperator.NOT || !logicalExpr.operandB ? `NOT (${operandAString})` : `(${operandAString} ${logicalExpr.operator} ${WFunctional.AbstractExpressionStatementToString(logicalExpr.operandB, mods)})`;
    }
    const modifierPlacement = () => {
      const mps = stmt.modifier_placement as unknown as IModifierPlacementExpression;
      if (!Object.hasOwn(mods, mps.mtid)) {
        return "";
      }
      const val = mods[mps.mtid];
      const opt = val.options.find(x => x.id === mps.moid) as unknown as IOption;
      return `${val.modifier_type.name}.${opt.item.display_name}`;
    }
    switch (stmt.discriminator) {
      case "ConstLiteral":
        return (<IConstLiteralExpression>stmt.const_literal).value;
      case "IfElse":
        return `IF(${WFunctional.AbstractExpressionStatementToString((<IIfElseExpression>stmt.if_else).test, mods)}) { ${WFunctional.AbstractExpressionStatementToString((<IIfElseExpression>stmt.if_else).true_branch, mods)} } ELSE { ${WFunctional.AbstractExpressionStatementToString((<IIfElseExpression>stmt.if_else).false_branch, mods)} }`;
      case "Logical":
        return logical();
      case "ModifierPlacement":
        return modifierPlacement();
      case "HasAnyOfModifierType":
        return `ANY ${mods[(<IHasAnyOfModifierExpression>stmt.has_any_of_modifier).mtid].modifier_type.name}`;
      default:
        throw ("bad abstract expression");
    }
  }

  // TODO: add function to test an AbstractExpression for completeness see https://app.asana.com/0/1184794277483753/1200242818246330
  // maybe this is recursive or just looks at the current level for the UI and requires the caller to recurse the tree, or maybe we provide both
}
