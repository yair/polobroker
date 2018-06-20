const Poloniex = require('poloniex-api-node');
const fs = require('fs');
const l = require ('./log');
const u = require ('./utils');

var c = {
    VOLATILE_DIR: '/home/yair/w/volatile/',
};

// Get secrets
var secrets;
var data = fs.readFileSync ('secrets.json', 'utf8');
secrets = JSON.parse(data);

var poloniex = new Poloniex(secrets['key'], secrets['secret'], { nonce: () => Date.now() * 2000 });
var now = Math.floor(Date.now()/1000);
var from = // 0; // all
           now - 86400; // last 24 hours
x = async function () {
poloniex.returnTicker().then( async (ticker) => {
    l.i(`Got ${Object.keys(ticker).length} markets to subscribe to.`);
    for (market in Object.keys(ticker)) {
        let mname = Object.keys(ticker)[market];
        poloniex.returnTradeHistory(mname, from, now, 1000, function (err, body) {
            if (err) {
                l.e("Error fetching trade history: " + err);
            } else {
                l.d("Trade history for " + mname + ": " + JSON.stringify(body));
                fs.writeFile(c['VOLATILE_DIR'] + "fetch_tradeHistory_" + from + "_-_" + now + "_" + mname + ".json", JSON.stringify(body), (err) => {
                    if (err) throw err;
                    l.i('File no. ' + market + ' has been saved!');
                });
            }
        });
        await u.sleep(200);
    }
});
}();

        //    coin_list = ['USDT_BTC', 'BTC_ETH', 'BTC_XRP', 'BTC_XMR', 'BTC_LTC', 'BTC_ETH', 'BTC_STR'];
        //
        //        for (market in Object.keys(ticker)) {
        //
return;
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
