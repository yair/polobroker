const poloTrader = require('./poloTrader');
const orderConfabulator = require('./orderConfabulator');

var polo = null;
var c = null;

module.exports = {
    init: function(config, _polo) {
        c = config;
        if (!c['PAPER_TRADE']) {
            polo = _polo;
        }
        orderConfabulator.init(c, polo);
    },

    triggerSell: function(mname, act, market) {
        console.log(`triggerSell: act=${JSON.stringify(act)}`);
        let continued = false;
        if (act['amount_changed']) {
            console.log('Amount changed!');
            act['amount_changed'] = false;
            if (c['PAPER_TRADE']) {
                for (i in Object.keys(act['exch_trades'])) {
                    seq = Object.keys(act['exch_trades'])[i];
console.log(`i=${i} seq=${seq}`);
console.log(`exch_trades = ${JSON.stringify(act['exch_trades'])}`);
                    if (Object.keys(act['exch_trades'][seq])[0] == 'newTrade') {
                        trade = act['exch_trades'][seq]['newTrade'];
                        for (order in act['my_orders']) {
                            rate = act['my_orders'][order]['rate'];
console.log(`---> Comparing trade['rate']=${trade['rate']} to rate=${rate}`);
                            if (trade['rate'] >= rate) {
                                new_balance = Math.max (act['current_balance'] - act['total_amount'],
                                                        act['current_balance'] - trade['amount']);
                                console.log(`--> Sold some coins in a newTrade. Balance ${act['current_balance']} => ${new_balance}`);
                                act['current_balance'] = new_balance;
                            } else {
                                console.log(`--> New trade rate was ${trade['rate']} but our order at ${rate}, so no sell for us (order=${order}).`);
                            }
                        }
                    } else if (Object.keys(act['exch_trades'][seq])[0] == 'ticker') {
                        ticker = act['exch_trades'][seq]['ticker'];
                        for (order in act['my_orders']) {
                            rate = act['my_orders'][order]['rate'];
console.log(`---> Comparing ticker['last']=${ticker['last']} to rate=${rate}`);
                            if (ticker['last'] >= rate) { // Gah, no amount data in ticker
                                new_balance = act['current_balance'] - act['total_amount'];
                                console.log(`-->Sold some coins from ticker info. Dunno how many, assuming all. Balance ${act['current_balance']} => ${new_balance}`);
                                act['current_balance'] = new_balance;
                            } else {
                                console.log(`--> last ticker was ${ticker['last']} but our order at ${rate}, so no sell for us (order=${order}).`);
                            }
                        }
                    } else {
                        console.log("Unknown trade source: " + Object.keys(act['exch_trades'][seq])[0]);
                    }
//                    delete act['exch_trades'][seq];
                }
                act['exch_trades'] = {};
            } else {    // This takes a long time, but we don't know if the executed trade was due to our order
                continued = true;
                act['fetching_balances'] = true;
                poloniex.returnBalances(function (err, balances) { // Consider diffing returnOpenOrders or returnMyTradeHistory for more exact info
                    act['fetching_balances'] = false;
                    if (err) {
                        console.log("Failed to get balances: " + err.message);
                    } else {
                        console.log(balances);
                        act['current_balance'] = balances[mname];
                    }
                    done_or_sell(mname, act, market);
                });
            }
        }
        if (!continued) {
            done_or_sell(mname, act, market);
        }
    },

//  act={"start":1528285827585,"timeout":60,"prev_balance":0,"current_balance":0,"total_amount":74.86000318514343,"type":"Buy","my_orders":{},"amount_changed":0,"trades":[],"triggerRunning":true,"done":false}
    triggerBuy: function(mname, act, market) {
        console.log(`triggerBuy: act=${JSON.stringify(act)}`);
        let continued = false;
        if (act['amount_changed']) {
            console.log('Amount changed!');
            act['amount_changed'] = false;
            if (c['PAPER_TRADE']) {
                for (i in Object.keys(act['exch_trades'])) {
                    seq = Object.keys(act['exch_trades'])[i];
                    if (Object.keys(act['exch_trades'][seq])[0] == 'newTrade') {
                        trade = act['exch_trades'][seq]['newTrade'];
                        for (order in act['my_orders']) {
                            rate = act['my_orders'][order]['rate'];
console.log(`---> Comparing trade['rate']=${trade['rate']} to rate=${rate}`);
                            if (trade['rate'] <= rate) {
                                new_balance = Math.min (parseFloat(act['current_balance']) + parseFloat(act['total_amount']),
                                                        parseFloat(act['current_balance']) + parseFloat(trade['amount']));
                                console.log(`-->Bought some coins. Balance ${act['current_balance']} => ${new_balance}`);
                                if (isNaN(new_balance)) {
                                    baltot = parseFloat(act['current_balance']) + parseFloat(act['total_amount']);
                                    balamo = parseFloat(act['current_balance']) + parseFloat(trade['amount']);
console.log(`act['current_balance']=${act['current_balance']} act['total_amount']=${act['total_amount']} trade['amount']=${trade['amount']} min=${new_balance} baltot=${baltot} balamo=${balamo}`);
                                    process.exit(1);
                                }
                                act['current_balance'] = new_balance;
                            } else {
                                console.log(`--> newTrade was ${trade['rate']} but our order at ${rate}, so no buy for us.`);
                            }
                        }
                    } else if (Object.keys(act['exch_trades'][seq])[0] == 'ticker') {
                        ticker = act['exch_trades'][seq]['ticker'];
                        for (order in act['my_orders']) {
                            rate = act['my_orders'][order]['rate'];
console.log(`---> Comparing ticker['last']=${ticker['last']} to rate=${rate}`);
                            if (ticker['last'] <= rate) { // Gah, no amount data in ticker
                                new_balance = act['current_balance'] + act['total_amount'];
                                console.log(`-->Bought some coins from ticker info. Dunno how many, assuming all. Balance ${act['current_balance']} => ${new_balance}`);
                                act['current_balance'] = new_balance;
                            } else {
                                console.log(`--> last ticker was at ${ticker['last']} but our order at ${rate}, so no buy for us.`);
                            }
                        }
                    } else {
                        console.log("Unknown trade source: " + Object.keys(act['exch_trades'][seq])[0]);
                    }
//                    delete act['exch_trades'][seq];
                }
                act['exch_trades'] = {};
            } else {    // This takes a long time, but we don't know if the executed trade was due to our order
                continued = true;
                act['fetching_balances'] = true;
                poloniex.returnBalances(function (err, balances) {
                    act['fetching_balances'] = false;
                    if (err) {
                        console.log("Failed to get balances: " + err.message);
                    } else {
                        console.log("Got balances: " + balances);
                        act['current_balance'] = balances[mname];
                    }
                    done_or_buy(mname, act, market);
                });
            }
        }
        if (!continued) {
            done_or_buy(mname, act, market);
        }
    },
};

