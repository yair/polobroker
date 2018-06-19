const utils = require('./utils');
const l = require ('./log');

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

        /**/
        let strat = get_strat (now, act, market, remaining_amount);

        snapshot_market(act, market);

        orders = strat (now, act, market, remaining_amount);

        return orders;
        /**/
/*
        // Trivial stupid ass thing
        if (now - act['start'] > act['timeout'] * 1000) {
            act['market_order'] = true;
            if (act['type'] == 'Buy') {
                return marketBuy(mname, remaining_amount, market);
            } else if (act['type'] == 'Sell') {
                return marketSell(mname, remaining_amount, market);
            } else {
                l.e("Unknown order type: " + act['type']);
            }
        }

        if (act['type'] == 'Buy') {
            dumpOB(market['ob_bids']);
        } else {
            dumpOB(market['ob_asks']);
        }

        stupidReturnValue = {};
        
        if (act['type'] == 'Buy') {
            price = parseFloat(getFilteredSortedOB(market['ob_bids'], act).reverse()[0][0]) +
                    parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
            l.d("New order buy price: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

            stupidReturnValue[price] = {    'mname': mname,
                                            'rate': price,
                                            'type': 'Buy',
                                            'amount': remaining_amount, };
        } else if (act['type'] == 'Sell') {
            price = parseFloat(getFilteredSortedOB(market['ob_asks'], act)[0][0]) - parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
            l.d("New order sell price: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

            stupidReturnValue[price] = {    'mname': mname,
                                            'rate': price,
                                            'type': 'Sell',
                                            'amount': remaining_amount, };
        } else {
            l.e("Unknown order type: " + act['type']);
        }

        return stupidReturnValue;
*/
/*        return { price: {'mname': mname,
                         'rate': price,
                         'type': 'Buy',
                         'amount': remaining_amount
        }};*/
    },

};

function snapshot_market(act, market) {

    if (act['type'] == 'Buy') {
        market['snap_bids'] = getFilteredSortedOB(market['ob_bids'], act).reverse();
        market['snap_asks'] = getSortedOB(market['ob_asks'], act);
    } else {
        market['snap_bids'] = getSortedOB(market['ob_bids'], act).reverse();
        market['snap_asks'] = getFilteredSortedOB(market['ob_asks'], act);
    }
}

function get_strat (now, act, market, remaining_amount) { // Insert AI here

    let timefract = 1000. - (now - act['start']) / act['timeout'];
    l.i ("timefract: " + timefract + " (" + now + " - " + act['start'] + ") / " + act['timeout'] + " = " + timefract + ")");

    if (timefract > 500) {
        return obtop;
    } else if (timefract > 0) {
        return cross_the_gap;
    } else {
        return market_order;
    }
}

