var express = require('express');
var multer = require('multer');
var router = express.Router();
var csrf = require('csurf');
var passport = require('passport');
var async = require('async');
var crypto = require('crypto');
var User = require('../models/user'); //user model
var Listing = require('../models/listing'); //listing model
var bcrypt = require('bcrypt-nodejs');
var cloudinary = require('cloudinary');
var cloudinaryStorage = require('multer-storage-cloudinary');
var cloudinary_config = require('../config/cloudinary');
var sanitizeHtml = require('sanitize-html');
var payment = require('./payment');
var sendMessage = require('../functions/sendMessage');


//cloudinary configuration
cloudinary.config(cloudinary_config);

var csrfProtection = csrf();
router.use(csrfProtection);

var profPicStorage = cloudinaryStorage({
    cloudinary: cloudinary,
    folder: 'profpics',
    allowedFormats: ['jpg', 'png'],
    filename: function (req, file, cb) {
        cloudinary.uploader.destroy(req.user.profPic_id, function(result) { console.log(result) });
        cb(undefined, req.user.username + '_profpic_' + Date.now() + parseInt(Math.random() * 99999999).toString(36));
    },
    transformation: { width: 300, height: 300, crop: 'thumb', gravity: 'faces' },
    limits: { fileSize: 1 * 1000 * 1000}
});

var prodPicStorage = cloudinaryStorage({
    cloudinary: cloudinary,
    folder: 'prodpics',
    allowedFormats: ['jpg', 'png'],
    filename: function (req,file,cb) {

            cb(undefined, req.user.username + '_prodpic_' + Date.now() + parseInt(Math.random() * 99999999).toString(36));

    }
});


var uploadingProfPic = multer({
    storage: profPicStorage,
    limits: { fileSize: 1 * 1000 * 1000 }
});
var uploadingProdPics = multer({
    storage: prodPicStorage
});

//paypal payment routes
payment.init();
router.get('/create', isLoggedIn, payment.create);
router.get('/execute', isLoggedIn, payment.execute);
router.get('/cancel', isLoggedIn, payment.cancel);
//paypal payment routes

/* GET home page. */
router.get('/', function(req, res, next) {

  res.render('shop/index', {
  	 title: 'Camtradr',
      msgCount:(req.user) ? req.user.messages.length : null,
     username: (req.user) ? req.user.username : null });
});


router.get('/signup', function(req,res,next) {
	if ( res.locals.login ) {
		res.redirect('/profile');
	} else {
		var messages = req.flash('error');
		res.render('user/signup', {
		    csrfToken: req.csrfToken(),
            messages: messages,
            hasErrors: messages.length > 0
		});
	}
});

router.post('/signup', passport.authenticate('local.signup', {
	successRedirect: '/profile',
	failureRedirect: '/signup',
	failureFlash: true
}));

router.post('/resend_confirmation', isLoggedIn, function(req,res,next){

    if(req.user.confirmed){
        req.flash('info','Account already activated!');
        res.redirect('/profile')
    }else {
        req.user.accountConfirmationToken = createToken();
        req.user.accountConfirmationExpires = Date.now + 3600000;
        req.user.save(function(err,result){
            sendMessage(req, null, {
                successMsg: 'Your Account has been activated!',
                receiver: req.user.email,
                username: req.user.username,
                template: 'account-confirmation', //account confirmation
                url: 'http://' + req.headers.host + '/account_confirmation/' + newUser.accountConfirmationToken
            });
        });

    }
});

router.get('/account_confirmation/:token', function(req,res,next){
    if(req.user.confirmed) {
        req.flash('info', 'Account already activated!');
        res.redirect('/profile')
    }else {
        User.findOne({
                accountConfirmationToken: req.params.token,
                accountConfirmationExpires: {$gt: Date.now()}
            },
            function (err, user) {
                if (err) {
                    req.flash('error', err);
                    res.redirect('/signin');
                } else {
                    user.confirmed = true;
                    user.save();
                    res.redirect('/profile');
                }
            });
    }
});

