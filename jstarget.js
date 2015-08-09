/* @flow
*/

import {Expression, Pattern, Script, Method, Matcher,
        nullExpr, boolExpr, intExpr, strExpr} from "./kernel";

type ESExpr =
    { type: 'Literal', value: boolean | number | string } |
    { type: 'Identifier', name: string } |
    { type: 'SequenceExpression',
      expressions: Array<ESExpr> } |
    { type: 'AssignmentExpression',
      operator: string, /* TODO: AssignmentOperator */
      left: /* TODO: Pattern | */ ESExpr,
      right: ESExpr } |
    { type: 'CallExpression', callee: ESExpr, arguments: Array<ESExpr> } |
    { type: 'MemberExpression', object: ESExpr, property: ESExpr };

// TODO: return names bound (whether final or va) in expr too.
export function toESTree(expr: Expression): ESExpr {
    function dot(obj: ESExpr, propName: string): ESExpr {
	return {type: 'MemberExpression',
		object: obj,
		property: {type: 'Identifier', name: propName}};
    }

    var rt = {type: 'Identifier', name: '__monte_runtime'};

    function lit(val: bool | number | string, wrapper: string): ESExpr {
	return {type: 'CallExpression',
		callee: dot(rt, wrapper),
		arguments: [{type: 'Literal', value: val}]};
    }

    if (expr.is === 'true') {
	return lit(true, 'wrapBool');
    } else if (expr.is === 'false') {
	return lit(false, 'wrapBool');
    } else if (expr.is === 'int') {
	return lit(expr.val, 'wrapInt');
    } else if (expr.is === 'seq') {
	return {type: 'SequenceExpression',
		expressions: expr.items.map(toESTree)};
    } else if (expr.is === 'noun') {
	return {type: 'Identifier', name: expr.name};
    } else if (expr.is === 'def') {
	var pat = expr.pat;
	if (pat.pt === 'final') {
	    // TODO: pattern guard
	    // TODO: slot guard
	    return {type: 'AssignmentExpression',
		    operator: '=',
		    left: { type: 'Identifier', name: pat.name },
		    right: toESTree(expr.expr) };
	}
	throw new Error('pattern not impl: ' + pat.pt);
    } else if (expr.is === 'call') {
	var args: Array<Expression> = expr.args;
	return { type: 'CallExpression',
		 // TODO: computed member expr for non-identifier verbs
		 callee: dot(toESTree(expr.target), expr.verb),
		 arguments: args.map(toESTree) };
    } else {
	throw new Error('not implemented: ' + expr.is);
    }
}
