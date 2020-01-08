const { ApolloServer, gql } = require('apollo-server');
const { makeExecutableSchema } = require('graphql-tools');
const sha256 = require('js-sha256');
const jwt = require('jsonwebtoken');
const permissions = require('./permissions.js');
const { applyMiddleware } = require('graphql-middleware');
const uuidv1 = require('uuid/v1');

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
  type Challenge {
      id: ID!
      text: String
      done: Boolean
      expires: Boolean
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
      createChallenge(creator: ID!, text: String): Challenge
      updateChallenge(id: ID!, text: String, done: Boolean): Challenge
      deleteChallenge(id: ID!): Challenge
  }
  type Query {
    todo(id: ID!): Todo
    todos(text: String, done: Boolean): [Todo]
    secondTodo: Todo
    challenge(id: ID!): Challenge
    challenges(text: String, done: Boolean): [Challenge]
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

const defaultChallenges = generateDefaultChallenges();

function generateDefaultChallenges() {
    let currentTime = Math.floor(Date.now() / 1000);
    return [
        {
            id: "1",
            text: "Party vorbereiten",
            done: false,
            expires: currentTime + 10,
            expired: false
        },
        {
            id: "2",
            text: "Blumen gießen",
            done: false,
            expires: currentTime + 3600,
            expired: false
        },
        {
            id: "3",
            text: "Lernen",
            done: true,
            expires: currentTime + 100,
            expired: false
        }
    ]
}

const challengeFromIdQuery = "MATCH (c:Challenge)-[:OWNED_BY]->(u:User)\n" +
    "WHERE c.id = $challengeid\n" +
    "RETURN c, u"

const allChallengesQuery = "MATCH (c:Challenge)-[:OWNED_BY]->(u:User)\n" +
    "RETURN c, u\n"

const doneChallengesQuery = "MATCH (c:Challenge)-[:OWNED_BY]->(u:User)\n" +
    "WHERE c.done = $done\n" +
    "RETURN c, u\n"

const todoFromIdQuery = "MATCH (t:Todo)-[:OWNED_BY]->(u:User)\n" +
    "WHERE t.id = $todoid\n" +
    "RETURN t, u"

const todoThatsSecond = "MATCH (t:Todo)-[:OWNED_BY]->(u:User)\n" +
    "RETURN t, u \n" +
    "ORDER BY t.id ASC\n" +
    "SKIP 1\n" +
    "LIMIT 1"

const allTodosQuery = "MATCH (t:Todo)-[:OWNED_BY]->(u:User)\n" +
    "RETURN t, u\n"

const doneTodosQuery = "MATCH (t:Todo)-[:OWNED_BY]->(u:User)\n" +
    "WHERE t.done = $done\n" +
    "RETURN t, u\n"

const userById = "MATCH (u:User)\n" +
    "WHERE u.name = $name\n" +
    "RETURN u"

const allUsers = "MATCH (u:User)\n" +
    "RETURN u"

const allAdminUsers = "MATCH (u:User)\n" +
    "WHERE u.admin = $admin\n" +
    "RETURN u"

const allUsersByName = "MATCH (u:User)\n" +
    "WHERE u.name = $name\n" +
    "RETURN u"

const createTodoMutation = "CREATE (t:Todo {id: $id, text: $text, done: false})"

const createTodoInnerQuery = "MATCH (u:User), (t:Todo)\n" +
    "WHERE u.id = $userid AND t.id = $todoid\n" +
    "CREATE (t)-[r:OWNED_BY]->(u)\n" +
    "RETURN u, type(r), t.id"

const updateTodoMutation = "MERGE (t:Todo {id: $id})-[:OWNED_BY]->(u:User) \n" +
    "ON MATCH SET t.text = case when $text IS NULL then t.text else $text end, t.done = case when $done IS NULL then t.done else $done end \n" +
    "ON CREATE SET t.id = $id, t.text = $text, t.done = $done\n" +
    "RETURN t, u"

const deleteTodoMutation = "MATCH (t:Todo)-[:OWNED_BY]->(u:User) \n" +
    "WHERE t.id = $id\n" +
    "WITH t, u, properties(t) as p\n" +
    "DETACH DELETE t\n" +
    "RETURN p, u"

const createChallengeMutation = "CREATE (c:Challenge {id: $id, text: $text, done: false, expires: $expires})"

const createChallengeInnerQuery = "MATCH (u:User), (c:Challenge)\n" +
    "WHERE u.id = $userid AND c.id = $challengeid\n" +
    "CREATE (c)-[r:OWNED_BY]->(u)\n" +
    "RETURN u, type(r), c.id"

const updateChallengeMutation = "MERGE (c:Challenge {id: $id})-[:OWNED_BY]->(u:User) \n" +
    "ON MATCH SET c.text = case when $text IS NULL then c.text else $text end, c.done = case when $done IS NULL then c.done else $done end \n" +
    "ON CREATE SET c.id = $id, c.text = $text, c.done = $done\n" +
    "RETURN c, u"

const deleteChallengeMutation = "MATCH (c:Challenge)-[:OWNED_BY]->(u:User) \n" +
    "WHERE c.id = $id\n" +
    "WITH c, u, properties(c) as p\n" +
    "DETACH DELETE c\n" +
    "RETURN p, u"


const resolvers = {
    Query: {
        todo: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result
            try {
                let queryResult = await session.run(todoFromIdQuery, {
                    todoid: args.id
                })
                let todoWithOwner = queryResult.records[0].get("t").properties
                todoWithOwner.owner = queryResult.records[0].get("u").properties
                todoWithOwner.owner.hash = "[secret]"
                result = todoWithOwner
            } finally {
                await session.close()
            }
            return result
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
        challenge: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result
            try {
                let queryResult = await session.run(challengeFromIdQuery, {
                    challengeid: args.id
                })
                let challengeWithOwner = queryResult.records[0].get("c").properties
                challengeWithOwner.owner = queryResult.records[0].get("u").properties
                challengeWithOwner.owner.hash = "[secret]"
                result = challengeWithOwner
            } finally {
                await session.close()
            }
            return result
        },
        challenges: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result;
            try {
                let queryResult;
                if (args != null && args.done != null) {
                    queryResult = await session.run(doneChallengesQuery, {
                        done: args.done
                    })
                } else {
                    queryResult = await session.run(allChallengesQuery)
                }
                result = queryResult.records.map(record => {
                    let challengeWithOwner = record.get("c").properties
                    challengeWithOwner.owner = record.get("u").properties
                    challengeWithOwner.owner.hash = "[secret]"
                    return challengeWithOwner
                })
            } finally {
                await session.close()
            }
            return result
        },
        secondTodo: async () => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result;
            try {
                let queryResult = await session.run(todoThatsSecond)
                let todoWithOwner = queryResult.records[0].get("t").properties
                todoWithOwner.owner = queryResult.records[0].get("u").properties
                todoWithOwner.owner.hash = "[secret]"
                result = todoWithOwner
            } finally {
                await session.close()
            }
            return result
        },
        user: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result
            try {
                let queryResult = await session.run(userById, {
                    name: args.name
                })
                result = queryResult.records[0].get("u").properties
                result.hash = "[secret]"
            }
            finally {
                await session.close()
            }
            return result
        },
        users: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result
            try {
                let queryResult
                if (args != null && args.admin == null) {
                    queryResult = await session.run(allUsers)
                } else {
                    queryResult = await session.run(allAdminUsers, {
                        admin: args.admin
                    })
                }
                result = queryResult.records.map(record => {
                    let tempResult = record.get("u").properties
                    tempResult.hash = "[secret]"
                    return tempResult
                })
            }
            finally {
                await session.close()
            }
            return result
        },
        governmentBackdoor: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var result
            try {
                var queryResult
                if (args != null) {
                    if (args.name == null) {
                        queryResult = await session.run(allUsers)
                    } else {
                        queryResult = await session.run(allUsersByName, {
                            name: args.name
                        })
                    }
                    result = queryResult.records.map(record => {
                        return record.get("u").properties
                    })
                }
            }
            finally {
                await session.close()
            }
            return result
        },
        verifyHash: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var queryResult
            let denyReason = ""
            let accept = false
            try {
                queryResult = await session.run(allUsersByName, {
                    name: args.name
                })
                if (queryResult.records[0] == null) {
                    denyReason = "User doesn't exist"
                } else {
                    queryResult.records.map(record => {
                        if (record.get("u").properties.hash == args.hash) {
                            accept = true
                            denyReason = ""
                            return record
                        } else {
                            denyReason = "Hash not matching"
                        }
                    })
                }
            } finally {
                await session.close()
            }
            return {
                accepted: accept,
                reason: denyReason
            }
        }
    },
    Mutation: {
        login: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var queryResult
            try {
                queryResult = await session.run(allUsersByName, {
                    name: args.name
                })
                if (queryResult.records[0] == null) {
                    return "User doesn't exist"
                } else if (queryResult.records[0].get("u").properties.hash === sha256(args.password)) {
                    return jwt.sign({ name: args.name }, "secretSecret", { expiresIn: "1 day" });
                } else {
                    return "Hash not matching"
                }
            } finally {
                await session.close()
            }
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
        updateTodo: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var queryResult
            try {
                let targetDone, targetText;
                if (args.done == undefined) {
                    targetDone = null
                } else {
                    targetDone = args.done
                }
                if (args.text == undefined) {
                    targetText = null
                } else {
                    targetText = args.text
                }
                queryResult = await session.run(updateTodoMutation, {
                    id: args.id,
                    text: targetText,
                    done: targetDone
                })
            } finally {
                session.close()
            }
            let todo = queryResult.records[0].get("t").properties
            todo.owner = queryResult.records[0].get("u").properties
            if (todo.owner != null) {
                todo.owner.hash = "[secret]"
            }
            return todo
        },
        deleteTodo: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var relation;
            try {
                relation = await session.run(deleteTodoMutation, {
                    id: args.id
                })
                let oldTodo = relation.records[0].get('p')
                oldTodo.owner = relation.records[0].get('u').properties
                oldTodo.owner.hash = "[secret]"
                return oldTodo
            } finally {
                await session.close()
            }
        },
        createChallenge: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var relation;
            let currentTime = Math.floor(Date.now() / 1000);
            let newChallenge = {
                id: getNextId(),
                text: args.text,
                done: false,
                expires: currentTime + 3600
            }
            try {
                await session.run(createChallengeMutation, newChallenge)
                relation = await session.run(createChallengeInnerQuery, {
                    userid: args.creator,
                    challengeid: newChallenge.id
                })
            } finally {
                await session.close()
            }
            newChallenge.owner = relation.records[0].get('u').properties;
            newChallenge.owner.hash = "[secret]"
            return newChallenge;
        },
        updateChallenge: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var queryResult
            try {
                let targetDone, targetText;
                if (args.done == undefined) {
                    targetDone = null
                } else {
                    targetDone = args.done
                }
                if (args.text == undefined) {
                    targetText = null
                } else {
                    targetText = args.text
                }
                queryResult = await session.run(updateChallengeMutation, {
                    id: args.id,
                    text: targetText,
                    done: targetDone
                })
            } finally {
                session.close()
            }
            let challenge = queryResult.records[0].get("c").properties
            challenge.owner = queryResult.records[0].get("u").properties
            if (challenge.owner != null) {
                challenge.owner.hash = "[secret]"
            }
            return challenge
        },
        deleteChallenge: async (parent, args) => {
            let driver = getNeoDriver()
            let session = driver.session()
            var relation;
            try {
                relation = await session.run(deleteChallengeMutation, {
                    id: args.id
                })
                let oldChallenge = relation.records[0].get('p')
                oldChallenge.owner = relation.records[0].get('u').properties
                oldChallenge.owner.hash = "[secret]"
                return oldChallenge
            } finally {
                await session.close()
            }
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
    await createDefaultChallenges(driver)
}

