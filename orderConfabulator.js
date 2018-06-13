var polo = null;
var c = null;

module.exports = {

    init: function (config, _polo) {
        polo = _polo;
        c = config;
    },

//  act={"start":1528285827585,"timeout":60,"prev_balance":0,"current_balance":0,"total_amount":74.86000318514343,"type":"Buy","my_orders":{},"amount_changed":0,"trades":[],"triggerRunning":true,"done":false}
    //
    calc_new_orders: function (mname, act, market, remaining_amount) {

        /*
        if (act['type'] != 'Buy') {
            console.log('Cannot confabulate sell orders.');
            return;
        }
        */

        now = Date.now();

        // Trivial stupid ass thing
        if (now - act['start'] > act['timeout'] * 1000) {
            if (act['type'] == 'Buy') {
                return marketBuy(mname, remaining_amount, market);
            } else if (act['type'] == 'Sell') {
                return marketSell(mname, remaining_amount, market);
            } else {
                console.log("Unknown order type: " + act['type']);
            }
        }

        dumpOB(market['ob_bids']);

        stupidReturnValue = {};
        
        if (act['type'] == 'Buy') {
            price = parseFloat(getSortedOB(market['ob_bids']).reverse()[0][0]) +
                    parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
            console.log("New order buy: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

            stupidReturnValue[price] = {    'mname': mname,
                                            'rate': price,
                                            'type': 'Buy',
                                            'amount': remaining_amount, };
        } else if (act['type'] == 'Sell') {
            price = parseFloat(getSortedOB(market['ob_asks'])[0][0]) - parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
            console.log("New order sell: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

            stupidReturnValue[price] = {    'mname': mname,
                                            'rate': price,
                                            'type': 'Sell',
                                            'amount': remaining_amount, };
        } else {
            console.log("Unknown order type: " + act['type']);
        }

        return stupidReturnValue;
/*        return { price: {'mname': mname,
                         'rate': price,
                         'type': 'Buy',
                         'amount': remaining_amount
        }};*/
    },

};

function getSortedOB(ob) {
 
    return Object.keys(ob).sort(function (a, b) { return a - b }).map(x => [x, ob[x]]);
};

function marketBuy(mname, remaining_amount, market) {

    console.log("\n*** MARKET BUY ***\n");
    price = 2 * getSortedOB(market['ob_bids']).reverse()[0][0];

    stupidReturnValue = {};
    stupidReturnValue[price] = {    'mname': mname,
                                    'rate': price,
                                    'type': 'Buy',
                                    'amount': remaining_amount, };
    return stupidReturnValue;
/*    return { price: {'mname': mname,  // How?! How can you think price is a literal?!
                     'rate': price,
                     'type': 'Buy',
                     'amount': remaining_amount,
    }};*/
}

function marketSell(mname, remaining_amount, market) {

    console.log("\n*** MARKET SELL ***\n");
    price = 0.5 * getSortedOB(market['ob_asks'])[0][0];

    stupidReturnValue = {};
    stupidReturnValue[price] = {    'mname': mname,
                                    'rate': price,
                                    'type': 'Sell',
                                    'amount': remaining_amount, };
    return stupidReturnValue;
/*    return { price: {'mname': mname,  // How?! How can you think price is a literal?!
                     'rate': price,
                     'type': 'Buy',
                     'amount': remaining_amount,
    }};*/
}

function dumpOB(ob) {

    sorted = getSortedOB(ob);
    len = sorted.length;
    console.log(`${sorted[0][0]} => ${sorted[0][1]}`);
    console.log(`${sorted[1][0]} => ${sorted[1][1]}`);
    console.log(`${sorted[2][0]} => ${sorted[2][1]}`);
    console.log("...");
    console.log(`${sorted[len-3][0]} => ${sorted[len-3][1]}`);
    console.log(`${sorted[len-2][0]} => ${sorted[len-2][1]}`);
    console.log(`${sorted[len-1][0]} => ${sorted[len-1][1]}`);
}
