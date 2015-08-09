/* @flow
*/

import {Expression, Pattern, Script, Method, Matcher,
        nullExpr, boolExpr, intExpr, strExpr} from "./kernel";

type ESExpr =
    { type: 'Literal', value: boolean | number | string } |
    { type: 'Identifier', name: string } |
    { type: 'CallExpression', callee: ESExpr, arguments: Array<ESExpr> } |
    { type: 'MemberExpression', object: ESExpr, property: ESExpr };


export function toESTree(expr: Expression): ESExpr {
    function rt(name: string): ESExpr {
	return {type: 'MemberExpression',
		object: {type: 'Identifier', name: '__monte_runtime'},
		property: {type: 'Identifier', name: name}};
    }

    function lit(val: bool | number | string, wrapper: string): ESExpr {
	return {type: 'CallExpression',
		callee: rt(wrapper),
		arguments: [{type: 'Literal', value: val}]};
    }
    if (expr.is === 'true') {
	return lit(true, 'wrapBool');
    } else if (expr.is === 'false') {
	return lit(false, 'wrapBool');
    } else if (expr.is === 'int') {
	return lit(expr.val, 'wrapInt');
    } else {
	throw new Error('not implemented: ' + expr.is);
    }
}
