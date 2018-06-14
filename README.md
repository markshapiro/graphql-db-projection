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
Prepare helping directive if you intend to use custom projections:

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

// (you can also call the directive differently)
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
  directive @proj(...)  // directive not needed in simple example
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
```js
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
```js
{
  firstName: 1,
  address: {
    city: 1,
    street: 1
  }
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
If resolve field function maps to field with different name, or if it calculates value based on multiple fields from DB, then pass the critical DB field or their array through `projection` or `projections` parameter respectively. Pass [] to not to ask for any fields.

```js
const resolvers = {

  // ...

  User: {
    // translated from username field from db
    displayName: user => user.username,
    // calculated from gender, firstName, lastName from DB
    fullName: user => `${user.gender ? 'Mr.' : 'Mrs.'} ${user.firstName} ${user.lastName}`,
    // suppose Posts of User are in different DB collection/table
    posts: (user, args, ctx, postsFieldASTs) => {

      // you can make new isolated projection only for User's Posts fetch
      // based on Post's GraphQL subquery
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
```js
{ 
  username: 1,
  gender: 1,
  firstName: 1,
  lastName: 1
  // but not posts as we explicitly omitted them because they are located in different collection
}
```

## True Name of Field in DB
When using custom projection on field with object value in DB, you won't be able to make inner projections of that object, it will just ask for `<field name>: 1`, to fix it use `trueName`:

```js
const typeDefs = gql`
  directive @proj(...)

  type User {
    username: String

    // stored as 'location' object in DB
    address: Address @proj(trueName: 'location')
  }
  
  type Address {
    city: String
    postalCode: String
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
    address: user => user.location,
  },
};
```
requesting all these fields in GraphQL query will result in projection:
```js
{
  username: 1,
  location: {
    city: 1,
    postalCode: 1
  }
}
```
