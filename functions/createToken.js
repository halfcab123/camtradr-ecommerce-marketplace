var crypto = require('crypto');

var getToken = function(){
    return crypto.randomBytes(20).toString('hex');
};

module.exports = getToken;