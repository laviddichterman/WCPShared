import { GetPlacementFromMIDOID, TOPPING_NONE } from "../common";

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
      case "EQ":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) ===
          WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandB);
      case "NE":
        return WFunctional.ProcessAbstractExpressionStatement(product_instance, stmt.operandA) !==
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

  static ProcessHasAnyOfModifierTypeExtractionOperatorStatement(product_instance, stmt) {
    return product_instance.modifiers.hasOwnProperty(stmt.mtid) ? 
      pi.modifiers[stmt.mtid].filter(function (x) { return x[0] !== TOPPING_NONE }).length > 0 : false;
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
      case "HasAnyOfModifierType":
        return WFunctional.ProcessHasAnyOfModifierTypeExtractionOperatorStatement(product_instance, stmt.has_any_of_modifier);        
    }
  }

  static ProcessProductInstanceFunction(product_instance, func) {
    return WFunctional.ProcessAbstractExpressionStatement(product_instance, func.expression);
  }

  static AbstractExpressionStatementToString(stmt, mods) {
    switch (stmt.discriminator) {
      case "ConstLiteral":
        return stmt.const_literal.value;
      case "IfElse":
        return `IF(${WFunctional.AbstractExpressionStatementToString(stmt.if_else.test, mods)}) { ${WFunctional.AbstractExpressionStatementToString(stmt.if_else.true_branch, mods)} } ELSE { ${WFunctional.AbstractExpressionStatementToString(stmt.if_else.false_branch, mods)} }`;
      case "Logical":
        return `${WFunctional.AbstractExpressionStatementToString(stmt.logical.operandA, mods)} ${stmt.logical.operator} ${WFunctional.AbstractExpressionStatementToString(stmt.logical.operandB, mods)}`;
      case "ModifierPlacement":
        return `${mods[stmt.modifier_placement.mtid].modifier_type.name}.${mods[stmt.modifier_placement.mtid].options.find(x => x._id === stmt.modifier_placement.moid).item.display_name}`;
      case "HasAnyOfModifierType":
        return `ANY ${mods[stmt.has_any_of_modifier.mtid].modifier_type.name}`;
    }
  }
}