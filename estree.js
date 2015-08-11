/** estree -- ADT for JavaScript syntax

refs:
https://github.com/estree/estree
https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API

@flow
*/

export type Expression =
    { type: "ObjectExpression",
      properties: Array<Property> } |
    { type: "FunctionExpression",
      id: ?Pattern,
      params: Array<Pattern>, defaults: Array<Expression>,
      body: Statement,
      generator: boolean, "expression": boolean } |
    { type: 'Literal', value: ?(boolean | number | string) } |
    { type: 'Identifier', name: string } |
    { type: 'SequenceExpression',
      expressions: Array<Expression> } |
    { type: 'AssignmentExpression',
      operator: string, /* TODO: AssignmentOperator */
      left: /* TODO: Pattern | */ Expression,
      right: Expression } |
    { type: 'CallExpression',
      callee: Expression, arguments: Array<Expression> } |
    { type: 'MemberExpression', object: Expression, property: Expression };
    // TODO: more...

export type Property = {
    "type": "Property",
    "key": Expression,
    "computed": boolean,
    "value": Expression };

export type Statement =
    { type: "BlockStatement", body: Array<Statement> } |
    { type: "ReturnStatement", argument: ?Expression };
    // todo: more...

export type Pattern =
    { type: "Identifier", name: string };

export function es6_dummy() {
    // without this, all the type decls get translated away,
    // and I guess the module doesn't get translated?
}
