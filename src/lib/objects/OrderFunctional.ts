import { startCase, snakeCase } from "lodash";
import {
  ConstLiteralDiscriminator,
  ICatalog,
  ICatalogModifiers,
  IConstLiteralExpression,
  IIfElseExpression,
  ILogicalExpression,
  OptionPlacement,
  OptionQualifier,
  LogicalFunctionOperator,
  WOrderInstancePartial,
  AbstractOrderExpression,
  OrderInstanceFunctionType,
  OrderInstanceFunction
} from '../types';
import { LogicalFunctionOperatorToHumanString } from "./WFunctional";

export class OrderFunctional {

  // TODO: this can be made generic with the product instance version
  static ProcessIfElseStatement(order: WOrderInstancePartial, stmt: IIfElseExpression<AbstractOrderExpression>, cat: ICatalog) {
    const branch_test = OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.test, cat);
    if (branch_test) {
      return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.true_branch, cat);
    }
    return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.false_branch, cat);
  }

  static ProcessConstLiteralStatement(stmt: IConstLiteralExpression) {
    return stmt.value;
  }

  // TODO: this can be made generic with the product instance version
  static ProcessLogicalOperatorStatement(order: WOrderInstancePartial, stmt: ILogicalExpression<AbstractOrderExpression>, cat: ICatalog): boolean {
    switch (stmt.operator) {
      case LogicalFunctionOperator.AND:
        return Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat)) &&
          Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat));
      case LogicalFunctionOperator.OR:
        return Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat)) ||
          Boolean(OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat));
      case LogicalFunctionOperator.NOT:
        return !OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat);
      case LogicalFunctionOperator.EQ:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat) ===
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat);
      case LogicalFunctionOperator.NE:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat) !==
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat);
      case LogicalFunctionOperator.GT:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat) >
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat);
      case LogicalFunctionOperator.GE:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat) >=
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat);
      case LogicalFunctionOperator.LT:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat) <
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat);
      case LogicalFunctionOperator.LE:
        return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandA, cat) <=
          OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.operandB!, cat);
    }
  }

  static ProcessAbstractOrderExpressionStatement(order: WOrderInstancePartial, stmt: AbstractOrderExpression, cat: ICatalog): string | number | boolean | OptionPlacement {
    switch (stmt.discriminator) {
      case OrderInstanceFunctionType.ConstLiteral:
        return OrderFunctional.ProcessConstLiteralStatement(stmt.expr);
      case OrderInstanceFunctionType.IfElse:
        return OrderFunctional.ProcessIfElseStatement(order, stmt.expr, cat);
      case OrderInstanceFunctionType.Logical:
        return OrderFunctional.ProcessLogicalOperatorStatement(order, stmt.expr, cat);
    }
  }

  static ProcessOrderInstanceFunction(order: WOrderInstancePartial, func: OrderInstanceFunction, cat: ICatalog) {
    return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, func.expression, cat);
  }

  static AbstractOrderExpressionStatementToString(stmt: AbstractOrderExpression, mods: ICatalogModifiers): string {
    function logical(expr: ILogicalExpression<AbstractOrderExpression>) {
      const operandAString = OrderFunctional.AbstractOrderExpressionStatementToString(expr.operandA, mods);
      return expr.operator === LogicalFunctionOperator.NOT || !expr.operandB ? `NOT (${operandAString})` : `(${operandAString} ${expr.operator} ${OrderFunctional.AbstractOrderExpressionStatementToString(expr.operandB, mods)})`;
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
        return `IF(${OrderFunctional.AbstractOrderExpressionStatementToString(stmt.expr.test, mods)}) { ${OrderFunctional.AbstractOrderExpressionStatementToString(stmt.expr.true_branch, mods)} } ELSE { ${OrderFunctional.AbstractOrderExpressionStatementToString(stmt.expr.false_branch, mods)} }`;
      case OrderInstanceFunctionType.Logical:
        return logical(stmt.expr);
    }
  }

  static AbstractOrderExpressionStatementToHumanReadableString(stmt: AbstractOrderExpression, mods: ICatalogModifiers): string {
    function logical(expr: ILogicalExpression<AbstractOrderExpression>) {
      const operandAString = OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(expr.operandA, mods);
      if (expr.operator === LogicalFunctionOperator.NOT || !expr.operandB) {
        return `not ${operandAString}`;
      }
      const operandBString = OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(expr.operandB, mods);
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
        return `if ${OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(stmt.expr.test, mods)} then ${OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(stmt.expr.true_branch, mods)}, otherwise ${OrderFunctional.AbstractOrderExpressionStatementToHumanReadableString(stmt.expr.false_branch, mods)}`;
      case OrderInstanceFunctionType.Logical:
        return logical(stmt.expr);
    }
  }
}
