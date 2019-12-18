const { ApolloServer, gql } = require('apollo-server');
const { makeExecutableSchema } = require('graphql-tools');
const sha256 = require('js-sha256');
const jwt = require('jsonwebtoken');
const permissions = require('./permissions.js');
const { applyMiddleware } = require('graphql-middleware');
const uuidv1 = require('uuid/v1');

let todoData;
let userData;

var neo4j = require('neo4j-driver')
var neoDriver;
function getNeoDriver() {
    if (neoDriver == null) {
        neoDriver = neo4j.driver(
            'bolt://localhost:7687',
            neo4j.auth.basic('neo4j', 'passwd'))
    }
    return neoDriver
}

const typeDefs = gql`
  type Todo {
      id: ID!
      text: String
      done: Boolean
      owner: User
  }
  type User {
      id: ID!
      name: String
      hash: String
      admin: Boolean
  }
  type Response {
      accepted: Boolean
      reason: String
  }
  type Mutation {
      login(name: String!, password: String!): String
      createTodo(creator: ID!, text: String): Todo
      updateTodo(id: ID!, text: String, done: Boolean): Todo
      deleteTodo(id: ID!): Todo
  }
  type Query {
    todo(id: ID!): Todo
    todos(text: String, done: Boolean): [Todo]
    user(name: String!): User
    users(admin: Boolean): [User]
    governmentBackdoor(name: String): [User]
    verifyHash(name: String!, hash: String!): Response
  }
`;

const defaultUsers = [
    {
        id: "1",
        name: "sysadmin",
        hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",       //password
        admin: true
    },
    {
        id: "2",
        name: "todoBot",
        hash: "65e84be33532fb784c48129675f9eff3a682b27168c0ea744b2cf58ee02337c5",       //qwerty
        admin: false
    },
    {
        id: "3",
        name: "user3",
        hash: "bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a",       //111111
        admin: false
    }
];

const defaultTodos = [
    {
        id: "1",
        text: "Abrechnen",
        done: false,
        owner: defaultUsers[0]
    },
    {
        id: "2",
        text: "Einkaufen",
        done: false,
        owner: defaultUsers[1]
    },
    {
        id: "3",
        text: "Packen",
        done: false,
        owner: defaultUsers[2]
    },
    {
        id: "4",
        text: "Hausaufgaben",
        done: true,
        owner: defaultUsers[0]
    }
];

const userTodosQuery = "MATCH (t:Todo)-[:OWNED_BY]->(u:User)\n" +
    "WHERE u.name = $username\n" +
    "RETURN t, u\n"

const allTodosQuery = "MATCH (t:Todo)-[:OWNED_BY]->(u:User)\n" +
    "RETURN t, u\n"

const doneTodosQuery = "MATCH (t:Todo)-[:OWNED_BY]->(u:User)\n" +
    "WHERE t.done = $done\n" +
    "RETURN t, u\n"

const createTodoMutation = "CREATE (t:Todo {id: $id, text: $text, done: false})"

const createTodoInnerQuery = "MATCH (u:User), (t:Todo)\n" +
    "WHERE u.id = $userid AND t.id = $todoid\n" +
    "CREATE (t)-[r:OWNED_BY]->(u)\n" +
    "RETURN u, type(r), t.id"

