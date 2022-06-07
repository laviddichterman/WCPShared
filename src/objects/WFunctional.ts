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
      default:
        console.error("");
    }
    return 0;
  }

  static ProcessModifierPlacementExtractionOperatorStatement(product_instance, stmt) {
    return GetPlacementFromMIDOID(product_instance, stmt.mtid, stmt.moid);
  }

  static ProcessHasAnyOfModifierTypeExtractionOperatorStatement(product_instance, stmt) {
    return Object.hasOwn(product_instance.modifiers, stmt.mtid) ? 
      product_instance.modifiers[stmt.mtid].filter(x => x[0] !== TOPPING_NONE).length > 0 : false;
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
      default:
        console.error("bad abstract expression");
    }
    return 0;
  }

  static ProcessProductInstanceFunction(product_instance, func) {
    return WFunctional.ProcessAbstractExpressionStatement(product_instance, func.expression);
  }

  static AbstractExpressionStatementToString(stmt, mods) {
    const logical = () => {
      const operandAString = WFunctional.AbstractExpressionStatementToString(stmt.logical.operandA, mods);
      return stmt.logical.operator === "NOT" ? `NOT (${operandAString})` : `(${operandAString} ${stmt.logical.operator} ${WFunctional.AbstractExpressionStatementToString(stmt.logical.operandB, mods)})`;
    }
    switch (stmt.discriminator) {
      case "ConstLiteral":
        return stmt.const_literal.value;
      case "IfElse":
        return `IF(${WFunctional.AbstractExpressionStatementToString(stmt.if_else.test, mods)}) { ${WFunctional.AbstractExpressionStatementToString(stmt.if_else.true_branch, mods)} } ELSE { ${WFunctional.AbstractExpressionStatementToString(stmt.if_else.false_branch, mods)} }`;
      case "Logical":
        return logical();
      case "ModifierPlacement":
        return `${mods[stmt.modifier_placement.mtid].modifier_type.name}.${mods[stmt.modifier_placement.mtid].options.find(x => x._id === stmt.modifier_placement.moid).item.display_name}`;
      case "HasAnyOfModifierType":
        return `ANY ${mods[stmt.has_any_of_modifier.mtid].modifier_type.name}`;
      default:
        console.error("bad abstract expression");
    }
    return 0;
  }

  // TODO: add function to test an AbstractExpression for completeness see https://app.asana.com/0/1184794277483753/1200242818246330
  // maybe this is recursive or just looks at the current level for the UI and requires the caller to recurse the tree, or maybe we provide both
}
