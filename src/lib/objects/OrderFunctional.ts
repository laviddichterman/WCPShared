import { startCase, snakeCase } from "lodash";
import {
  ConstLiteralDiscriminator,
  IConstLiteralExpression,
  IIfElseExpression,
  ILogicalExpression,
  OptionPlacement,
  OptionQualifier,
  LogicalFunctionOperator,
  WOrderInstancePartial,
  AbstractOrderExpression,
  OrderInstanceFunctionType,
  OrderInstanceFunction,
  ICatalogModifierSelectors
} from '../types';
import { LogicalFunctionOperatorToHumanString } from "./WFunctional";

export class OrderFunctional {

  // TODO: this can be made generic with the product instance version
  static ProcessIfElseStatement(order: WOrderInstancePartial, stmt: IIfElseExpression<AbstractOrderExpression>, catSelectors: ICatalogModifierSelectors) {
    const branch_test = OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.test, catSelectors);
    if (branch_test) {
      return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.true_branch, catSelectors);
    }
    return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.false_branch, catSelectors);
  }

  static ProcessConstLiteralStatement(stmt: IConstLiteralExpression) {
    return stmt.value;
  }

  // TODO: this can be made generic with the product instance version
  static ProcessLogicalOperatorStatement(order: WOrderInstancePartial, stmt: ILogicalExpression<AbstractOrderExpression>, catSelectors: ICatalogModifierSelectors): boolean {
    switch (stmt.operator) {
      case LogicalFunctionOperator.AND:
        return Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors)) &&
          Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors));
      case LogicalFunctionOperator.OR:
        return Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors)) ||
          Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors));
      case LogicalFunctionOperator.NOT:
        return !OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors);
      case LogicalFunctionOperator.EQ:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors) ===
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors);
      case LogicalFunctionOperator.NE:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors) !==
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors);
      case LogicalFunctionOperator.GT:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors) >
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors);
      case LogicalFunctionOperator.GE:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors) >=
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors);
      case LogicalFunctionOperator.LT:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors) <
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors);
      case LogicalFunctionOperator.LE:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, catSelectors) <=
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, catSelectors);
    }
  }

  static ProcessAbstractOrderExpressionStatement(order: WOrderInstancePartial, stmt: AbstractOrderExpression, catSelectors: ICatalogModifierSelectors): string | number | boolean | OptionPlacement {
    switch (stmt.discriminator) {
      case OrderInstanceFunctionType.ConstLiteral:
        return OrderFunctional.ProcessConstLiteralStatement(stmt.expr);
      case OrderInstanceFunctionType.IfElse:
        return OrderFunctional.ProcessIfElseStatement(order, stmt.expr, catSelectors);
      case OrderInstanceFunctionType.Logical:
        return OrderFunctional.ProcessLogicalOperatorStatement(order, stmt.expr, catSelectors);
    }
  }

  static ProcessOrderInstanceFunction(order: WOrderInstancePartial, func: OrderInstanceFunction, catSelectors: ICatalogModifierSelectors) {
    return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, func.expression, catSelectors);
  }

  static AbstractOrderExpressionStatementToString(stmt: AbstractOrderExpression, catSelectors: ICatalogModifierSelectors): string {
    function logical(expr: ILogicalExpression<AbstractOrderExpression>) {
      const operandAString = OrderFunctional.AbstractOrderExpressionStatementToString(expr.operandA, catSelectors);
      return expr.operator === LogicalFunctionOperator.NOT || !expr.operandB ? `NOT (${operandAString})` : `(${operandAString} ${expr.operator} ${OrderFunctional.AbstractOrderExpressionStatementToString(expr.operandB, catSelectors)})`;
    }
    switch (stmt.discriminator) {
      case OrderInstanceFunctionType.ConstLiteral:
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
      case OrderInstanceFunctionType.IfElse:
        return `IF(${OrderFunctional.AbstractOrderExpressionStatementToString(stmt.expr.test, catSelectors)}) { ${OrderFunctional.AbstractOrderExpressionStatementToString(stmt.expr.true_branch, catSelectors)} } ELSE { ${OrderFunctional.AbstractOrderExpressionStatementToString(stmt.expr.false_branch, catSelectors)} }`;
      case OrderInstanceFunctionType.Logical:
        return logical(stmt.expr);
    }
  }

  static AbstractOrderExpressionStatementToHumanReadableString(stmt: AbstractOrderExpression, catSelectors: ICatalogModifierSelectors): string {
    function logical(expr: ILogicalExpression<AbstractOrderExpression>) {
      const operandAString = OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(expr.operandA, catSelectors);
      if (expr.operator === LogicalFunctionOperator.NOT || !expr.operandB) {
        return `not ${operandAString}`;
      }
      const operandBString = OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(expr.operandB, catSelectors);
      return `${operandAString} ${LogicalFunctionOperatorToHumanString(expr.operator)} ${operandBString}`;
    }
    switch (stmt.discriminator) {
      case OrderInstanceFunctionType.ConstLiteral:
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
      case OrderInstanceFunctionType.IfElse:
        return `if ${OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(stmt.expr.test, catSelectors)} then ${OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(stmt.expr.true_branch, catSelectors)}, otherwise ${OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(stmt.expr.false_branch, catSelectors)}`;
      case OrderInstanceFunctionType.Logical:
        return logical(stmt.expr);
    }
  }
}
