/* @flow */

import {Expression, Pattern, Script, Method, Matcher,
        nullExpr, boolExpr, intExpr, strExpr} from "./kernel";

export function load(data: string): Array<Expression> {
    var stream = makeStream(data);
    var exprs = [], expr;

    while (!stream.done()) {
	expr = loadExpr(stream);
	exprs.push(expr);
    }
    return exprs;
}

var tagName = [
    'NULL',
    'TRUE', 'FALSE',
    'STR', 'FLOAT', 'CHAR', 'INT',
    'TUPLE', 'BAG', 'ATTR',

    'LiteralExpr',
    'NounExpr',
    'BindingExpr',
    'SeqExpr',
    'MethodCallExpr',
    'Def',
    'Escape',
    'Object',
    'Script',
    'Method',
    'Matcher',
    'Assign',
    'Finally',
    'KernelTry',
    'HideExpr',
    'If',
    'Meta',

    'Final',
    'Ignore',
    'Var',
    'List',
    'Via',
    'Binding',

    'Character'
];
var tagNum = (function() {
    var ret = {};
    for (var i=0; i < tagName.length; i++) {
	ret[tagName[i]] = i;
    }
    return ret;
})();

function getTag(stream, expected: ?string): number {
    var t = stream.nextByte();
    if (expected) {
	var e = tagNum[expected];
	if (e !== t) {
	    throw new Error({expected: [e, expected], actual: [t, tagName[t]]})
	}
    }
    return t;
}

function badFormat(info) {
    throw new Error("bad format " + JSON.stringify(info));
}

function fix<T>(x: T): T {
    return Object.freeze(x);
}


function loadExpr(stream, peek: ?number): Expression {
    if (!peek) {
	peek = getTag(stream);
    }
    var kind = trace('loadExpr kind: ' + tagName[peek], peek);

    var kinds : Array<((s: any) => Expression)>= [
	(s) => nullExpr(),
	(s) => boolExpr(true),
	(s) => boolExpr(false),
	(s) => strExpr(loadString(s)),
	(s) => fix({ form: 'double', val: s.slice(8)}), // TODO: decode float
	(s) => fix({ form: 'char', val: loadString(s)}),
	(s) => intExpr(zzd(s.nextVarInt())),
	(s) => badFormat({ actual: tagName[kind]}), // we handle tuple elsewhere
	(s) => badFormat({ actual: tagName[kind]}), // bag
	(s) => badFormat({ actual: tagName[kind]}), // attr

	// 10: LiteralExpr
	(s) => loadExpr(s),
	(s) => fix({form: 'noun', name: loadStrVal(s)}),
	(s) => fix({form: 'binding', name: loadNounName(s)}),
	(s) => fix({form: 'seq', items: loadTuple(s, loadExpr)}),
	(s) => fix({form: 'call',
		    target: loadExpr(s),
		    verb: loadStrVal(s),
		    args: loadTuple(s, loadExpr)}),

	// 15: Def
	(s) => fix({form: 'def', pat: loadPattern(s),
		    guard: loadOpt(s, loadExpr), expr: loadExpr(s)}),
	(s) => fix({form: 'escape',
		    ejector: loadPattern(s),
		    escBody: loadExpr(s),
		    exc: loadOpt(s, loadPattern),
		    handler: loadExpr(s)}),
	(s) => loadObject(s),
	(s) => badFormat({ actual: tagName[kind]}), // 18: 'Script',
	(s) => badFormat({ actual: tagName[kind]}), // 19: 'Method',

	(s) => badFormat({ actual: tagName[kind]}), // 20: 'Matcher',
	(s) => fix({ form: "assign",
		     target: loadNounName(s),
		     rvalue: loadExpr(s) }),
	(s) => fix({ form: "finally", finalBody: loadExpr(s),
		     finish: loadExpr(s)}),  
	(s) => fix({ form: "try", tryBody: loadExpr(s),
		    exc: loadPattern(s),
		    handler: loadExpr(s)}),
	(s) => fix({ form: "hide", inner: loadExpr(s) }),

	(s) => fix({ form: "if", test: loadExpr(s), then: loadExpr(s),
		     otherwise: loadExpr(s) }),
	(s) => loadMeta(s)
    ];

    var loadKind = kinds[kind];
    if (!loadKind) {
	throw new Error({expected: "expression tag",
			 actual: [kind, tagName[kind]]});
    }

    return trace("loadExpr", loadKind(stream));
}


