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
    { is: "call", target: Expression, verb: string, args: Array<Expression> }
;
  // TODO: others

export type Pattern =
    { pt: "final", name: string, guard: ?Expression } |
    { pt: "ignore", guard: ?Expression } |
    { pt: "var", name: string, guard: ?Expression } |
    { pt: "list", items: Array<Pattern>, tail: ?Pattern } |
    { pt: "via", view: Expression, inner: Pattern }
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
export var trueExpr : Expression = fix({ is: "true" });
export var falseExpr : Expression = fix({ is: "false" });

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
    return decode_utf8(s.slice(size));
};

function loadTuple<S, T>(s, f: ((s: S) => T)): Array<T> {
    var kind = s.nextByte();
    if (kind != 7) {
	throw new Error("expected Tuple (7); got: " + kind);
    }
    var arity = trace("tuple arity", s.nextVarInt());
    // TODO: MAX_ARITY
    // ew... why can't I get map or a comprehension to work?!
    var rv = [];
    for(var i = arity; i > 0; i--) {
	rv.push(f(s));
    }
    return rv;
};

function loadOpt(s): ?Expression {
    var e = loadTerm(s);
    return e.is === 'null' ? null : e;
}

function badFormat(info) {
    throw new Error("bad format " + JSON.stringify(info));
};

function loadTerm(stream): Expression {
    var kind = stream.nextByte();

    function notImpl(): Expression {
	throw new Error("not impl " + kind);
    };

    function loadStrVal(s): string {
	var e = loadTerm(s);
	if (e.is !== 'str') {
	    throw new Error('expected str; got: ' + JSON.stringify(e));
	}
	return e.val;
    }

    var kinds : Array<((s: any) => Expression)>= [
	(s) => nullExpr,
	(s) => trueExpr,
	(s) => falseExpr,
	(s) => strExpr(loadString(s)),
	(s) => notImpl(), // double
	(s) => notImpl(), // char
	(s) => intExpr(zzd(s.nextVarInt())),
	(s) => badFormat({ exprKind: kind}), // we handle tuple elsewhere
	(s) => badFormat({ exprKind: kind}), // bag
	(s) => badFormat({ exprKind: kind}), // attr

	// 10: LiteralExpr
	(s) => loadTerm(s),
	(s) => fix({is: 'noun', name: loadStrVal(s)}),
	(s) => notImpl(), // @@binding
	(s) => fix({is: 'seq', items: loadTuple(s, loadTerm)}),
	(s) => fix({is: 'call',
		    target: loadTerm(s),
		    verb: loadStrVal(s),
		    args: loadTuple(s, loadTerm)}),
	// 16: Def
	(s) => fix({is: 'def', pat: loadPattern(s),
		    guard: loadOpt(s), expr: loadTerm(s)}),
    ];

    var loadKind = kinds[kind];
    if (!loadKind) {
	notImpl();
    }

    return trace("loadTerm", loadKind(stream));
}


function loadOptPattern(stream): ?Pattern {
    var peek = stream.nextByte();
    if (peek == 0) {
	return null;
    }
    return loadPattern(stream, peek);
}

function loadPattern(stream, peek: ?number): Pattern {
    var bias = 27;
    if (!peek) {
	peek = stream.nextByte();
    }
    var kind = peek - bias;

    function loadNounName(s): string {
	var e = loadTerm(s);
	if (e.is !== 'noun') {
	    throw new Error('expected noun; got: ' + JSON.stringify(e));
	}
	return e.name;
    }

    var kinds: Array<((s: any) => Pattern)> = [
	(s) => fix({pt: 'final', name: loadNounName(s),
		    guard: loadOpt(s)}),
	(s) => fix({pt: 'ignore', guard: loadOpt(s)}),
	(s) => fix({pt: 'var', name: loadNounName(s),
		    guard: loadOpt(s)}),
	(s) => fix({pt: 'list', items: loadTuple(s, loadPattern),
		    tail: loadOptPattern(s)}),
	(s) => fix({pt: "via", view: loadTerm(s), inner: loadPattern(s) })
    ];

    var loadKind = kinds[kind];
    if (!loadKind) {
	throw badFormat({patternKind: kind, slice: stream.slice(4)});
    }
    return trace("loadPattern", loadKind(stream));
}
