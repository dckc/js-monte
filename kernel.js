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

  { is: "noun", has: string };
  // TODO: others

function def(x) {
    return Object.freeze(x);
}

export var nullExpr : Expression = def({ is: "null" });
export var trueExpr : Expression = def({ is: "true" });
export var falseExpr : Expression = def({ is: "false" });

export function boolExpr(b: bool) : Expression {
    return b ? trueExpr : falseExpr;
}

export function strExpr(s: string): Expression {
	return def({ is: "str", val: s});
}

export function intExpr(i: number): Expression {
    return def({ is: "int", val: i });
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
    var counter = 0;
    var size = items.length;

    var unshift = (byt) => (byt - 32) % 256;

    function nextItem() {
	if (counter > size) {
	    throw "Buffer underrun while streaming";
	}
	var rv = items.charCodeAt(counter);
	counter += 1;
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
	nextItem: nextItem,
	nextByte: nextByte,
	nextVarInt: nextVarInt
    });
}

/** zz decode: least significant bit is sign. */
function zzd(bi) {
    var shifted = bi >> 1; // TODO: bigint
    return (bi & 1) != 0 ? shifted ^ -1 : shifted;
}


function loadTerm(stream): Expression {
    var kind = stream.nextByte();

    var nextString = (s) => {
	// nextVarInt
	// slice
	// utf8 decode
	return "@@@";
    };

    function notImpl(): Expression {
	throw ("not impl " + kind)
    };

    var kinds = [
	(s) => nullExpr,
	(s) => trueExpr,
	(s) => falseExpr,
	(s) => strExpr(nextString(s)),
	(s) => { return { is: "double", val: 1.0 }}, // mkDouble
	(s) => { return { is: "char", val: "@" }}, // mkChar
	(s) => intExpr(zzd(s.nextVarInt())),
	(s) => notImpl(), // @@tuple
	(s) => notImpl(), // @@bag
	(s) => notImpl(), // @@attr
	(s) => loadTerm(s)
    ];

    var loadKind = kinds[kind];
    if (loadKind) {
	return loadKind(stream);
    } else {
	return notImpl();
    }
}