router.get('/logout', isLoggedIn, function( req, res, next ) {
	req.logout();
	res.redirect('/');
});

router.post('/message', isLoggedIn, function(req, res, next) {

    if(req.body.username === req.user.username){
        res.redirect('/profile'); //If user is sending message to self, do nothing
    }else {
        //else continue sending

        var token;

        crypto.randomBytes(32, function (err, buffer) {
            token = buffer.toString('hex');

            User.findOneAndUpdate(
                {username: req.body.username},
                {
                    $push: {
                        messages: {
                            _id: token,
                            from: req.user.username,
                            subject: req.body.subject,
                            message: sanitizeHtml(req.body.message),
                            date: Date.now(),
                            new: true
                        }
                    }
                }, {safe: true, upsert: true},
                function (err, user) {
                    if (req.body.meta === 'tracking') { //if tracking number present save it
                        Listing.findById(req.body.listing, function (err, listing) {
                            listing.status.shipped.tracking = req.body.tracking;
                            listing.status.shipped.shipped = true;
                            listing.status.shipped.date = Date.now();
                            listing.save();
                        });
                        res.redirect('/profile');
                    }
                    if (req.body.meta === 'receive') { //if buyer receiving, complete sale
                        Listing.findById(req.body.listing, function (err, listing) {
                            listing.status.shipped.received = true;
                            listing.save();
                            User.findOneAndUpdate(
                                {username: req.body.username},
                                {
                                    $push: {
                                        reviews: {
                                            _id: token,
                                            date: Date.now(),
                                            user: req.user.username,
                                            item: listing.title,
                                            review: req.body.message,
                                            stars: req.body.stars
                                        }
                                    }
                                }, {safe: true, upsert: true},
                                function (err, seller) {

                                    seller.sales = seller.sales + 1;
                                    var reviews = seller.reviews.map(function (a) {
                                        return a.stars
                                    });
                                    reviews.push(req.body.stars);

                                    seller.reputation = reviews.reduce(function (acc, val) {
                                        return acc + val / reviews.length * 20;
                                    }, 0);

                                    seller.reputation = seller.reputation.toFixed(1);
                                    seller.save();
                                }
                            );


                            res.redirect('/profile');
                        });
                    }
                }
            );

        });

    }

});


router.get('/messages', isLoggedIn, function(req, res, next) {
    User.findOne({username: req.user.username}, function(err, user) {
       res.render('user/messages',{
           csrfToken: req.csrfToken(),
           username: req.user.username,
           msgs: req.user.messages,
           helpers: {
               formatDate: function (date) {
                   var d = new Date(date);
                   return d.toLocaleDateString('en-US');
               }
           }
       })
    });
});

router.get('/delete_message/:id', isLoggedIn, function(req,res, next){
    User.update({username: req.user.username},
        { $pull : { messages : { _id : req.params.id }}},
        function(err, user) {
            res.redirect('/messages');
        });
});

router.get('/reply_message/:user/:id', isLoggedIn, function(req,res,next){
   User.findOne()
});

router.get('/profile', isLoggedIn, function(req,res,next) {

	//get user profile
	Listing.find({username: req.user.username}, function(listingsERR, listings) {
        Listing.find({'status.buyer' : req.user.username }, function(ordersERR, orders) {
            Listing.find({username: req.user.username, 'status.sold': true}, function(salesERR, sales) {
                res.render('user/profile', {
                    confirmed: req.user.confirmed,
                    user: req.user,
                    msgs: req.user.messages,
                    msgCount: req.user.messages.length,
                    csrfToken: req.csrfToken(),
                    percentage: req.user.review_percentage,
                    reputation: req.user.reputation,
                    username: req.user.username,
                    profpic: req.user.profpic_url,
                    listings: listings,
                    orders: orders,
                    sales: sales,
                    reviews: req.user.reviews,
                    helpers: {
                        formatDate: function (date) {
                            var d = new Date(date);
                            return d.toLocaleDateString('en-US');
                        }
                    }
                })
            });
        });
    });
});


