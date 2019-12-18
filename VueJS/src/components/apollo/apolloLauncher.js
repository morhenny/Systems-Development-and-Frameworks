const { getApolloServer } = require('./apollo.js');

const server = getApolloServer();

server.listen().then(({ url }) => {
	// eslint-disable-next-line no-console
    console.log(`Apollo Server ready at ${url}`);
});