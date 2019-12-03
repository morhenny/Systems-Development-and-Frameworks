const { getApolloServer } = require('./apollo.js');

const server = getApolloServer();

server.listen().then(({ url }) => {
    console.log(`Apollo Server ready at ${url}`);
});