function loadObject(s): Expression {
    function loadMethod(s): Method {
	getTag(s, 'Method');

	var docExpr = loadOpt(s, loadExpr);

	return {
	    doc: (!docExpr ? null :
		  docExpr.form === 'str' ? docExpr.val :
		  badFormat({expected: 'Doc string', actual: docExpr})),
	    verb: loadStrVal(s),
	    params: loadTuple(s, loadPattern),
	    guard: loadOpt(s, loadExpr),
	    body: loadExpr(s)
	};
    }

    function loadMatcher(s): Matcher {
	getTag(s, 'Matcher');

	return { pattern: loadPattern(s),
		 body: loadExpr(s) };
    }

    var doc = trace('object doc', loadOpt(s, loadString));
    var namePat = loadPattern(s);
    var name = (namePat.type === 'final' ? namePat.name :
		namePat.type === 'ignore' ? null :
		badFormat({expected: "final or ignore pattern",
			   actual: namePat}));
    var auditors = loadTuple(s, loadExpr);
    var as = auditors[0].form === 'null' ? null : auditors[0];
    var impl = auditors.slice(1);
    
    getTag(s, 'Script');
    
    return fix({form: 'object',
		doc: doc,
		name: name,
		as: as,
		impl: impl,
		script: { ext: loadOpt(s, loadExpr),
			  methods: loadTuple(s, loadMethod),
			  matchers: loadTuple(s, loadMatcher) }});
}

function loadMeta(s): Expression {
    var nature = loadStrVal(s);
    if (nature != "context") {
	throw new Error({expected: "meta.context()",
			 actual: nature});
    }
    return fix({ form: "meta" });
}


function loadTuple<S, T>(s, f: ((s: S) => T)): Array<T> {
    getTag(s, 'TUPLE');

    var arity = trace("tuple arity", s.nextVarInt());
    // TODO: MAX_ARITY
    // ew... why can't I get map or a comprehension to work?!
    var rv = [];
    for(var i = arity; i > 0; i--) {
	rv.push(f(s));
    }
    return rv;
};

function loadOpt<S, T>(stream, load: (s: S, peek: ?number) => T): ?T {
    var peek = getTag(stream);
    if (peek == tagNum['NULL']) {
	return null;
    }
    return load(stream, peek);
}

function loadPattern(stream, peek: ?number): Pattern {
    if (!peek) {
	peek = getTag(stream);
    }
    var bias = tagNum['Final'];
    var kind = trace('loadPattern kind: ' + tagName[peek], peek) - bias;

    var kinds: Array<((s: any) => Pattern)> = [
	(s) => fix({type: 'final', name: loadNounName(s),
		    guard: loadOpt(s, loadExpr)}),
	(s) => fix({type: 'ignore', guard: loadOpt(s, loadExpr)}),
	(s) => fix({type: 'var', name: loadNounName(s),
		    guard: loadOpt(s, loadExpr)}),
	(s) => fix({type: 'list', items: loadTuple(s, loadPattern),
		    tail: loadOpt(s, loadPattern)}),
	(s) => fix({type: "via", view: loadExpr(s), inner: loadPattern(s) }),
	(s) => fix({type: "binding", noun: loadNounName(s) })
    ];

    var loadKind = kinds[kind];
    if (!loadKind) {
	throw badFormat({patternKind: [peek, kind, tagName[peek]],
			 slice: stream.slice(4)});
    }
    return trace("loadPattern", loadKind(stream));
}

function loadStrVal(s, peek: ?number): string {
    var e = loadExpr(s, peek);
    if (e.form !== 'str') {
	throw new Error({expected: 'str', actual: JSON.stringify(e)});
    }
    return e.val;
}


function loadNounName(s): string {
    var e = loadExpr(s);
    if (e.form !== 'noun') {
	throw new Error({expected: 'noun', actual: e});
    }
    return e.name;
}

function loadString(s): string {
    var size = s.nextVarInt(); //toInt

    // ack: http://ecmanaut.blogspot.com/2006/07/encoding-decoding-utf8-in-javascript.html
    var decode_utf8 = (txt) => decodeURIComponent(escape(txt));

    return decode_utf8(size > 0 ? s.slice(size) : "");
};


/** zz decode: least significant bit is sign. */
function zzd(bi) {
    var shifted = bi >> 1; // TODO: bigint
    return (bi & 1) != 0 ? shifted ^ -1 : shifted;
}


function makeStream(items: string) {
    var underrun = Error("Buffer underrun while streaming");
    var counter = 0;
    var size = items.length;

    var unshift = (byt) => (byt - 32) % 256;

    function nextItem() {
	if (counter > size) {
	    throw underrun;
	}
	var rv = items.charCodeAt(counter);
	counter += 1;
	return rv;
    }

    function slice(count: number) {
	var rv;
	var end = counter + count;
	if (end > size) {
	    throw underrun;
	}
	if (end <= 0) {
	    throw new Error("Negative count while slicing: " + count)
	}
	rv = items.slice(counter, end);
	counter = end;
	return rv;
    }

    function nextByte() {
	return unshift(nextItem());
    }

    function nextVarInt() {
	var shift = 0;
	var bi = 0, b;
	var cont = true;
	while (cont) {
	    b = nextByte();
	    bi = bi | ((b & 0x7f) << shift); // TODO: arbitrary precision int
	    shift += 7;
	    cont = (b & 0x80) != 0;
	}
	return bi;
    }

    return Object.freeze({
	done: () => counter >= size,
	slice: slice,
	nextByte: nextByte,
	nextVarInt: nextVarInt
    });
}

function trace<T>(label, x: T): T {
    var tracing = false;

    if (tracing) {
	console.log(label, x);
    }
    return x;
}
