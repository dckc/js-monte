/* @flow */

type Expression =
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

export function load(data: string): Expression {
  return { is: "null" };
}

function makeStream(items: string) {
    var counter = 0;
    var size = items.length;

    var unshift = (byte) => (byte - 32) % 256;
    var nextItem = () => {
	if (counter > size) {
	    throw "Buffer underrun while streaming";
	}
	var rv = items.charCodeAt(counter);
	counter += 1;
	return rv;
    };

    return Object.freeze({
	done: () => counter >= size,
	nextItem: nextItem,
	nextByte: () => unshift(nextItem())
    });
}
