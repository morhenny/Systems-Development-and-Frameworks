import gql from 'graphql-tag';
const { createTestClient } = require('apollo-server-testing');
const { getMockedApolloServer } = require('./apollo.js');

const singleTodoQuery = gql`
	query GetTodoQuery($id: ID!) {
		todo(id: $id) {
			id
            text
            done
		}
	}
`;

const allTodosQuery = gql`
	query GetAllTodosQuery {
		todos {
			id
			text
            done
            owner {
                id
                name
                hash
                admin
            }
		}
	}
`;

const doneTodosQuery = gql`
	query GetDoneTodosQuery($done: Boolean) {
		todos(done: $done) {
			id
			text
            done
            owner {
                id
                name
                hash
                admin
            }
		}
	}
`;

const allUsersQuery = gql`
	query GetAllUsersQuery($admin: Boolean) {
		users(admin: $admin) {
			id
            name
            hash
			admin
		}
	}
`;

const singleUserQuery = gql`
	query GetUserQuery($name: String!) {
		user(name: $name) {
			id
            name
            hash
            admin
		}
	}
`;

const governmentQuery = gql`
	query GetGvmtQuery($name: String) {
		governmentBackdoor(name: $name) {
			id
            name
            hash
            admin
		}
	}
`;

const verificationQuery = gql`
	query VerifyHashQuery($name: String!, $hash: String!) {
		verifyHash(name: $name, hash: $hash) {
            accepted
            reason
		}
	}
`;

const loginMutation = gql`
	mutation login($name: String!, $password: String!){
		login(name: $name, password: $password)
	}
`;

const createTodoMutation = gql`
	mutation createTodoMutation($creator: ID!, $text: String) {
		createTodo(creator: $creator, text: $text) {
            id
            text
            done
            owner {
			    id
                name
                hash
                admin
            }
		}
	}
`;

const updateTodoMutation = gql`
	mutation updateTodoMutation($id: ID!, $text: String, $done: Boolean) {
		updateTodo(id: $id, text: $text, done: $done) {
			id
            text
            done
        }
    }
`;

const deleteTodoMutation = gql`
	mutation deleteTodoMutation($id: ID!) {
		deleteTodo(id: $id) {
			id
            text
            done
		}
	}
`;

function expectNoError(result) {
    expect(result.errors).toBe(undefined);
    return result;
}

describe('Queries for Todos', () => {
    let query;
    beforeEach(async () => {
        const testServer = await getMockedApolloServer();
        const testClient = createTestClient(testServer);
        query = testClient.query;
        const currentTodos = expectNoError(await query({
            query: allTodosQuery,
        }));
    });

    it('Query all Todos', async () => {
        const result = expectNoError(await query({
            query: allTodosQuery,
        }));
        expect(result.data.todos.length).toBe(4);
        result.data.todos.forEach(todo => {
            expect(todo.owner).toBeDefined()
            expect(todo.owner.id).toBeDefined()
            expect(todo.owner.name).toBeDefined()
            expect(todo.owner.hash).toEqual("[secret]")
            expect(todo.owner.admin).toBeDefined()
        });
    });

    it('Query done Todos', async () => {
        const currentTodos = expectNoError(await query({
            query: allTodosQuery,
        }));
        const result = expectNoError(await query({
            query: doneTodosQuery,
            variables: { done: true },
        }));
        expect(result.data.todos).toMatchObject([{ done: true }]);
        expect(result.data.todos.length).toBeGreaterThan(0);
        result.data.todos.forEach(todo => {
            expect(todo.owner).toBeDefined()
            expect(todo.owner.id).toBeDefined()
            expect(todo.owner.name).toBeDefined()
            expect(todo.owner.hash).toEqual("[secret]")
            expect(todo.owner.admin).toBeDefined()
        });
    });

    it('Query single Todo by id', async () => {
        const result = expectNoError(await query({
            query: singleTodoQuery,
            variables: { id: 1 },
        }));
        expect(result.data.todo).toMatchObject({
            id: "1",            //The GraphQL-type 'ID' is converted to string
            text: "Abrechnen",
            done: false
        });
    });
});

