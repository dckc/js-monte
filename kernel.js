/* @flow */

export type Expression =
    { form: "null" } |
    { form: "true" } |
    { form: "false" } |
    { form: "str", val: string } |
    { form: "double", val: number } |
    { form: "char", val: string } |  // no char type in JS :-/
    { form: "int", val: number }  | // TODO: arbitrary precision int

    { form: "noun", name: string } |
    { form: "binding", name: string } |
    { form: "seq", items: Array<Expression> } |
    { form: "call", target: Expression,
      verb: string, args: Array<Expression> } |
    { form: "def", pat: Pattern, guard: ?Expression, expr: Expression } |
    { form: "escape", ejector: Pattern, escBody: Expression,
      exc: ?Pattern, handler: Expression } |
    { form: "object", doc: ?string, name: ?string,
      as: ?Expression, impl: Array<Expression>, script: Script } |
    { form: "assign", target: string, rvalue: Expression } |
    { form: "finally", finalBody: Expression, finish: Expression } |
    { form: "try", tryBody: Expression,
      exc: Pattern, handler: Expression } |
    { form: "hide", inner: Expression } |
    { form: "if", test: Expression, then: Expression, otherwise: Expression } |
    { form: "meta" } // natures other than context?
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

var aNullExpr : Expression = fix({ form: "null" });
var trueExpr : Expression = fix({ form: "true" });
var falseExpr : Expression = fix({ form: "false" });

export function nullExpr() : Expression {
    return aNullExpr;
}

export function boolExpr(b: bool) : Expression {
    return b ? trueExpr : falseExpr;
}

export function strExpr(s: string): Expression {
	return fix({ form: "str", val: s});
}

export function intExpr(i: number): Expression {
    return fix({ form: "int", val: i });
}
