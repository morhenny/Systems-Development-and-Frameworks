const { getApolloServer } = require('./apollo.js');

getApolloServer().then(server => {
    server.listen().then(({ url }) => {
        // eslint-disable-next-line no-console
        console.log(`Apollo Server ready at ${url}`);
    });
});