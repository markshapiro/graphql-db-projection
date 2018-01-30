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

## Simple Usage
For example when fetching user by id:
```js
import makeProjection from 'graphql-db-projection';
// ...
    {
      type: UserType,
      args: {
        id: {
          type: GraphQLString,
        },
      },
      resolve: (user, { id }, request, fieldASTs) => {
        const projection = makeProjection(fieldASTs);
        
        // now you can use projection to know what are the only
        // fields you need from db.
        // ...
      },
    }
// ...
```
and suppose the `UserType` is:
```js
const UserType = new GraphQLObjectType({
  name: 'UserType',
  fields: {
    firstName: { type: GraphQLString },
    lastName: { type: GraphQLString },
    username: { type: GraphQLString },
    address: {
      type: new GraphQLObjectType({
        name: 'AddressType',
        fields: {
          country: { type: GraphQLString },
          city: { type: GraphQLString },
          street: { type: GraphQLString },
        },
      })
    },
  },
});
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
will produce `projection`:
```
{ 
  firstName: 1,
  address: { city: 1, street: 1 }
}
```
now you can use it to fetch fields, for example for mongoDB:
```js
import { toMongoProjection } from 'graphql-db-projection';
// ...
resolve(user, args, ctx, fieldASTs) {
  const projection = makeProjection(fieldASTs);
  const mongoProjection = toMongoProjection(projection)
  return db.collection('users').findOne(args.id, mongoProjection);
}
```

## Custom Projections
If you need a specific set of fields from DB to resolve a GraphQL field,
you can provide them through `projection` parameter.
<br/>It can be string, array of fields from DB, or empty array to ignore the field.
```js
// ...
new GraphQLObjectType({
  name: 'UserType',
  fields: {
    // ...
    displayName: {
      type: GraphQLString,
      resolve: user => user.username,
      projection: 'username'  // will add 'username' to pojection
    },
    fullName: {
      type: GraphQLString,
      resolve: user => `${user.lastName}`,
      // will add 'gender', 'firstName' and 'lastName' to projection
      projection: ['gender', firstName', 'lastName']
    },
    posts: {
      type: new GraphQLList(PostType),
      
      // if posts of user are in different DB collection,
      // you can make inner projection for only posts fields.
      resolve: (user, args, ctx, postsFieldASTs) => {
        const projectionOfPost = makeProjection(postsFieldASTs);
        const mongoProjection = toMongoProjection(projectionOfPost)
        return db.collection('posts')
            .find({ postedBy: user.id }, mongoProjection).toArray();
      },
      
      // you can ignore the field since the posts data is elsewhere.
      projection: []
    }
  },
})
```
requesting all these fields in GraphQL query will result in projection:
```
{ 
  gender: 1,
  username: 1,
  firstName: 1,
  lastName: 1
  // but not posts
}
```

#### NOTE: when using custom projections, it will not recursivelly process the nested objects of those fields, like it does by default. Use `trueName` if your GraphQL field is just called differently in DB and you want to process nested fields as well.

## True Name of Field in DB
If your GraphQL field maps to a field with different name in DB and can be nested object with its own projections.
```js
const UserType = new GraphQLObjectType({
  name: 'UserType',
  fields: {
    username: {
      type: GraphQLString,
      resolve: user => user.email,
      trueName: 'email'  // stored as 'email' in DB
    },
    address: {
      type: new GraphQLObjectType({
        name: 'AddressType',
        fields: {
          city: {
            type: GraphQLString
          },
          postalCode: {
            type: GraphQLString,
            resolve: address => address.zipCode,
            trueName: 'zipCode'  // stored as 'zipCode' in DB
          },
        },
      }),
      resolve: user => user.location,
      trueName: 'location'     // stored as 'location' in DB
    },
  },
});
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