function finalize_act (mname, act) {

    // TODO: kill all remaining orders
    
    // dump order history
    if (polo) {
        polo.returnTradeHistory(mname, act['start'], Date.now(), 1000, function (err, body) {
            if (err) {
                console.out("Error fetching trade history: " + err);
            } else {
                fs.writeFile(c['VOLATILE_DIR'] + "tradeHistory_" + mname + "_" + Date.now() + ".json", body);
            }
        });
    }
    act['done'] = true;
}

function done_or_sell (mname, act, market) {

    if (act['current_balance'] == null) {
        console.log('current balance is null. Freaking out.');
        process.exit(1);
    }
     
    console.log("remaining_amount to sell = " + remaining_amount(act));

//    if (act['prev_balance'] - act['total_amount'] <= act['current_balance'] + c['MINIMUM_TRADE']) {
    if (remaining_amount(act) < c['MINIMUM_TRADE']) {

        console.log(`Current balance is ${act['current_balance']}. We wanted ${act['prev_balance'] - act['total_amount']}, so that's enough.`);
        return finalize_act(mname, act);;
    }

    update_orders(mname, act, market);
/*
    new_orders = orderConfabulator.calc_new_orders(mname, act, market, remaining_amount(act));
//    console.log("Orig orders = " + JSON.stringify(act['my_orders']));
//    console.log("new orders = " + JSON.stringify(new_orders));

    diff = order_diff (act['my_orders'], new_orders);
    console.log("Order diff = " + JSON.stringify(diff));

    replace_orders(act['my_orders'], diff);*/
}

function done_or_buy (mname, act, market) {

    if (act['prev_balance'] + act['total_amount'] <= act['current_balance'] + c['MINIMUM_TRADE']) {

        console.log(`Current balance is ${act['current_balance']}. We wanted ${act['prev_balance'] + act['total_amount']}, so that's enough.`);
        return finalize_act(mname, act);;
    }

    console.log("remaining_amount to buy = " + remaining_amount(act));

    update_orders(mname, act, market);
}

function update_orders (mname, act, market) {

    new_orders = orderConfabulator.calc_new_orders(mname, act, market, remaining_amount(act));
//    console.log("Orig orders = " + JSON.stringify(act['my_orders']));
//    console.log("new orders = " + JSON.stringify(new_orders));

    diff = order_diff (act['my_orders'], new_orders);
    console.log("Order diff = " + JSON.stringify(diff));

//    replace_orders(act['my_orders'], diff);
    replace_orders(act, diff);
}

function remaining_amount (act) {

    if (act['type'] == 'Buy') {
        return act['prev_balance'] + act['total_amount'] - act['current_balance'];
    } else if (act['type'] == 'Sell') {
        return - act['prev_balance'] + act['total_amount'] + act['current_balance'];
    } else {
        console.log("Invalid act type: " + act['type']);
        process.exit(1);
    }
}

