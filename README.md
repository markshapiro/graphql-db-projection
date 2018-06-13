# graphql-db-projection

Given GraphQL query, creates db fields projection to fetch only fields that are required.
<br/>Supports lists, nested queries and fragments.

## Installation

Install with yarn:

```bash
$ yarn add graphql-db-projection
```

or npm:

```bash
$ npm i -S graphql-db-projection
```

## Setup
Prepare helping directive:

```js
import makeProjection, { ApolloProjector } from 'graphql-db-projection';

const typeDefs = gql`
  directive @proj(
    projection: String,
    projections: [String],
    trueName: String
  ) on FIELD_DEFINITION

  // ... your schemas
`;

// ...

const server = new ApolloServer({
  typeDefs,
  resolvers,
  schemaDirectives: {
    proj: ApolloProjector,
  }
});

```

## Simple Usage
Suppose we have `User` model:
```js
const typeDefs = gql`
  directive @proj(...)

  type User {
    firstName: String
    lastName: String
    username: String
    address: Address
  }

  type Address {
    country: String
    city: String
    street: String
  }
`;
```
we can call `makeProjection` on last ASTs param to get projections mapping:
```js
import makeProjection from 'graphql-db-projection';
// ...
const resolvers = {
  Query: {
    users: (obj, args, request, fieldASTs) => {
      const projection = makeProjection(fieldASTs);
      // ...
    },
  },
};
```
then the following query:
```
query ($id: String){
  user (id: $id){
    firstName
    address {
      city
      street
    }
  }
}
```
will produce projection:
```
{
  firstName: 1,
  address: { city: 1, street: 1 }
}
```
now you can use it to project fields for db, for example for mongoDB:
```js
import { toMongoProjection } from 'graphql-db-projection';

// ...

const resolvers = {
  Query: {
    users: (obj, args, request, fieldASTs) => {
      const projection = makeProjection(fieldASTs);
      const mongoProjection = toMongoProjection(projection)
      return db.collection('users').findOne(args.id, mongoProjection);
    }
  }
}
```

## Custom Projections
If you need a specific set of fields from DB to resolve a GraphQL field, you can provide them through `projection` parameter. It can be string, array of fields from DB, or empty array to ignore the field.
```js
const resolvers = {

  // ...

  User: {
    displayName: user => user.username,
    fullName: user => `${user.gender ? 'Mr.' : 'Mrs.'} ${user.firstName} ${user.lastName}`,
    posts: (user, args, ctx, postsFieldASTs) => {

      // if posts of user are in different DB collection,
      // you can make inner projection for only posts fields.
      const projectionOfPost = makeProjection(postsFieldASTs);
      const mongoProjection = toMongoProjection(projectionOfPost)
      return db.collection('posts')
          .find({ postedBy: user.id }, mongoProjection).toArray();
    },
  },
};

// ...

const typeDefs = gql`
  directive @proj(...)

  type User {

    // will add 'username' to pojection
    displayName: String @proj(projection: 'username')

    // will add 'gender', 'firstName' and 'lastName' to projection
    fullName: String @proj(projections: ['gender', 'firstName', 'lastName'])

    // posts of user, suppose fetched from different table/collection
    posts: [PostType] @proj(projections: [])
  }
`;
```
requesting all these fields in GraphQL query will result in projection:
```
{ 
  username: 1,
  gender: 1,
  firstName: 1,
  lastName: 1
  // but not posts as we explicitly omitted them because they are located in different collection
}
```

#### NOTE: when using custom projections, it will not recursivelly process the nested objects of those fields, like it does by default. Use `trueName` if your GraphQL field is just called differently in DB and you want to process nested fields as well.

## True Name of Field in DB
If your GraphQL field maps to a field with different name in DB and can be nested object with its own projections.
```js
const typeDefs = gql`
  directive @proj(...)

  type User {

    // stored as 'email' in DB
    username: String @proj(email: 'email')

    // stored as 'location' in DB
    address: Address @proj(trueName: 'location')
  }
  type Address {
    city: String
    postalCode: String @proj(email: 'zipCode')  // stored as 'zipCode' in DB
  }
`;

// ...

const resolvers = {
  Query: {
    users: (obj, args, request, fieldASTs) => {
      const projection = makeProjection(fieldASTs);

      // ...
    },
  },
  User: {
    username: user => user.email,
    address: user => user.location,
  },
  Address: {
    postalCode: addr => addr.zipCode,
  },
};
```
requesting all these fields in GraphQL query will result in projection:
```
{
  email: 1,
  location: {
    city: 1,
    zipCode: 1
  }
}
```