import { parse } from 'graphql';

export default function argsFromQuery(returnType, query) {
  const { definitions } = parse(query);
  const fieldNodes = definitions
    .find(definition => definition.operation === 'query')
    .selectionSet
    .selections;
  const fragments = definitions
    .filter(definition => definition.kind === 'FragmentDefinition');

  return {
    fieldNodes,
    returnType,
    fragments: fragments.reduce((accumulator, fragment) => {
      const fragmentOver = fragment.name.value;
      accumulator[fragmentOver] = fragment; // eslint-disable-line no-param-reassign

      return accumulator;
    }, {}),
  };
}
