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
Prepare directives you intend to use:

```js
import { ApolloProjector, IncludeAll, IgnoreField } from 'graphql-db-projection';

const typeDefs = gql`
  directive @proj(
    projection: String,
    projections: [String],
    nameInDB: String
  ) on FIELD_DEFINITION
  directive @all on FIELD_DEFINITION
  directive @ignore on FIELD_DEFINITION

  // ... your schemas
`;

// ...

// (you can also call the directives differently)
const server = new ApolloServer({
  typeDefs,
  resolvers,
  schemaDirectives: {
    proj: ApolloProjector,
    all: IncludeAll,
    ignore: IgnoreField
  }
});

```

## Simple Example
Suppose we have `User` model:
```js
const typeDefs = gql`
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
## Include automatically all nested fields
To automatically include all nested fields of object use `@all` directive:
```js 
const typeDefs = gql`
  type User {
    username: String
    address: Address @all
  }
  
  type Address {
    city: String
    postalCode: String
  }
`;
```
now `makeProjection` result on query
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
will be:
```js
{
  firstName: 1,
  address: 1
}
```

## Ignore projection
To remove field from projection use `@ignore` directive:
```js 
const typeDefs = gql`
  type User {
    firstName: String
    lastName: String @ignore
    username: String
    address: Address @ignore
  }
`;
```
the result when requesting all fields will be just `{ firstName: 1, username: 1 }`

## Custom Projections
If resolve function of GraphQL field uses multiple DB fields to calculate the value, use `@proj(projection: <field in db>)` or `@proj(projections: [<field in db>, ...])` to specify absolute paths of fields you need:

```js
const typeDefs = gql`
  type User {

    // will add username to projection
    displayName: String @proj(projection: "username")

    // will add gender, firstName and lastName to projection
    fullName: String @proj(projections: ["gender", "firstName", "lastName"])
    
    address: Address
  }
  
  type Address {
    country: String
    fullAddress: @proj(projections: ["city", "street"])
  }
`;

const resolvers = {
  User: {
    // displayName is calculated from username in DB
    displayName: user => user.username,
    
    // fullName is calculated from gender, firstName, lastName in DB
    fullName: user => `${user.gender ? 'Mr.' : 'Mrs.'} ${user.firstName} ${user.lastName}`,
  },
  
  Address: {
    fullAddress: address => `${address.city} ${address.street}`,
  }
};
```
requesting all these fields in GraphQL query will result in projection:
```js
{ 
  username: 1,
  gender: 1,
  firstName: 1,
  lastName: 1,
  addess: {
    country: 1,
    city: 1,
    street: 1
  }
}
```

## Name of Field in DB called differently
Custom projections specify absolute paths inside nested project, but don't do recursion on the nested fields like you have by default. If only the name of field is called differently in DB but you want to project the nested fields recursively, use `@proj(nameInDB: <field name in db>)`:

```js
const typeDefs = gql`

  type User {
    username: String

    // stored as 'location' object in DB
    address: Address @proj(nameInDB: "location")
  }
  
  type Address {
    city: String
    postalCode: String
  }
`;

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

## Projection of subquery
If your subquery in GraphQL needs additional fetch from DB to join into parent object, remember that you can call `makeProjection` on fieldASTs argument inside subquery resolver function. Suppose we have array of Posts inside User:
```js

const typeDefs = gql`
  type User {
    # suppose posts are located in different collection/table,
    # this is why we don't need to project that field in User
    posts: [PostType] @ignore
  }
`;

const resolvers = {
  User: {
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
```

