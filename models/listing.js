var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var listingSchema = new Schema({
	profpic_url: {type: String},
	username: {type: String, required: true, trim: true},
	paypal: {type: String, required: true, trim: true},
	user_rep: {type: Number, required: true},
	email: {type: String, required: true, trim: true},
	price: {type: Number, required: true, trim: true},
	category: {type: String, required: true},
	description: {type: String, required: true},
	expiration_date: {type: Date, default: Date.now() + 90 * 24 * 3600 * 1000}, //expire in 90 days
	title: {type: String, required: true},
	condition: {type: Number, max:10, min:1, trim: true},
	listing_date: {type: Date, default: Date.now()},
	listing_updated: {type: Date, required: true, default: Date.now()},
	listing_status: {type: String, required: true, trim: true},
	listing_image_url: {type: String},
	listing_images: [String],
	status: {
		shipped: {
			shipped: false,
			date: {type: Date},
			tracking: {type: String},
			received: false
		},
		expired: false,
		sold: false,
		sellDate: {type: Date},
		buyer: {type: String},
		soldPrice: {type: Number},
		buyerInfo:{
			name: {type: String},
			street: {type: String},
			city: {type: String},
			state: {type: String},
			zip: {type: Number}
		}
	}
});	


module.exports = mongoose.model('Listing', listingSchema);