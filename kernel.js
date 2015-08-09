/* @flow */

export type Expression =
    // Literals
    { is: "null" } |
    { is: "true" } |
    { is: "false" } |
    { is: "str", val: string } |
    { is: "double", val: number } |
    { is: "char", val: string } |  // no char type in JS :-/
    { is: "int", val: number }  | // TODO: arbitrary precision int
    { is: "seq", items: Array<Expression> } |
    { is: "noun", name: string } |
    { is: "def", pat: Pattern, guard: ?Expression, expr: Expression } |
    { is: "call", target: Expression, verb: string, args: Array<Expression> } |
    { is: "escape", pattern: Pattern, body: Expression,
      catchPattern: ?Pattern, catchBody: Expression } |
    { is: "finally", body: Expression, finalBody: Expression } |
    { is: "object", doc: ?string, name: ?string,
      as: ?Expression, impl: Array<Expression>, script: Script }
;
  // TODO: others

type Script = { ext: ?Expression,
		methods: Array<Method>,
		matchers: Array<Matcher> };
type Method = { doc: ?string,
		verb: string,
		params: Array<Pattern>,
		guard: ?Expression,
		body: Expression };
type Matcher = { pattern: Pattern, body: Expression };

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

function trace<T>(label, x: T): T {
    var tracing = false;

    if (tracing) {
	console.log(label, x);
    }
    return x;
}

export var nullExpr : Expression = fix({ is: "null" });
var trueExpr : Expression = fix({ is: "true" });
var falseExpr : Expression = fix({ is: "false" });

export function boolExpr(b: bool) : Expression {
    return b ? trueExpr : falseExpr;
}

export function strExpr(s: string): Expression {
	return fix({ is: "str", val: s});
}

export function intExpr(i: number): Expression {
    return fix({ is: "int", val: i });
}

