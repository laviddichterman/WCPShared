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
  WOrderInstance,
  AbstractOrderExpression,
  OrderInstanceFunctionType,
  OrderInstanceFunction
} from '../types';
import { LogicalFunctionOperatorToHumanString } from "./WFunctional";

export class OrderFunctional {
  static ProcessIfElseStatement(order: WOrderInstance, stmt: IIfElseExpression<AbstractOrderExpression>, cat: ICatalog) {
    const branch_test = OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.test, cat);
    if (branch_test) {
      return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.true_branch, cat);
    }
    return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, stmt.false_branch, cat);
  }

  static ProcessIfElseStatementWithTracking(order: WOrderInstance, stmt: IIfElseExpression<AbstractOrderExpression>, cat: ICatalog): [string | number | boolean | OptionPlacement, AbstractOrderExpression[]] {
    const branchTestResult = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.test, cat);
    const branchResult = branchTestResult[0] ?
      OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.true_branch, cat) :
      OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.false_branch, cat);
    return branchResult[0] === true ? branchResult : [false, [<AbstractOrderExpression>{
      discriminator: OrderInstanceFunctionType.Logical,
      expr: {
        operator: LogicalFunctionOperator.AND,
        operandA: branchTestResult[1][0],
        operandB: branchResult[1][0]
      }
    }]];
  }

  static ProcessConstLiteralStatement(stmt: IConstLiteralExpression) {
    return stmt.value;
  }

  static ProcessLogicalOperatorStatement(order: WOrderInstance, stmt: ILogicalExpression<AbstractOrderExpression>, cat: ICatalog): boolean {
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

  static ProcessLogicalOperatorStatementWithTracking(order: WOrderInstance, stmt: ILogicalExpression<AbstractOrderExpression>, cat: ICatalog): [boolean, AbstractOrderExpression[]] {
    switch (stmt.operator) {
      case LogicalFunctionOperator.AND:
        const andResultA = <[boolean, AbstractOrderExpression[]]>OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        if (andResultA[0]) {
          return <[boolean, AbstractOrderExpression[]]>OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        }
        return andResultA;
      case LogicalFunctionOperator.OR:
        const orResultA = <[boolean, AbstractOrderExpression[]]>OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        if (orResultA[0]) {
          return orResultA;
        }
        const orResultB = <[boolean, AbstractOrderExpression[]]>OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        return orResultB[0] == orResultB[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
      case LogicalFunctionOperator.NOT:
        const notResult = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        return !notResult[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
      case LogicalFunctionOperator.EQ:
        const eqResultA = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        const eqResultB = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        return eqResultA[0] == eqResultB[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
      case LogicalFunctionOperator.NE:
        const neqResultA = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        const neqResultB = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        return neqResultA[0] != neqResultB[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
      case LogicalFunctionOperator.GT:
        const gtResultA = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        const gtResultB = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        return gtResultA[0] > gtResultB[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
      case LogicalFunctionOperator.GE:
        const geResultA = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        const geResultB = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        return geResultA[0] >= geResultB[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
      case LogicalFunctionOperator.LT:
        const ltResultA = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        const ltResultB = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        return ltResultA[0] < ltResultB[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
      case LogicalFunctionOperator.LE:
        const leResultA = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandA, cat);
        const leResultB = OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, stmt.operandB!, cat);
        return leResultA[0] <= leResultB[0] ? [true, []] : [false, [<AbstractOrderExpression>{ discriminator: OrderInstanceFunctionType.Logical, expr: stmt }]];
    }
  }

  static ProcessAbstractOrderExpressionStatement(order: WOrderInstance, stmt: AbstractOrderExpression, cat: ICatalog): string | number | boolean | OptionPlacement {
    switch (stmt.discriminator) {
      case OrderInstanceFunctionType.ConstLiteral:
        return OrderFunctional.ProcessConstLiteralStatement(stmt.expr);
      case OrderInstanceFunctionType.IfElse:
        return OrderFunctional.ProcessIfElseStatement(order, stmt.expr, cat);
      case OrderInstanceFunctionType.Logical:
        return OrderFunctional.ProcessLogicalOperatorStatement(order, stmt.expr, cat);
    }
  }

  static ProcessAbstractOrderExpressionStatementWithTracking(order: WOrderInstance, stmt: AbstractOrderExpression, cat: ICatalog): [string | number | boolean | OptionPlacement, AbstractOrderExpression[]] {
    switch (stmt.discriminator) {
      case OrderInstanceFunctionType.ConstLiteral:
        return [OrderFunctional.ProcessConstLiteralStatement(stmt.expr), []];
      case OrderInstanceFunctionType.IfElse:
        return OrderFunctional.ProcessIfElseStatementWithTracking(order, stmt.expr, cat);
      case OrderInstanceFunctionType.Logical:
        return OrderFunctional.ProcessLogicalOperatorStatementWithTracking(order, stmt.expr, cat);
    }
  }

  static ProcessOrderInstanceFunction(order: WOrderInstance, func: OrderInstanceFunction, cat: ICatalog) {
    return OrderFunctional.ProcessAbstractOrderExpressionStatement(order, func.expression, cat);
  }

  static ProcessProductInstanceFunctionWithTracking(order: WOrderInstance, func: OrderInstanceFunction, cat: ICatalog) {
    return OrderFunctional.ProcessAbstractOrderExpressionStatementWithTracking(order, func.expression, cat);
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
