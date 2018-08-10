import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
} from 'graphql';

export const AddressType = new GraphQLObjectType({
  name: 'Address',
  fields: {
    city: { type: new GraphQLNonNull(GraphQLString) },
    street: { type: new GraphQLNonNull(GraphQLString) },
    postCode: { type: new GraphQLNonNull(GraphQLString) },
  },
});

export const ActorType = new GraphQLObjectType({
  name: 'Actor',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString), projection: ['firstName', 'lastName'] },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    address: { type: AddressType },
    averageRating: { type: new GraphQLNonNull(GraphQLInt) },
  }),
});

export const FilmType = new GraphQLObjectType({
  name: 'Film',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    year: { type: new GraphQLNonNull(GraphQLString), projection: 'releaseDate' },
    releaseDate: { type: new GraphQLNonNull(GraphQLString) },
    actors: { type: new GraphQLList(ActorType) },
  },
});

export const UserType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    username: { type: new GraphQLNonNull(GraphQLString), projection: 'email' },
    name: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: new GraphQLNonNull(GraphQLString) },
    address: {
      type: AddressType,
      nameInDB: 'location',
    },
    favorites: {
      type: new GraphQLList(FilmType),
    },
  },
});

export default new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQuery',
    fields: {
      user: {
        type: new GraphQLNonNull(UserType),
        resolve: () => ({ id: 1, name: 'anonymous', email: 'example@example.com' }),
      },
      actor: {
        type: ActorType,
        args: {
          id: {
            name: 'Actor ID',
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        resolve: () => null,
      },
      movies: {
        type: new GraphQLList(FilmType),
        resolve: () => [],
      },
    },
  }),
});
