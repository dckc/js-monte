/* @flow
*/

import * as mt from "./kernel";
import * as es from "./estree";

// TODO: return names bound (whether final or va) in expr too.
export function toESTree(expr: mt.Expression): es.Expression {
    trace('toESTree', expr);
    trace('toESTree', expr.form);

    var rt = {type: 'Identifier', name: '__monte_runtime'};

    function lit(val: bool | number | string, wrapper: string): es.Expression {
	return {type: 'CallExpression',
		callee: dot(rt, wrapper),
		arguments: [{type: 'Literal', value: val}]};
    }

    switch (expr.form) {
    case 'null':
	return lit(0, 'wrapNull');
    case 'true':
	return lit(true, 'wrapBool');
    case 'false':
	return lit(false, 'wrapBool');
    case 'int':
	return lit(expr.val, 'wrapInt');
    case 'str':
	return lit(expr.val, 'wrapStr');
    case 'char':
	return lit(expr.val, 'wrapChar');

    case 'seq':
	return {type: 'SequenceExpression',
		expressions: expr.items.map(toESTree)};
    case 'noun':
	return {type: 'Identifier', name: expr.name};
    case 'assign':
	return     { type: "AssignmentExpression",
		     operator: "=",
		     left: { type: "Identifier", name: expr.target },
		     right: toESTree(expr.rvalue) };
    case 'call':
	var args: Array<mt.Expression> = expr.args;
	kludge('TODO: computed member expr for non-identifier verbs',
	       false, expr.verb);
	return { type: 'CallExpression',
		 callee: dot(toESTree(expr.target), expr.verb),
		 arguments: args.map(toESTree) };
    case 'hide':
	return iife(toESTree(expr.inner), []);
    case 'if':
	return { type: "ConditionalExpression",
		 test: toESTree(expr.test),
		 consequent: toESTree(expr.then),
		 alternate: toESTree(expr.otherwise) };
    }

    if (expr.form === 'def') {
	var pat = expr.pat;
	switch (pat.type) {
	case 'var':
	    kludge('slot guard', false, pat);
	case 'final':
	    return {type: 'AssignmentExpression',
		    operator: '=',
		    left: { type: 'Identifier', name: pat.name },
		    right: withGuard(toESTree(expr.expr), pat.guard) };
	default:
	    limitation('def pattern type:', false, pat);
	}
	throw new Error('pattern not impl: ' + pat.type);
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


function iife(body: es.Expression, params) {
    return { type: 'CallExpression',
	     callee: lambda([], body),
	     arguments: params }
}

function dot(obj: es.Expression, propName: string): es.Expression {
    return {type: 'MemberExpression',
	    object: obj,
	    property: {type: 'Identifier', name: propName}};
}

function convertObject(doc: ?string, name, as, impl, script: mt.Script): es.Expression {
    limitation('null doc', doc === null);
    limitation('null as', as === null);
    limitation('0 impls', impl.length === 0);
    limitation('null extends', script.ext === null);
    limitation('0 matchers', script.matchers.length === 0);

    function convertMethod(m: mt.Method): es.Property {
	limitation('null doc', m.doc === null);
	return { "type": "Property",
		 "key": {
                     "type": "Identifier",
                     "name": m.verb
		 },
		 "computed": false,
		 "value": withGuard(
		     lambda(m.params, m.body), m.guard) };
    }

    // TODO: ensure Trait is hygenic; i.e. never used in monte.
    var TraitModule = { "type": "Identifier", "name": "Trait" };
    var ObjectAPI = { "type": "Identifier", "name": "Object" };

    var init = {
        "type": "CallExpression",
        "callee": dot(TraitModule, "create"),
        "arguments": [
            dot(ObjectAPI, "prototype"),
	    { type: "ObjectExpression",
	      properties: script.methods.map(convertMethod)}
	]
    };

    // TODO: push var statements out somehow.
    return {
	type: "VariableDeclaration",
	declarations: [
	    {
		type: "VariableDeclarator",
		id: { type: "Identifier", name: name },
		init: init
	    }
	],
	kind: "var"
    };

}

function lambda(params: Array<mt.Pattern>, body: mt.Expression): es.Expression {
    function convertPattern(p: mt.Pattern): es.Pattern {
	switch (p.type) {
	case 'final':
            kludge('guard???', p.guard === null, p);
	    return kludge('final (let)', false,
			  { type: 'Identifier', name: p.name });
	case 'ignore':
            kludge('guard???', p.guard === null, p);
	    return kludge('ignored param?', false,
			  { type: 'Identifier', name: '_' });
	case 'var':
            kludge('guard???', p.guard === null, p);
	    return { type: 'Identifier', name: p.name };
	case 'list':
	    return kludge('list param??', false,
			  { type: 'Identifier', name: '_list' });
	default:
	    limitation('pattern kind?', false, p);
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

function withGuard(x: es.Expression, guard: ?mt.Expression): es.Expression {
    return guard ? {
	type: 'CallExpression',
	callee: dot(toESTree(guard), 'coerce'),
	arguments: [x]
    } : x;
}

function limitation(label, ok, specimen?: any) {
    if (!ok) {
	if (specimen) {
	    console.log(specimen);
	}
	throw new Error(label);
    }
}

function kludge<T>(label: string, ok, specimen: T): T {
    if (!ok) {
	console.log('KLUDGE: ' + label, specimen);
    }
    return specimen;
}

function trace<T>(label, x: T): T {
    var tracing = true;

    if (tracing) {
	console.log(label, x);
    }
    return x;
}
