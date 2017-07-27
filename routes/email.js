var nodemailer = require('nodemailer');
var async = require('async');
var crypto = require('crypto');
var User = require('../models/user'); //user model

async.waterfall([
    function(done) {
        crypto.randomBytes(20, function(err, buf) {
            var token = buf.toString('hex');
            done(err, token);
        });
    },
    function(token, done) {
        User.findOne({ email: req.body.email }, function(err, user) {
            if (!user) {
                var messages = req.flash('error', 'No account with that email address exists.');
                return res.redirect('/forgot');
            }

            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

            user.save(function(err) {
                done(err, token, user);
            });
        });
    }
], function(err) {
    if (err) return next(err);
    req.flash('error', err);
    res.redirect('/forgot');
});

