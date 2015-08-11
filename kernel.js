/* @flow */

export type Expression =
    { is: "null" } |
    { is: "true" } |
    { is: "false" } |
    { is: "str", val: string } |
    { is: "double", val: number } |
    { is: "char", val: string } |  // no char type in JS :-/
    { is: "int", val: number }  | // TODO: arbitrary precision int

    { is: "noun", name: string } |
    { is: "binding", name: string } |
    { is: "seq", items: Array<Expression> } |
    { is: "call", target: Expression, verb: string, args: Array<Expression> } |
    { is: "def", pat: Pattern, guard: ?Expression, expr: Expression } |
    { is: "escape", ejector: Pattern, escBody: Expression,
      exc: ?Pattern, handler: Expression } |
    { is: "object", doc: ?string, name: ?string,
      as: ?Expression, impl: Array<Expression>, script: Script } |
    { is: "assign", target: string, rvalue: Expression } |
    { is: "finally", finalBody: Expression, finish: Expression } |
    { is: "try", tryBody: Expression,
      exc: Pattern, handler: Expression } |
    { is: "hide", inner: Expression } |
    { is: "if", test: Expression, then: Expression, otherwise: Expression } |
    { is: "meta" } // natures other than context?
;

export type Script = { ext: ?Expression,
		       methods: Array<Method>,
		       matchers: Array<Matcher> };
export type Method = { doc: ?string,
		       verb: string,
		       params: Array<Pattern>,
		       guard: ?Expression,
		       body: Expression };
export type Matcher = { pattern: Pattern, body: Expression };

export type Pattern =
    { pt: "final", name: string, guard: ?Expression } |
    { pt: "ignore", guard: ?Expression } |
    { pt: "var", name: string, guard: ?Expression } |
    { pt: "list", items: Array<Pattern>, tail: ?Pattern } |
    { pt: "via", view: Expression, inner: Pattern } |
    { pt: "binding", noun: string }
;

function fix<T>(x: T): T {
    return Object.freeze(x);
}

var aNullExpr : Expression = fix({ is: "null" });
var trueExpr : Expression = fix({ is: "true" });
var falseExpr : Expression = fix({ is: "false" });

export function nullExpr() : Expression {
    return aNullExpr;
}

export function boolExpr(b: bool) : Expression {
    return b ? trueExpr : falseExpr;
}

export function strExpr(s: string): Expression {
	return fix({ is: "str", val: s});
}

export function intExpr(i: number): Expression {
    return fix({ is: "int", val: i });
}
