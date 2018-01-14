# graphql-db-projection

Creates object that describes what are the fields needed to fetch from db, in order to minimize fetched data.
<br/>Supports lists, nested querries and fragments.

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
      resolve: (root, { id }, request, info) => {
        const projection = makeProjection(info);
        
        // now you can use projection to know what are the only fields you need from db.
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
resolve(root, args, ctx, info) {
  const projection = makeProjection(info);
  const mongoProjection = toMongoProjection(projection)
  return db.collection('users').findOne(args.id, mongoProjection);
}
```

## Custom Projections
If the graphql field is called differently in db or you need multiple fields from db to resolve it,
<br/>then you can provide `projection` parameter, either string or array of strings, or empty array if you want to ignore it:
```js
// ...
new GraphQLObjectType({
  name: 'UserType',
  fields: {
    // ...
    displayName: {
      type: GraphQLString,
      projection: 'username'    // will rename the field 'username'
    },
    fullName: {
      type: GraphQLString,
      resolve: root => `${user.firstName} ${user.lastName}`,
      projection: ['firstName', 'lastName']    // will replace with 'firstname': 1 and 'lastName': 1
    },
    posts: {
      type: new GraphQLList(PostType),
      
      resolve: (root, args, ctx, info) => {
        const projectionOfPost = makeProjection(info);  // you can continue projecting posts fields
        const mongoProjection = toMongoProjection(projection)
        return db.collection('posts').find({ postedBy: root.id }, mongoProjection).toArray();
      },
      
      // if posts data is outside of this object and you don't need any fields for this.
      // will omit this field:
      projection: []
    }
  },
})
```
requesting these fields will result in projection:
```
{ 
  username: 1,
  firstName: 1,
  lastName: 1
}
```
and you can make posts projection using requested fields of posts (in user query) in their resolve method.
