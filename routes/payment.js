var paypal = require('paypal-rest-sdk');
var paypalConfig = require('../config/paypal');
var Listing = require('../models/listing');
var payment_details = require('../config/payment_details');
var create_payment_json;


exports.create = function(req, res, sess) {

    Listing.findById(req.params.product,function(err, listing) {

        create_payment_json = payment_details.getJson(
            listing.title,
            listing._id,
            listing.price,
            listing.paypal,
            listing.price,
            listing.title
        );

        sess.create_payment_json = create_payment_json;

        paypal.payment.create(create_payment_json, function (error, payment) {
                var links = {};

                if(error){
                    console.error(JSON.stringify(error));
                } else {
                    // Capture HATEOAS links
                    payment.links.forEach(function(linkObj){
                        links[linkObj.rel] = {
                            href: linkObj.href,
                            method: linkObj.method
                        };
                    });

                    // If redirect url present, redirect user
                    if (links.hasOwnProperty('approval_url')){
                        res.redirect(links['approval_url'].href);
                    } else {
                        console.error('no redirect URI present');
                    }
                }
            });

    });

};

exports.execute = function(req, res, sess) {

    var shipping = '';

    var paymentId = req.query.paymentId;
    var payerId = { payer_id: req.query.PayerID };

    paypal.payment.execute(paymentId, payerId, function(error, payment){
        if(error){
            console.error(JSON.stringify(error));
        } else {

            shipping = payment.payer.payer_info.shipping_address;

            if (payment.state === 'approved'){

                Listing.findById(sess.create_payment_json.transactions[0].item_list.items[0].sku,
                    function(err, listing) {
                        listing.status.sellDate = payment.create_time;
                        listing.status.sold = true;
                        listing.status.expired = false;
                        listing.status.buyer = req.user.username;
                        listing.status.soldPrice = payment.transactions[0].amount.total;
                        listing.status.buyerInfo.name = shipping.recipient_name;
                        listing.status.buyerInfo.street = shipping.line1 + ' ' + shipping.line2 ? shipping.line2 : '';
                        listing.status.buyerInfo.city = shipping.city;
                        listing.status.buyerInfo.zip = shipping.postal_code;
                        listing.status.buyerInfo.state = shipping.state;
                        listing.save();
                        res.render('user/buy_success',{
                            username: req.user.username
                        });
                    }
                );

            } else {
                res.send('Payment Failed! :/ - Contact Support');
            }
        }
    });

};

exports.cancel = function(req, res){
    res.send("The payment got canceled");
};

exports.init = function(){
    paypal.configure(paypalConfig);
};
