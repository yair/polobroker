const Poloniex = require('poloniex-api-node');
const fs = require('fs');

// Get secrets
var secrets;
var data = fs.readFileSync ('secrets.json', 'utf8');
secrets = JSON.parse(data);

var poloniex = new Poloniex(secrets['key'], secrets['secret'], { nonce: () => Date.now() * 2000 });

// fetch balances
poloniex.returnBalances(function (err, balances) {
      if (err) {
          console.log("Failed to login to polo: " + err);
          process.exit(1);
      } else {
          console.log("Successfully logged in: ");// + JSON.stringify(balances));
      }
});

// set an order and cancel it
poloniex.sell('USDT_BTC', 40000., 0.006, false, false, false, function (err, body) {

    if (err) {
        console.log("Failed to set a sell order: " + err);
    } else {
        console.log("Successfully set a sell order.");
    }
    console.log("Body of sell order response: " + JSON.stringify(body));

    let orderNumber = body['orderNumber'];

    poloniex.cancelOrder(body['orderNumber'], function(err, body) {

        if (err) {
            console.log("Failed to cancel order no. " + orderNumber + ": " + err);
        } else {
            console.log("Successfully canceled order no. " + orderNumber);
        }

        console.log("Cancel response body: " + JSON.stringify(body));
    });
});
