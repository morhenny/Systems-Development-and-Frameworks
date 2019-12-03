const { rule, and, or, not, shield } = require('graphql-shield');
const jwt = require('jsonwebtoken');
const secret = "secretSecret";

var isVerified = rule()(async (parent, args, ctx, info) => {
    var verified = false;
    try {
        var decoded = jwt.verify(ctx.token, secret);
        verified = decoded != null;
    }
    catch (exception) {
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