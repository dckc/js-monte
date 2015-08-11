/* @flow
*/

import {Expression, Pattern, Script, Method, Matcher,
        nullExpr, boolExpr, intExpr, strExpr} from "./kernel";

type ESExpr =
    { type: "ObjectExpression",
      properties: Array<Property> } |
    { type: "FunctionExpression",
      id: ?ESPattern,
      params: Array<ESPattern>, defaults: Array<ESExpr>,
      body: Statement,
      generator: boolean, "expression": boolean } |
    { type: 'Literal', value: ?(boolean | number | string) } |
    { type: 'Identifier', name: string } |
    { type: 'SequenceExpression',
      expressions: Array<ESExpr> } |
    { type: 'AssignmentExpression',
      operator: string, /* TODO: AssignmentOperator */
      left: /* TODO: Pattern | */ ESExpr,
      right: ESExpr } |
    { type: 'CallExpression', callee: ESExpr, arguments: Array<ESExpr> } |
    { type: 'MemberExpression', object: ESExpr, property: ESExpr };

type Property = { "type": "Property",
                  "key": ESExpr,
                  "computed": boolean,
                  "value": ESExpr };

type Statement =
    { type: "BlockStatement", body: Array<Statement> } |
    { type: "ReturnStatement", argument: ?ESExpr };

type ESPattern =
    { type: "Identifier", name: string };

// TODO: return names bound (whether final or va) in expr too.
export function toESTree(expr: Expression): ESExpr {
    trace('toESTree', expr);
    trace('toESTree', expr.form);

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

    if (expr.form === 'true') {
	return lit(true, 'wrapBool');
    } else if (expr.form === 'false') {
	return lit(false, 'wrapBool');
    } else if (expr.form === 'int') {
	return lit(expr.val, 'wrapInt');
    } else if (expr.form === 'str') {
	return lit(expr.val, 'wrapStr');
    } else if (expr.form === 'seq') {
	return {type: 'SequenceExpression',
		expressions: expr.items.map(toESTree)};
    } else if (expr.form === 'noun') {
	return {type: 'Identifier', name: expr.name};
    } else if (expr.form === 'def') {
	var pat = expr.pat;
	if (pat.type === 'final') {
	    // TODO: pattern guard
	    // TODO: slot guard
	    return {type: 'AssignmentExpression',
		    operator: '=',
		    left: { type: 'Identifier', name: pat.name },
		    right: toESTree(expr.expr) };
	}
	throw new Error('pattern not impl: ' + pat.type);
    } else if (expr.form === 'call') {
	var args: Array<Expression> = expr.args;
	return { type: 'CallExpression',
		 // TODO: computed member expr for non-identifier verbs
		 callee: dot(toESTree(expr.target), expr.verb),
		 arguments: args.map(toESTree) };
    } else if (expr.form === 'object') {
	return convertObject(expr.doc, expr.name,
			     expr.as, expr.impl, expr.script);
    } else if (expr.form === 'escape') {
	limitation('escape: no escape exception', expr.exc === null);
	limitation('escape: final ejector', expr.ejector.type === 'final');
	// TODO: real escape support
	return toESTree(expr.escBody);
    } else {
	throw new Error('not implemented: ' + expr.form);
    }
}

function convertObject(doc: ?string, name, as, impl, script: Script): ESExpr {
    limitation('null doc', doc === null);
    limitation('null as', as === null);
    limitation('0 impls', impl.length === 0);
    limitation('null extends', script.ext === null);
    limitation('0 matchers', script.matchers.length === 0);

    function convertMethod(m: Method): Property {
	limitation('null doc', m.doc === null);
	limitation('null guard', m.guard === null);
	return { "type": "Property",
                 "key": {
                     "type": "Identifier",
                     "name": m.verb
                 },
                 "computed": false,
                 "value": lambda(m.params, m.body) };
    }

    return { "type": "ObjectExpression",
             "properties": script.methods.map(convertMethod) };
}

function lambda(params: Array<Pattern>, body: Expression): ESExpr {
    function convertPattern(p: Pattern): ESPattern {
	if (p.type === 'final') {
	    return { type: 'Identifier', name: p.name };
	} else {
	    limitation('final patterns only', p.type === 'final')
	    throw ""
	}
    }

    return {
        "type": "FunctionExpression",
        "id": null,
        "params": params.map(convertPattern),
        "defaults": [],
        "body": {
            "type": "BlockStatement",
            "body": [
                {
                    "type": "ReturnStatement",
                    "argument": toESTree(body)
                }
            ]
        },
        "generator": false,
        "expression": false
    }
}

function limitation(label, ok) {
    if (!ok) {
	throw new Error(label);
    }
}

function trace<T>(label, x: T): T {
    var tracing = true;

    if (tracing) {
	console.log(label, x);
    }
    return x;
}