describe('Queries for Users', () => {
    let query;
    beforeEach(async () => {
        const testServer = await getMockedApolloServer();
        const testClient = createTestClient(testServer);
        query = testClient.query;
    });

    it('Query all Users', async () => {
        const result = expectNoError(await query({
            query: allUsersQuery,
        }));
        expect(result.data.users.length).toBe(3);
        expect(result.data.users).toMatchObject(Array(result.data.users.length).fill({ hash: "[secret]" }));
    });

    it('Query single user by name', async () => {
        const result = expectNoError(await query({
            query: singleUserQuery,
            variables: { name: "sysadmin" },
        }));
        expect(result.data.user).toMatchObject({
            id: "1",
            name: "sysadmin",
            hash: "[secret]",
            admin: true
        });
    });

    it('Query hash verification', async () => {
        const result = expectNoError(await query({
            query: verificationQuery,
            variables: {
                name: "sysadmin",
                hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
            }
        }));
        expect(result.data.verifyHash).toMatchObject({
            accepted: true,
            reason: ""
        });
    });

    it('Query hash verification with wrong hash', async () => {
        const result = expectNoError(await query({
            query: verificationQuery,
            variables: {
                name: "sysadmin",
                hash: "clearlythewronghash"
            }
        }));
        expect(result.data.verifyHash).toMatchObject({
            accepted: false,
            reason: "Hash not matching"
        });
    });

    it('Query hash verification with wrong username', async () => {
        const result = expectNoError(await query({
            query: verificationQuery,
            variables: {
                name: "sadmin",
                hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
            }
        }));
        expect(result.data.verifyHash).toMatchObject({
            accepted: false,
            reason: "User doesn't exist"
        });
    });
});

describe('Mutations for Todos', () => {
    let query;
    let mutate;

    beforeEach(async () => {
        const testServer = await getMockedApolloServer();
        const testClient = createTestClient(testServer);
        query = testClient.query;
        mutate = testClient.mutate;
    });

    it('Create a Todo', async () => {
        const result = expectNoError(await mutate({
            mutation: createTodoMutation,
            variables: {
                text: "Duschen",
                creator: "2"
            }
        }));
        expect(result.data.createTodo).toMatchObject({
            text: "Duschen",
            done: false
        });
        expect(result.data.createTodo.owner).toBeDefined()
        expect(result.data.createTodo.owner.id).toBeDefined()
        expect(result.data.createTodo.owner.name).toBeDefined()
        expect(result.data.createTodo.owner.hash).toEqual("[secret]")
        expect(result.data.createTodo.owner.admin).toBeDefined()
    });

    it('Update a Todo text', async () => {
        const result = expectNoError(await mutate({
            mutation: updateTodoMutation,
            variables: { id: "2", text: "Bei [Supermarkt] einkaufen" }
        }));

        expect(result.data.updateTodo).toMatchObject({
            id: "2",
            text: "Bei [Supermarkt] einkaufen",
            done: false
        });
    });

    it('Mark a Todo as done', async () => {
        const result = expectNoError(await mutate({
            mutation: updateTodoMutation,
            variables: { id: "1", done: true }
        }));

        expect(result.data.updateTodo).toMatchObject({
            id: "1",
            text: "Abrechnen",
            done: true
        });
    });

    it('Delete a Todo', async () => {
        const result = expectNoError(await mutate({
            mutation: deleteTodoMutation,
            variables: { id: 4 }
        }));
        expect(result.data.deleteTodo).toMatchObject({
            id: "4",
            text: "Hausaufgaben",
            done: true
        });

        const resultAllTodos = expectNoError(await query({
            query: allTodosQuery,
        }));
        expect(resultAllTodos.data.todos.length).toBe(4);
        expect(resultAllTodos.data.todos).not.toEqual(expect.arrayContaining([expect.objectContaining({
            id: "40"
        })]));
    });
});

describe('Queries and Mutations with login', () => {
    let query;
    beforeEach(async () => {
        const loginServer = await getMockedApolloServer();
        const loginClient = createTestClient(loginServer);
        const loginResult = expectNoError(await loginClient.mutate({
            mutation: loginMutation,
            variables: { name: "sysadmin", password: "password" }
        }));
        expect(loginResult.data.login).not.toBe("Hash not matching");
        expect(loginResult.data.login).not.toBe("User doesn't exist");
        const testServer = await getMockedApolloServer(() => { return { token: loginResult.data.login } });
        const testClient = createTestClient(testServer);
        query = testClient.query;
    });

    it('Query backdoor', async () => {
        const result = expectNoError(await query({
            query: governmentQuery,
        }));
        expect(result.data.governmentBackdoor).toMatchObject([
            { hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" },
            { hash: "65e84be33532fb784c48129675f9eff3a682b27168c0ea744b2cf58ee02337c5" },
            { hash: "bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a" }
        ]);
    });
});