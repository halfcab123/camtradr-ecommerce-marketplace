var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var userSchema = new Schema({
	confirmed: false,
	accountConfirmationToken: String,
	accountConfirmationExpires: Date,
	profpic_url: {type: String},
	profPic_id: {type: String},
	firstname: {type: String, required: true},
	lastname: {type: String, required: true},
	username: {type: String, required: true},
	email: {type: String, required: true},
	paypal: {type: String, required: true},
	password: {type: String, required: true},
	resetPasswordToken: String,
  	resetPasswordExpires: Date,
  	reputation: {type: Number, default: 0},
	sales: {type: Number, default: 0},
	reviews: [],
	/*
		date: {type: Date}
		user: {type: String}
		item: {type: String}
		review: {type: String}
		stars: {type: Number}
	 */
	blocked: [],
		/*
			user: {type: String}
		 */
	messages: []
		/*
		{
			_id: {type: String}
			from: {type: String}
			subject: {type: String}
			message: {type: String}
			new: {type: Boolean}
		 */
});

userSchema.methods.encryptPassword = function(password) {
	return bcrypt.hashSync(password, bcrypt.genSaltSync(7), null);
};

userSchema.methods.validPassword = function(password) {
	return bcrypt.compareSync(password, this.password);
};

userSchema.methods.removeResetToken = function() {
	this.resetPasswordExpires = undefined;
	this.resetPasswordToken = undefined;
};

module.exports = mongoose.model('User', userSchema);