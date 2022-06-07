import { GetPlacementFromMIDOID, TOPPING_NONE } from "../common";
import { WCPProduct, IConstLiteralExpression, IIfElseExpression, ProductInstanceFunctionOperator, ILogicalExpression, IAbstractExpression, IProductInstanceFunction, ICatalogModifiers, IModifierPlacementExpression, IHasAnyOfModifierExpression } from '../types';
export class WFunctional {
  static ProcessIfElseStatement(prod : WCPProduct, stmt : IIfElseExpression) {
    const branch_test = WFunctional.ProcessAbstractExpressionStatement(prod, stmt.test);
    if (branch_test) {
      return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.true_branch);
    }
    return WFunctional.ProcessAbstractExpressionStatement(prod, stmt.false_branch);
  }

  static ProcessConstLiteralStatement(stmt : IConstLiteralExpression) {
    return stmt.value;
  }

  static ProcessLogicalOperatorStatement(prod: WCPProduct, stmt : ILogicalExpression) : boolean {
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
        console.error("");
    }
    return false;
  }

  static ProcessModifierPlacementExtractionOperatorStatement(prod : WCPProduct, stmt : IModifierPlacementExpression) {
    return GetPlacementFromMIDOID(prod, stmt.mtid, stmt.moid);
  }

  static ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod : WCPProduct, stmt : IHasAnyOfModifierExpression) {
    return Object.hasOwn(prod.modifiers, stmt.mtid) ? 
      prod.modifiers[stmt.mtid].filter(x => x[0] !== TOPPING_NONE).length > 0 : false;
  }

  static ProcessAbstractExpressionStatement(prod : WCPProduct, stmt : IAbstractExpression) : any {
    switch (stmt.discriminator) {
      case "ConstLiteral":
        return WFunctional.ProcessConstLiteralStatement(<IConstLiteralExpression>stmt.const_literal);
      case "IfElse":
        return WFunctional.ProcessIfElseStatement(prod, <IIfElseExpression>stmt.if_else);
      case "Logical":
        return WFunctional.ProcessLogicalOperatorStatement(prod, <ILogicalExpression>stmt.logical);
      case "ModifierPlacement":
        return WFunctional.ProcessModifierPlacementExtractionOperatorStatement(prod, <IModifierPlacementExpression>stmt.modifier_placement);
      case "HasAnyOfModifierType":
        return WFunctional.ProcessHasAnyOfModifierTypeExtractionOperatorStatement(prod, <IHasAnyOfModifierExpression>stmt.has_any_of_modifier);        
      default:
        console.error("bad abstract expression");
    }
    return false;
  }

  static ProcessProductInstanceFunction(prod : WCPProduct, func : IProductInstanceFunction) {
    return WFunctional.ProcessAbstractExpressionStatement(prod, func.expression);
  }

  static AbstractExpressionStatementToString(stmt : IAbstractExpression, mods : ICatalogModifiers ) : string {
    const logical = () => {
      const logicalExpr = <ILogicalExpression>stmt.logical;
      const operandAString = WFunctional.AbstractExpressionStatementToString(logicalExpr.operandA, mods);
      return logicalExpr.operator === ProductInstanceFunctionOperator.NOT || !logicalExpr.operandB ? `NOT (${operandAString})` : `(${operandAString} ${logicalExpr.operator} ${WFunctional.AbstractExpressionStatementToString(logicalExpr.operandB, mods)})`;
    }
    const modifierPlacement = () => {
      if (!stmt.modifier_placement || !Object.hasOwn(mods, stmt.modifier_placement.mtid)) {
        return "";
      }
      const modPlacementExpr = stmt.modifier_placement;
      return `${mods[modPlacementExpr.mtid].modifier_type.name}.${mods[modPlacementExpr.mtid].options.find(x => x._id == modPlacementExpr.moid).item.display_name}`;
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
        console.error("bad abstract expression");
    }
    return "";
  }

  // TODO: add function to test an AbstractExpression for completeness see https://app.asana.com/0/1184794277483753/1200242818246330
  // maybe this is recursive or just looks at the current level for the UI and requires the caller to recurse the tree, or maybe we provide both
}