router.get('/buynow/:product', isLoggedIn, function(req,res,next) {
    var sess = req.session;
    payment.create(req,res, sess);
});

router.get('/return', isLoggedIn, function(req,res,next){
    var sess = req.session;
    payment.execute(req,res, sess);
});

router.get('/profile/deletelisting/:listing', isLoggedIn, function(req,res,next) {
    Listing.findById(req.params.listing, function(err, listing){
        if(listing.username = req.user.username){
            listing.remove();
        }
        res.redirect('/profile');
    });
});

var profPicsUploader = uploadingProfPic.single('userPhoto');
router.post('/uploadProfPic', isLoggedIn, function(req, res, next) {

    profPicsUploader( req, res, function(err) {
        if(err) {

            console.log(err);

                //get user profile
                Listing.find({username: req.user.username}, function(err, listings){
                res.render('user/profile',{
                    csrfToken: req.csrfToken(),
                    percentage: req.user.review_percentage,
                    reputation: req.user.reputation,
                    username: req.user.username,
                    profpic: req.user.profpic_url,
                    listings: listings,
                    error: 'Profile Pic must be JPG or PNG format and must be < 1MB'
                });
            });

        } else {
            User.findOne({ username: req.user.username }, function(err, user) {
                if (err) console.log(err);
                user.profpic_url = 'https://res.cloudinary.com/' +
                    'camtradr/image/upload/' +
                    req.file.public_id + '.' + req.file.format;
                user.profPic_id = req.file.public_id;
                user.save();

                Listing.find({ username: user.username }, function(err, listings) {
                    findIds(err, listings)
                });

                function findIds(err, listings) {
                    listings.forEach(function(listing, idx) {
                        Listing.findByIdAndUpdate(listing._id, { $set: { profpic_url : user.profpic_url }},{ new: true }, function(err, listing) {
                            if(err) console.log(err);
                        });
                    });
                }
            });

            res.redirect('/profile');
        }

    });

});

var prodPicsUploader = uploadingProdPics.array('prodPhotos',8);
router.post('/uploadProductPics', isLoggedIn, function(req,res,next) {

        prodPicsUploader(req, res, function(err) {
            if (err) {
                console.log(err);
                res.render('user/newlisting_images', {
                    error: 'Must be less than 8 JPG or PNG images and must be < 1MB each',
                    csrfToken: req.csrfToken(),
                    _id: req.body.listingid
                });
            } else {
                var listingid = req.body.listingid;

                req.files.forEach(function (image) {

                    Listing.findByIdAndUpdate(listingid, {$addToSet: {listing_images: image.secure_url}}, {
                        safe: true,
                        new: true
                    }, function (err, result) {

                        saveDisplayImage(result);
                    });

                    function saveDisplayImage(listing){
                        listing.listing_image_url = listing.listing_images[0];
                        listing.save();
                    }

                });

                res.redirect('/profile');

            }
        });

    });

router.get('/signin', function(req,res,next) {
	if ( req.user ) {
		res.redirect('/profile');
	} else {
		var messages = req.flash('error');
		res.render('user/signin', {csrfToken: req.csrfToken() , messages: messages, hasErrors: messages.length > 0});
	}
});

router.post('/signin', passport.authenticate('local.signin', {
	successRedirect: '/profile',
	failureRedirect: '/signin',
	failureFlash: true
}));

router.get('/forgot', function(req, res) {
  res.render('user/forgot', {
    user: req.user,
    csrfToken: req.csrfToken(),
    messages: {
    	info: req.flash('info'),
    	success: req.flash('success'),
    	error: req.flash('error')
    }
  });
});

