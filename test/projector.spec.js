import {
  expect,
} from 'chai';
import {
  GraphQLNonNull,
  GraphQLList,
} from 'graphql';
import boundProjector from '../index';
import schema, {
  ActorType,
  FilmType,
  UserType,
} from './schema';
import argsFromQuery from './argsFromQuery';

describe('projector', () => {
  it('should return no projections for an empty query', () => {
    const projection = boundProjector({
      fieldNodes: [],
      returnType: 'NotRealType',
      fragments: {},
      schema: {
        _typeMap: {},
      },
    });

    expect(projection).to.eql({});
  });

  it('should handle basic queries', () => {
    const projection = boundProjector({
      schema,
      ...argsFromQuery(UserType, `
      {
        user {
          id
          name
          address {
            street
            postCode
          }
          favorites{
            id
            name
            actors {
              name
            }
          }
        }
      }
    `),
    });
    expect(projection).to.deep.eql({
      id: 1,
      name: 1,
      location: {
        street: 1,
        postCode: 1,
      },
      favorites: {
        id: 1,
        name: 1,
        actors: {
          firstName: 1,
          lastName: 1,
        },
      },
    });
  });

  it('should handle named queries', () => {
    const projection = boundProjector({
      schema,
      ...argsFromQuery(new GraphQLNonNull(UserType), `
      query GetUser {
        user {
          id
          name
        }
      }
    `),
    });

    expect(projection).to.deep.eql({
      id: 1,
      name: 1,
    });
  });

  it('should handle list results', () => {
    const projection = boundProjector({
      schema,
      ...argsFromQuery(new GraphQLList(FilmType), `
      {
        movies {
          id
          name
          actors {
            id
            name
          }
        }
      }
    `),
    });
    expect(projection).to.deep.eql({
      id: 1,
      name: 1,
      actors: { id: 1, firstName: 1, lastName: 1 },
    });
  });

  it('should handle custom projections', () => {
    const projection = boundProjector({
      schema,
      ...argsFromQuery(new GraphQLNonNull(UserType), `
      {
        user {
          id
          username
        }
      }
    `),
    });
    expect(projection).to.deep.eql({
      id: 1,
      email: 1,
    });
  });

  it('should support fields as a function', () => {
    const projection = boundProjector({
      schema,
      ...argsFromQuery(ActorType, `
      {
        actor(id: 1) {
          id
          name
        }
      }
    `),
    });
    expect(projection).to.deep.eql({
      id: 1,
      firstName: 1,
      lastName: 1,
    });
  });

  it('should support fragments', () => {
    const projection = boundProjector({
      schema,
      ...argsFromQuery(ActorType, `
      {
        actor(id: 1) {
          ...ActorProps
        }
      }

      fragment ActorProps on Actor {
        id
        name
        address
      }
    `),
    });

    expect(projection).to.deep.eql({
      id: 1,
      firstName: 1,
      lastName: 1,
      address: 1,
    });
  });
});
