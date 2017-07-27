var apiKey = require('../config/sparkpost');
var SparkPost = require('sparkpost');
var client = new SparkPost(apiKey);


function send(req, res, vars) {

    var message = {
        recipients: [{address: vars.receiver}],
        content: {template_id: vars.template},
        substitution_data: {
            url: vars.url,
            username: vars.username
        }
    };

    client.transmissions.send(message)
        .then(data => {
        req.flash('info',vars.successMsg);
        res ? res.redirect(vars.redirect) : null;
})
    .catch(err => {
        console.log(err);
});

}

module.exports = send;
