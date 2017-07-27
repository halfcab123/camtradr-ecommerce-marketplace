exports.getJson = function(name,sku,price,paypal,total,description) {

return {
    "intent": "authorize",
    "payer": {
        "payment_method": "paypal"
    },
    "redirect_urls": {
        "return_url": "http://localhost:3001/return",
        "cancel_url": "http://localhost:3001/cancel"
    },
    "transactions": [{
        "item_list": {
            "items": [{
                "name": name,
                "sku": sku,
                "price": price,
                "currency": "USD",
                "quantity": 1
            }]
        },
        "payee": {
            "email": paypal
        },
        "amount": {
            "currency": "USD",
            "total": total
        },
        "description": description
    }]
};

}