function order_diff (old_orders, new_orders) {

//    old_orders = JSON.parse (JSON.stringify (orders));
    diff = { remove: {}, add: {} };

    for (old_order in old_orders) {
//        console.log("old_order = " + old_order);
/*        if (exists in new orders) {
            if (price the same) {
                nothing in diff, don't delete from old
            } else {
                remove from old, delete old order, add new to add
            }
            delete from new
        } else {
            remove from old, delete old order
        }*/
        if (old_order in new_orders) {
            if (old_orders[old_order]['amount'] != new_orders[old_order]['amount']) { // same price, different amount
//                console.log(`Replacing amount in existing order ${old_order} - ${old_orders[old_order]['amount']} => ${new_orders[old_order]['amount']}`);
                diff['remove'][old_order] = old_orders[old_order];
                diff['add'][old_order] = new_orders[old_order];
                delete old_orders[old_order];
                old_orders[old_order] = new_orders[old_order];
            } else {
//                console.log(`Found match in old orders for ${old_order}. Skipping update`);
            }
            delete new_orders[old_order];
        } else {
//            console.log(`Removing old order at ${old_order} since it isn't in the new ones.`);
            diff['remove'][old_order] = old_orders[old_order];
            delete old_orders[old_order];
        }
    }
    for (new_order in new_orders) {
//        console.log(`Adding new order at ${new_order} since it isn't in the old ones.`);
        diff['add'][new_order] = new_orders[new_order];
        old_orders[new_order] = new_orders[new_order];
    }
    return diff;
}

function remove_order(order, callback) {

    if (!c['PAPER_TRADE']) {
        console.log("Cancelling order: " + JSON.stringify(order));
        polo.cancelOrder(order['id'], callback)
    }
}


function add_order(order, callback) {
//        add order to hash of orders !!! after you have and id for it !!!

//    console.log("\n\nadd_order: Adding order: " + order);

    if (!c['PAPER_TRADE']) {
        if (order['type'] == 'Buy') {
            console.log("Issuing buy order: " + JSON.stringify(order));
            polo.buy(order['mname'], order['rate'], order['amount'], false, false, false, callback);
        } else {
            console.log("Issuing sell order: " + JSON.stringify(order));
            polo.sell(order['mname'], order['rate'], order['amount'], false, false, false, callback);
        }
    }
}

//function set_new_orders(my_orders, adds) {
function set_new_orders(act, adds) {

    if (Object.keys(adds).length == 0) {
        console.log("set_new_orders() called with no adds: " + JSON.stringify(adds));
        return;
    }

    console.log("In set_new_orders(). Have " + Object.keys(adds).length + " orders to add.");
    for (var order in adds) {

//        if  order exists, WAT...
//        if paper_trade, ehm... do nothing? how do you transact?
//        else
//            set up the order, and put the id in the book.

        add_order(adds[order], function (err, body) {

            console.log("Order no. " + order + " out of " + Object.keys(adds).length + err ? " failed." : " added.");

            if (err) {
                console.log("\n\nFailed to add order: " + err);
                console.log("Body received: " + JSON.stringify(body));
                console.log("Order was: " + JSON.stringify(body));       // When this fails with 'Not enough BTC.', how do I re-add it with a lower amount? Can I access my act?
                if (toString(err).match('Not enough')) {
                    act['amount'] = 0.9 * parseFloat(act['amount']); // Like this? Do we need to tell anyone that an order wasn't executed?
                }
//                process.exit(0);
            } else {
                console.log(`\n\nlimit order response is ${JSON.stringify(body)}. ID is ${body['orderNumber']}`);
                order['id'] = body['orderNumber'];
                act['my_orders'][body['rate']] = body; // or something. Do we get and amount as well? What about market? And move the id to first level plox
                // This might take longer than for the next trigger to arrive. We need to store the order in a 'pending' hash for the interval between
                // issuing the order and receiving its ID so it can be removed.
            }
        });
    }
}

//function replace_orders (my_orders, diff) {
function replace_orders (act, diff) {

    var orders = 0;

    if (Object.keys(diff['remove']).length == 0) {
        console.log("No orders to remove, going straight to add " + Object.keys(diff['add']).length + " new ones.");
        return set_new_orders(act, diff['add']);
    }

    for (var order in diff['remove']) {

		remove_order(order, function (err) {

			if (err) {
				console.log(`Failed to remove order no. ${order['id']}: ${err}`);
			}
            console.log("Removed order " + orders + "/" + Object.keys(diff['remove']).length);
			if (++orders == Object.keys(diff['remove']).length) {
                console.log("Removed all orders needing removal. Calling set_new_orders()");
				set_new_orders(act, diff['add']);
			}
		});
	}
}
