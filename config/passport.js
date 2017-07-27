var passport = require('passport');
var User = require('../models/user');
var LocalStrategy = require('passport-local').Strategy;
var createToken = require('../functions/createToken');
var sendMessage = require('../functions/sendMessage');

passport.serializeUser(function(user, done) {
	done(null, user.id);
});

passport.deserializeUser(function(id, done) {
	User.findById(id, function(err, user) {
		done(err, user);
	});
});

passport.use('local.signup', new LocalStrategy({
	usernameField: 'username',
	passwordField: 'password',
	passReqToCallback: true
}, function(req, username, password, done) {
	req.checkBody('firstname', 'Invalid name').notEmpty();
	req.checkBody('lastname', 'Invalid last name').notEmpty();
	req.checkBody('email', 'Invalid email').notEmpty().isEmail();
	req.checkBody('paypal', 'Invalid Paypal E-mail').notEmpty().isEmail();
	req.checkBody('username','Invalid username').notEmpty();
	req.checkBody('password', 'Invalid password').notEmpty().isLength({min:8});
	var errors = req.validationErrors();
	if (errors) {
		var messages = [];
		errors.forEach(function(error) {
			messages.push(error.msg);
		});
		return done(null, false, req.flash('error', messages));
	}

	User.findOne({'email': req.body.email}, function(err,user) {
		if (err) {
			return done(err);
		}
		if (user) {
			return done(null, false, {message: 'Email is already in use.' });
		}

		User.findOne({'username': username}, function(err,user){
			if (err){
				return done(err);
			}
			if (user) {
				return done(null, false, {message: 'Username is already taken' });
			}
			var newUser = new User();
			newUser.accountConfirmationToken = createToken();
			newUser.accountConfirmationExpires = Date.now() + 3600000;
			newUser.firstname = req.body.firstname;
			newUser.lastname = req.body.lastname;
			newUser.username = username;
			newUser.email = req.body.email;
			newUser.password = newUser.encryptPassword(password);
			newUser.paypal = req.body.paypal;
			newUser.save(function(err, result) {
			if (err) {
				return done(err);
			}
			sendMessage(req, null, {
				successMsg: 'Your Account has been activated!',
				receiver: newUser.email,
				username: newUser.username,
				template: 'account-confirmation', //account confirmation
				url: 'http://' + req.headers.host + '/account_confirmation/' + newUser.accountConfirmationToken
			});
			return done(null, newUser);
		});
		});
	});
}));

passport.use('local.signin', new LocalStrategy({
	usernameField: 'username',
	passwordField: 'password',
	passReqToCallback: true
}, function(req,username,password,done) {
	req.checkBody('username', 'Username field is empty').notEmpty();
	req.checkBody('password', 'Password is invalid').notEmpty().isLength({min:8});
	var errors = req.validationErrors();
	if (errors) {
		var messages = [];
		errors.forEach(function(error) {
			messages.push(error.msg);
		});
		return done(null, false, req.flash('error', messages));
	}
	User.findOne({username : username}, function(err,user) {
	if (err) {
		return done(err);
	}
	if (!user) {
		return done(null, false, {message: 'Username not found.' });
	}
	if (!(user.validPassword(password)) ) {
		return done(null, false, {message: "Wrong password"});
	}
	return done(null, user);
	});
}));