async function resetNeoDb(driver) {
    let session = driver.session()
    try {
        await session.run("MATCH (n) DETACH DELETE n;")
    } finally {
        session.close()
    }
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

async function createDefaultChallenges(driver) {
    let session = driver.session()
    try {
        await asyncForEach(defaultChallenges, async challenge => {
            await session.run("CREATE (c:Challenge {id: $id, text: $text, done: $done, expires: $expires})", challenge)
        })

        const matchString = 'MATCH (u:User), (c:Challenge) \n' +
            'WHERE u.id = $userid AND c.id = $challengeid \n' +
            'CREATE (c)-[r:OWNED_BY]->(u)';

        await session.run(matchString,
            {
                userid: defaultUsers[0].id,
                challengeid: defaultChallenges[0].id
            })
        await session.run(matchString,
            {
                userid: defaultUsers[1].id,
                challengeid: defaultChallenges[1].id
            })
        await session.run(matchString,
            {
                userid: defaultUsers[1].id,
                challengeid: defaultChallenges[2].id
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
    //TODO before releasing the app: remove the following line to enable persistance (it was disabled for debugging purposes)
    await setDefaultData();
    return new ApolloServer({ schema: applyMiddleware(getSchema(), permissions), context: ({ req }) => { req.headers.authorization } });
}

async function getMockedApolloServer(context) {
    await setDefaultData();
    return new ApolloServer({ schema: applyMiddleware(getSchema(), permissions), context: context });
}

module.exports.getApolloServer = getApolloServer;
module.exports.getMockedApolloServer = getMockedApolloServer;