export function load(data: string): Array<Expression> {
    var stream = makeStream(data);
    var terms = [], term;

    while (!stream.done()) {
	term = loadTerm(stream);
	terms.push(term);
    }
    return terms;
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

/** zz decode: least significant bit is sign. */
function zzd(bi) {
    var shifted = bi >> 1; // TODO: bigint
    return (bi & 1) != 0 ? shifted ^ -1 : shifted;
}


// ack: http://ecmanaut.blogspot.com/2006/07/encoding-decoding-utf8-in-javascript.html
function decode_utf8(s) {
  return decodeURIComponent(escape(s));
}

function loadString(s) {
    var size = s.nextVarInt(); //toInt
    return decode_utf8(size > 0 ? s.slice(size) : "");
};

function loadNounName(s): string {
    var e = loadTerm(s);
    if (e.is !== 'noun') {
	throw new Error({expected: 'noun', actual: e});
    }
    return e.name;
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

function badFormat(info) {
    throw new Error("bad format " + JSON.stringify(info));
};

function loadTerm(stream, peek: ?number): Expression {
    if (!peek) {
	peek = getTag(stream);
    }
    var kind = trace('loadTerm kind: ' + tagName[peek], peek);

    function notImpl(): Expression {
	throw new Error("not impl " + kind);
    };

    function loadStrVal(s, peek: ?number): string {
	var e = loadTerm(s, peek);
	if (e.is !== 'str') {
	    throw new Error({expected: 'str', actual: JSON.stringify(e)});
	}
	return e.val;
    }

    function loadObject(s): Expression {
	var doc = trace('object doc', loadOpt(s, loadString));
	var namePat = loadPattern(s);
	var name = (namePat.pt === 'final' ? namePat.name :
		    namePat.pt === 'ignore' ? null :
		    badFormat({expected: "final or ignore pattern",
			       actual: namePat}));
	var auditors = loadTuple(s, loadTerm);
	var as = auditors[0].is === 'null' ? null : auditors[0];
	var impl = auditors.slice(1);

	getTag(s, 'Script');

	return fix({is: 'object',
		    doc: doc,
		    name: name,
		    as: as,
		    impl: impl,
		    script: { ext: loadOpt(s, loadTerm),
			      methods: loadTuple(s, loadMethod),
			      matchers: loadTuple(s, loadMatcher) }});
    }

    function loadMethod(s): Method {
	getTag(s, 'Method');

	var docExpr = loadOpt(s, loadTerm);

	return {
	    doc: (!docExpr ? null :
		  docExpr.is === 'str' ? docExpr.val :
		  badFormat({expected: 'Doc string', actual: docExpr})),
	    verb: loadStrVal(s),
	    params: loadTuple(s, loadPattern),
	    guard: loadOpt(s, loadTerm),
	    body: loadTerm(s)
	};
    }

    function loadMatcher(s): Matcher {
	return { pattern: loadPattern(s),
		 body: loadTerm(s) };
    }

    var kinds : Array<((s: any) => Expression)>= [
	(s) => nullExpr,
	(s) => trueExpr,
	(s) => falseExpr,
	(s) => strExpr(loadString(s)),
	(s) => notImpl(), // double
	(s) => notImpl(), // char
	(s) => intExpr(zzd(s.nextVarInt())),
	(s) => badFormat({ actual: tagName[kind]}), // we handle tuple elsewhere
	(s) => badFormat({ actual: tagName[kind]}), // bag
	(s) => badFormat({ actual: tagName[kind]}), // attr

	// 10: LiteralExpr
	(s) => loadTerm(s),
	(s) => fix({is: 'noun', name: loadStrVal(s)}),
	(s) => notImpl(), // @@binding
	(s) => fix({is: 'seq', items: loadTuple(s, loadTerm)}),
	(s) => fix({is: 'call',
		    target: loadTerm(s),
		    verb: loadStrVal(s),
		    args: loadTuple(s, loadTerm)}),

	// 15: Def
	(s) => fix({is: 'def', pat: loadPattern(s),
		    guard: loadOpt(s, loadTerm), expr: loadTerm(s)}),
	(s) => fix({is: 'escape',
		    pattern: loadPattern(s),
		    body: loadTerm(s),
		    catchPattern: loadOpt(s, loadPattern),
		    catchBody: loadTerm(s)}),
	(s) => loadObject(s),
	(s) => badFormat({ actual: tagName[kind]}), // 18: 'Script',
	(s) => badFormat({ actual: tagName[kind]}), // 19: 'Method',

	(s) => badFormat({ actual: tagName[kind]}), // 20: 'Matcher',
	(s) => notImpl(), // 21: 'Assign',
	(s) => fix({ is: "finally", body: loadTerm(s),
		     finalBody: loadTerm(s)}),  
	(s) => notImpl(), // 23: 'KernelTry',
	(s) => notImpl(), // 24: 'HideExpr',

	(s) => notImpl(), // 25: 'If',
	(s) => notImpl(), // 26: 'Meta',

	// ...
	// 33: 'Character',
    ];

    var loadKind = kinds[kind];
    if (!loadKind) {
	notImpl();
    }

    return trace("loadTerm", loadKind(stream));
}


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
	(s) => fix({pt: 'final', name: loadNounName(s),
		    guard: loadOpt(s, loadTerm)}),
	(s) => fix({pt: 'ignore', guard: loadOpt(s, loadTerm)}),
	(s) => fix({pt: 'var', name: loadNounName(s),
		    guard: loadOpt(s, loadTerm)}),
	(s) => fix({pt: 'list', items: loadTuple(s, loadPattern),
		    tail: loadOpt(s, loadPattern)}),
	(s) => fix({pt: "via", view: loadTerm(s), inner: loadPattern(s) }),
	(s) => fix({pt: "binding", noun: loadNounName(s) })
    ];

    var loadKind = kinds[kind];
    if (!loadKind) {
	throw badFormat({patternKind: kind, slice: stream.slice(4)});
    }
    return trace("loadPattern", loadKind(stream));
}