function obtop (now, act, market, remaining_amount) {

    stupidReturnValue = [];

    if (act['type'] == 'Buy') {

        price = parseFloat(market['snap_bids'][0][0]) +
                parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
        l.i("OB top buy price is: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

    } else if (act['type'] == 'Sell') {

        price = parseFloat(market['snap_asks'][0][0]) - parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
        l.i("OB top sell price is: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

    } else {
        l.e("Unknown order type: " + act['type']);
        process.exit(1);
    }

    stupidReturnValue[price] = {    'mname': act['mname'],
                                    'rate': price,
                                    'type': act['type'],
                                    'amount': remaining_amount, };
    return stupidReturnValue;
}

function cross_the_gap (now, act, market, remaining_amount) {

    stupidReturnValue = [];

    if (act['type'] == 'Buy') {

        price = parseFloat(market['snap_asks'][0][0]) -
                parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
        l.i("Cross-the-gap buy price is: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

    } else if (act['type'] == 'Sell') {

        price = parseFloat(market['snap_bids'][0][0]) + parseFloat(c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION']);
        l.i("Cross-the-gap sell price is: " + price + " (" + (act['start'] + act['timeout'] * 1000 - now) + "ms remaining)");

    } else {
        l.e("Unknown order type: " + act['type']);
        process.exit(1);
    }

    stupidReturnValue[price] = {    'mname': act['mname'],
                                    'rate': price,
                                    'type': act['type'],
                                    'amount': remaining_amount, };
    return stupidReturnValue;
}

function market_order (now, act, market, remaining_amount) {

    // Get up to date BTC balance, for the next time, and do a precise calc from OB depth.
    act['amount_changed'] = true;
    btc_balance = act['btc_balance'];

    if (btc_balance < Number.POSITIVE_INFINITY) { // This whole craptification shouldn't only be for market orders, perhaps.

        myob = act['type'] == 'Buy' ? market['snap_asks'] : market['snap_bids'];
        depth = 0;
        for (i in myob) {

            depth += myob[i][1];
            price = myob[i][0];
            if (depth > 2 * remaining_amount) {
                break;
            }
        }

        if (btc_balance / price > remaining_amount) { // no problem thre
            amount = remaining_amount;
        } else {
            amount = btc_balance / (price + c['PRICE_RESOLUTION']); // Just to be on a safer side
        }

        srv = [];
        srv[price] = {  'mname':  act['mname'],
                        'rate':   price,
                        'type':   act['type'],
                        'amount':  amount,
        };
        l.i("Issuing improved market order: " + JSON.stringify(srv));
        return srv;
    }

    if (act['type'] == 'Buy') {
        return marketBuy(act['mname'], remaining_amount, market);
    } else if (act['type'] == 'Sell') {
        return marketSell(act['mname'], remaining_amount, market);
    }
}

function getFilteredSortedOB (ob, act) {

    var myob = JSON.parse(JSON.stringify(ob));
    var myobk = Object.keys(myob); // maybe this'll help? :/
    order_prices = Object.keys(act['active_orders']).concat(Object.keys(act['pending_add']), Object.keys(act['pending_remove']));

    for (order_id in order_prices) {

        order_price = order_prices[order_id];

        l.d('Filtering out order at ' + order_price);
        filtered = false;
//        for (ob_id in Object.keys(myob)) {      // Takes ages. Maybe sort first
        for (ob_id in myobk) {      // Takes ages. Maybe sort first

//            ob_price = Object.keys(myob)[ob_id];
            ob_price = myobk[ob_id];

            if (utils.are_close (order_price, ob_price, c['PRICE_RESOLUTION'] / 2.)) {   // compare price too?

                l.i("Filtered OB order at " + ob_price);
                delete myob[ob_price];
                filtered = true;
            }
        }

        if (!filtered && Object.keys(act['active_orders']).length > 0) {

            l.w("Could not filter order at " + order_price);
            l.w("Active orders: " + JSON.stringify(act['active_orders'])); // evidence of misplaced orders? No, it's the other OB that's screaming! TODO
        }
    }

    return getSortedOB (myob);
}

function getSortedOB(ob) {
 
    return Object.keys(ob).sort(function (a, b) { return a - b }).map(x => [x, ob[x]]);
};

function marketBuy(mname, remaining_amount, market) {

    l.i("\n*** MARKET BUYING " + mname + " ***\n");
//    price = 2 * getSortedOB(market['ob_bids']).reverse()[0][0];
    price = 1.1 * getSortedOB(market['ob_bids']).reverse()[0][0];

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

    l.i("\n*** MARKET SELLING " + mname + " ***\n");
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

function dumpOB(ob) { // TODO: dump both sides of the market, highlight our own orders
                      // Also in a suitable format to add to archive, to trace second by second decision making.

    sorted = getSortedOB(ob);
    len = sorted.length;
    l.d(`${sorted[0][0]} => ${sorted[0][1]}`);
    l.d(`${sorted[1][0]} => ${sorted[1][1]}`);
    l.d(`${sorted[2][0]} => ${sorted[2][1]}`);
    l.d("...");
    l.d(`${sorted[len-3][0]} => ${sorted[len-3][1]}`);
    l.d(`${sorted[len-2][0]} => ${sorted[len-2][1]}`);
    l.d(`${sorted[len-1][0]} => ${sorted[len-1][1]}`);
}