router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
        var token = createToken();
        done(err, token);
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
    },
    function(token, user, done) {
      sendMessage(req,res,{
        template: 'password-rest',
        receiver: user.email,
        username: user.username,
        resetUrl: 'http://' + req.headers.host + '/reset/' + token,
        successMsg: 'An e-mail has been sent to ' + user.email,
          redirect: '/forgot'
      });
    }
  ], function(err) {
    if (err) {
        return next(err);
        req.flash('error', err);
    }
    res.redirect('/forgot');
  });

});

router.get('/product_detail/:id', function(req, res) {

   Listing.findOne({_id : req.params.id}, function(err, listing) {
     res.render('shop/product_detail', {
        images: listing.listing_images,
         description: listing.description,
         title: listing.title,
         price: listing.price,
         condition: listing.condition,
         username: req.user ? req.user.username : null,
         msgCount: req.user.messages.length,
         _id: listing._id
     });
   });
});

router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('user/reset', {
      user: req.user,
      csrfToken: req.csrfToken(),
      token: req.params.token,
      username: user.username,
      messages: {
    	info: req.flash('info'),
    	success: req.flash('success'),
    	error: req.flash('error')
    }
    });
  });
});

router.post('/reset/:token', function(req, res) {
    var resetToken;

  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(user) {

            resetToken = user.resetPasswordToken;

            if(req.body.password[0] != req.body.password[1]){
                done(function() {
                    req.flash('error','Passwords do not match!');
                });
            }

            user.password = user.encryptPassword(req.body.password[0]);

            user.save(function (err) {
                req.logIn(user, function (err) {
                    done(err,user);
                });
            });
        }
      });
    },
    function(user, done) {

        sendMessage(req, null, {
            successMsg: 'Your password has been changed',
            receiver: user.email,
            username: user.username,
            template: 'confirmed-password-reset', //password changed
            url: null
        });
        done(err);
      }
  ], function(err) {
      if(err) {
          req.flash(err);
          res.redirect('/reset/' + resetToken);
      } else {
          res.redirect('/profile');
      }

  });
});

router.get('/newlisting', isLoggedIn, function(req, res) {
	res.render('user/newlisting', {
          confirmed: req.user.confirmed,
	      user: req.user,
	      csrfToken: req.csrfToken(),
	      token: req.params.token,
	      username: req.user.username,
        msgCount: req.user.messages.length,
	      messages: {
	    	info: req.flash('info'),
	    	success: req.flash('success'),
	    	error: req.flash('error')
	    }
	});
});

router.post('/newlisting', isLoggedIn, function(req, res) {

	var newListing = new Listing();
	newListing.profpic_url = req.user.profpic_url;
	newListing.paypal = req.user.paypal;
	newListing.username = req.user.username;
	newListing.user_rep = req.user.reputation;
	newListing.email = req.user.email;
	newListing.description = sanitizeHtml(req.body.description);
	newListing.category = req.body.category;
	newListing.price = req.body.price;
	newListing.condition = req.body.condition;
	newListing.title = req.body.title;
	newListing.listing_image_url = req.body.imageurl;
	newListing.listing_status = 'live';
	newListing.save(function(err,result) {
		if(err){
			console.log(err);
		}
        res.render('user/newlisting_images', { csrfToken: req.csrfToken(), _id: result._id});

    });

});

//router.post('/newlisting_images', isLoggedIn, uploadingProdPics.array(''))



router.get('/cat/:cat', function(req, res) {

    var category = req.params.cat;
    var username;
    res.locals.login ? username = req.user.username : username = null;

    Listing.find({ category: category }, function(err, listings) {

            res.render('shop/category', {
                h1: 'test',
                msgCount: req.user ?
                    req.user.messages ? req.user.messages.length : null
                    : null,
                username: username,
                listings: listings,
                helpers: {
                    formatDate: function(date){
                        var d = new Date(date);
                        return d.toLocaleDateString('en-US');
                    },
                    dateToMs: function(date){
                        return Date.parse(date);
                    }
                }
            });
            console.log(err);

    });
});




module.exports = router;

//Middleware to protect routes from non-users
function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect('/signin');
}

