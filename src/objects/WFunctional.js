import { GetPlacementFromMIDOID } from "../common";

export class WFunctional {
  static ProcessIfElseStatement(product_instance, stmt) {
    const branch_test = WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.test);
    if (branch_test) {
      return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.true_branch);
    }
    return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.false_branch);
  }

  static ProcessConstLiteralStatement(stmt) {
    return stmt.value;
  }

  static ProcessLogicalOperatorStatement(product_instance, stmt) {
    switch (stmt.operator) {
      case "AND":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) &&
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
      case "OR":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) ||
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
      case "NOT":
        return !WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA);
      case "EQUALS":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) ===
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
      case "GT":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) >
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
      case "GE":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) >=
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
      case "LT":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) <
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
      case "LE":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) <=
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
    }
  }

  static ProcessModifierPlacementExtractionOperatorStatement(product_instance, stmt) {
    return GetPlacementFromMIDOID(product_instance, stmt.mtid, stmt.moid);
  }

  static ProcessAbstractExpressionStatement(product_instance, stmt) {
    switch (stmt.discriminator) {
      case "ConstLiteral":
        return WFunctional.ProcessConstLiteralStatement(stmt.const_literal);
      case "IfElse":
        return WFunctional.ProcessIfElseStatement(product_instance, stmt.if_else);
      case "Logical":
        return WFunctional.ProcessLogicalOperatorStatement(product_instance, stmt.logical);
      case "ModifierPlacement":
        return WFunctional.ProcessModifierPlacementExtractionOperatorStatement(product_instance, stmt.modifier_placement);
    }
  }

  static ProcessProductInstanceFunction(product_instance, func) {
    return WFunctional.ProcessAbstractExpressionStatement(product_instance, func.expression);
  }
}