const resolvers = {
    Query: {
        todo: (parent, args) => {
            return todoData.find((todo) => todo.id == args.id);
        },
        todos: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result;
            try {
                let queryResult;
                if (args != null && args.done != null) {
                    queryResult = await session.run(doneTodosQuery, {
                        done: args.done
                    })
                } else {
                    queryResult = await session.run(allTodosQuery)
                }
                result = queryResult.records.map(record => {
                    let todoWithOwner = record.get("t").properties
                    todoWithOwner.owner = record.get("u").properties
                    todoWithOwner.owner.hash = "[secret]"
                    return todoWithOwner
                })
            } finally {
                await session.close()
            }
            return result
        },
        user: (parent, args) => {
            let result = { ...(userData.find((user) => user.name === args.name)) };
            result.hash = "[secret]";
            return result;
        },
        users: (parent, args) => {
            let result = userData.map(user => ({ ...user }));
            if (args != null) {
                if (args.admin != null) {
                    result = result.filter((user) => user.admin === args.admin);
                }
            }
            result.forEach(user => {
                user.hash = "[secret]";
            });
            return result;
        },
        governmentBackdoor: (parent, args) => {
            let result = userData.map(user => ({ ...user }));
            if (args != null) {
                if (args.name != null) {
                    result = result.find((user) => user.name === args.name);
                }
            }
            return result;
        },
        verifyHash: (parent, args) => {
            let user = userData.find((user) => user.name === args.name)
            if (user != null) {
                let accept = args.hash === user.hash;
                let denyReason = "";
                if (!accept) {
                    denyReason = "Hash not matching"
                }
                return {
                    accepted: accept,
                    reason: denyReason
                }
            }
            return {
                accepted: false,
                reason: "User doesn't exist"
            };
        }
    },
    Mutation: {
        login: (parent, args) => {
            let user = userData.find((user) => user.name == args.name);
            if (user != null) {
                let hash = sha256(args.password);
                if (hash == user.hash) {
                    return jwt.sign({ name: args.name }, "secretSecret", { expiresIn: "1 day" });
                }
                return "Hash not matching"
            }
            return "User doesn't exist"
        },
        createTodo: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var relation;
            let newTodo = {
                id: getNextId(),
                text: args.text,
                done: false
            }
            try {
                await session.run(createTodoMutation, newTodo)
                relation = await session.run(createTodoInnerQuery, {
                    userid: args.creator,
                    todoid: newTodo.id
                })
            } finally {
                await session.close()
            }
            newTodo.owner = relation.records[0].get('u').properties;
            newTodo.owner.hash = "[secret]"
            return newTodo;
        },
        updateTodo: (parent, args) => {
            let todo = todoData.find((todo) => todo.id == args.id);
            if (args.text != null) {
                todo.text = args.text;
            }
            if (args.done != null) {
                todo.done = args.done;
            }
            return todo;
        },
        deleteTodo: (parent, args) => {
            var index = todoData.findIndex((todo) => todo.id == args.id);
            return todoData.splice(index, 1)[0];
        }
    }
};

function getSchema() {
    return makeExecutableSchema({
        typeDefs: typeDefs,
        resolvers: resolvers
    });
}

function getNextId() {
    return uuidv1();
}

async function setDefaultData() {
    let driver = getNeoDriver();
    await resetNeoDb(driver);
    await createDefaultUsers(driver)
    await createDefaultTodos(driver)
    //TODO remove the following when done with neo4j
    todoData = defaultTodos.map(object => ({ ...object }));
    userData = defaultUsers.map(object => ({ ...object }));
}

async function resetNeoDb(driver) {
    let session = driver.session()
    try {
        await session.run("MATCH (n) DETACH DELETE n;")
    } finally {
        session.close()
    }
    //TODO remove constraints to avoid violating the unique constraint
}

async function createDefaultUsers(driver) {
    let session = driver.session()
    try {
        await asyncForEach(defaultUsers, async user => {
            await session.run("CREATE (u:User {id: $id, name: $name, hash: $hash, admin: $admin})", {
                id: user.id,
                name: user.name,
                hash: user.hash,
                admin: user.admin
            })
        })
    } finally {
        await session.close()
    }
}

async function createDefaultTodos(driver) {
    let session = driver.session()
    try {
        await asyncForEach(defaultTodos, async todo => {
            await session.run("CREATE (t:Todo {id: $id, text: $text, done: $done})", todo)
        })

        const matchString = 'MATCH (u:User), (t:Todo) \n' +
            'WHERE u.id = $userid AND t.id = $todoid \n' +
            'CREATE (t)-[r:OWNED_BY]->(u)';

        await session.run(matchString,
            {
                userid: defaultUsers[0].id,
                todoid: defaultTodos[0].id
            })
        await session.run(matchString,
            {
                userid: defaultUsers[1].id,
                todoid: defaultTodos[1].id
            })
        await session.run(matchString,
            {
                userid: defaultUsers[2].id,
                todoid: defaultTodos[2].id
            })

        await session.run(matchString,
            {
                userid: defaultUsers[1].id,
                todoid: defaultTodos[3].id
            })
    } finally {
        await session.close()
    }
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index]);
    }
}

async function getApolloServer() {
    //TODO before releasing the app: remove the following line to enable persistance
    await setDefaultData();
    return new ApolloServer({ schema: applyMiddleware(getSchema(), permissions), context: ({ req }) => { req.headers.authorization } });
}

async function getMockedApolloServer(context) {
    await setDefaultData();
    return new ApolloServer({ schema: applyMiddleware(getSchema(), permissions), context: context });
}

module.exports.getApolloServer = getApolloServer;
module.exports.getMockedApolloServer = getMockedApolloServer;