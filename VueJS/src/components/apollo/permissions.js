const { rule, shield } = require('graphql-shield');
const jwt = require('jsonwebtoken');
const secret = "secretSecret";

var isVerified = rule()(async (parent, args, ctx) => {
    var verified = false;
    try {
        var decoded = jwt.verify(ctx.token, secret);
        verified = decoded != null;
    }
    catch (exception) {
		// eslint-disable-next-line no-console
        console.log(exception);
    }
    return verified;
})

const permissions = shield({
    Query: {
        governmentBackdoor: isVerified
    }
})

module.exports = permissions;