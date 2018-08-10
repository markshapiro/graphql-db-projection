import type {
  FieldNode,
  FragmentDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from 'graphql/language/ast';
import type {
  GraphQLNamedType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from 'graphql/type';
import {
  getNamedType,
} from 'graphql/type';

import { SchemaDirectiveVisitor } from 'graphql-tools';

export type Projection = {
  [id:string]: Projection
};

/**
 * Attempt to grab the type name from a GraphQL return type. E.g., if it's a null or a list
 * we only care about the inner guts.
 */
function getTypeName(returnType: GraphQLOutputType): string {
  let namedType: ?GraphQLNamedType = getNamedType(returnType);
  if (namedType) {
    while (namedType.ofType) {
      namedType = namedType.ofType;
    }
    return namedType;
  }
  throw new Error('Could not detect return type');
}

function replaceFragments(
  selectionSet: ?SelectionSetNode,
  fragments: { [fragmentName: string]: FragmentDefinitionNode },
): Array<FieldNode> {
  if (!selectionSet) {
    return [];
  }

  return selectionSet.selections.reduce((
    accumulator: Array<FieldNode>,
    selection: SelectionNode,
  ): Array<FieldNode> => {
    if (selection.kind === 'Field') {
      return [...accumulator, selection];
    }
    if (selection.kind !== 'FragmentSpread') {
      // todo: Figure out what we need to do to handle this case
      throw new Error(`Unable to handle SelectionNode of type '${selection.kind}'`);
    }
    const fragment: ?FragmentDefinitionNode = fragments[selection.name.value];
    if (!fragment) {
      throw new Error(`Unable to find fragment for selection '${selection.name.value}'`);
    }
    // Step through this fragment recursively in case it is also made up of fragments
    const fragmentSelections = replaceFragments(fragment.selectionSet, fragments);
    return [
      ...accumulator,
      ...fragmentSelections,
    ];
  }, []);
}

export default function projector(
  { fieldNodes, returnType, fragments, schema }: GraphQLResolveInfo,
): Projection {
  const projection: Projection = {};
  const typeName: string = getTypeName(returnType).name;
  fieldNodes.forEach((fieldNode: FieldNode): Projection => {
    // Ensure all of the selection sets through the tree aren't fragments
    const selections: Array<FieldNode> = replaceFragments(fieldNode.selectionSet, fragments);
    selections.forEach((selection: FieldNode): Projection => {
      let fieldName: string = selection.name.value;
      /* eslint-disable no-underscore-dangle */
      const type: ?GraphQLNamedType = schema._typeMap[typeName];
      const field: ?Object = type.getFields()[fieldName];
      if (!field) {
        projection[fieldName] = 1;
        return;
      }
      let customProjection = field.projection;
      if (customProjection) {
        if (!Array.isArray(customProjection)) {
          customProjection = [customProjection];
        }
        customProjection.forEach((fname) => {
          projection[fname] = 1;
        });
        return;
      }
      if (field.nameInDB) {
        fieldName = field.nameInDB;
      }
      // if complex type
      if (selection.selectionSet) {
        projection[fieldName] = {};
        const innerResult: Projection = projector({
          fieldNodes: [selection],
          returnType: field.type,
          fragments,
          schema });
        // eslint-disable-next-line
        for (const key: string in innerResult) {
          projection[fieldName][key] = innerResult[key];
        }
      } else {
        projection[fieldName] = 1;
      }
    });
  });
  return projection;
}

function toMongoProjection(projection) {
  const result = {};
  // eslint-disable-next-line
  for (const key in projection) {
    if (projection[key] === 1) {
      result[key] = 1;
    } else {
      // eslint-disable-next-line
      for (const inKey in toMongoProjection(projection[key])) {
        result[`${key}.${inKey}`] = 1;
      }
    }
  }
  return result;
}

class ApolloProjector extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { projection, projections, nameInDB } = this.args;
    field.projection = projection || projections; // eslint-disable-line
    field.nameInDB = nameInDB;  // eslint-disable-line
  }
}

class IncludeAll extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    field.projection = field.name;
  }
}

class IgnoreField extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    field.projection = [];
  }
}

export {
  toMongoProjection,
  ApolloProjector,
  IncludeAll,
  IgnoreField,
};
