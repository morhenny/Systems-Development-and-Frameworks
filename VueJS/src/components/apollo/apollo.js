const { ApolloServer, gql } = require('apollo-server');
const { makeExecutableSchema } = require('graphql-tools');
const sha256 = require('js-sha256');
const jwt = require('jsonwebtoken');
const permissions = require('./permissions.js');
const { applyMiddleware } = require('graphql-middleware');

let todoData;
let userData;

const typeDefs = gql`
  type Todo {
      id: ID!
      text: String
      done: Boolean
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
      createTodo(text: String): Todo
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

const defaultTodos = [
    {
        id: 1,
        text: "Abrechnen",
        done: false
    },
    {
        id: 2,
        text: "Einkaufen",
        done: false
    },
    {
        id: 3,
        text: "Packen",
        done: false
    },
    {
        id: 4,
        text: "Hausaufgaben",
        done: true
    }
];

const defaultUsers = [
    {
        id: 1,
        name: "sysadmin",
        hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",       //password
        admin: true
    },
    {
        id: 2,
        name: "todoBot",
        hash: "65e84be33532fb784c48129675f9eff3a682b27168c0ea744b2cf58ee02337c5",       //qwerty
        admin: false
    },
    {
        id: 3,
        name: "user3",
        hash: "bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a",       //111111
        admin: false
    }
];

const resolvers = {
    Query: {
        todo: (parent, args) => {
            return todoData.find((todo) => todo.id == args.id);
        },
        todos: (parent, args) => {
            let result = todoData.map(todo => ({ ...todo }));
            if (args != null) {
                if (args.text != null) {
                    result = result.filter((todo) => todo.text === args.text);
                }
                if (args.done != null) {
                    result = result.filter((todo) => todo.done === args.done);
                }
            }
            return result;
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
        createTodo: (parent, args) => {
            todoData.push({
                id: getNextId(),
                text: args.text,
                done: false
            });
            return todoData[todoData.length - 1];
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
    let newId = 0;
    var todo;
    do {
        newId++;
        todo = todoData.find((todo) => todo.id == newId);
    } while (todo != null)
    return newId;
}

function setDefaultData() {
    todoData = defaultTodos;
    userData = defaultUsers;
}

function getApolloServer() {
    setDefaultData();
    return new ApolloServer({ schema: applyMiddleware(getSchema(), permissions), context: ({ req }) => { req.headers.authorization } });
}

function getMockedApolloServer(context) {
    setDefaultData();
    return new ApolloServer({ schema: applyMiddleware(getSchema(), permissions), context: context });
}

module.exports.getApolloServer = getApolloServer;
module.exports.getMockedApolloServer = getMockedApolloServer;