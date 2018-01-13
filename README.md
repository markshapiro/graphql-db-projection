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
    name: { type: GraphQLString },
    username: { type: GraphQLString },
    email: { type: GraphQLString },
    address: {
      type: new GraphQLObjectType({
        name: 'UserType',
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
then the following query
```
query($id: String){
  user (id:$id){
    username
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
  username: 1,
  address: {city:1, street:1}
}
```
now you can use it to fetch fields, for example for mongoDB:
```js
import { toMongoProjection } from 'graphql-db-projection';
// ...
resolve(root, args, ctx, info) {
  const projection = makeProjection(info);
  const mongoProjection = toMongoProjection(projection)
  return db.collection('users').findOne({_id: ObjectId(args._id)}, mongoProjection)
}
```

## Advanced Usage