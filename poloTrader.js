const poloTrader = require('./poloTrader');
const orderConfabulator = require('./orderConfabulator');
const utils = require('./utils');
const fs = require('fs');
const l = require ('./log');

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
        l.d(`triggerSell: act=${JSON.stringify(act)}`);
        let continued = false;
        if (act['amount_changed']) {
            l.i('Amount of ' + act['coin_name'] + ' may have changed!');
            act['amount_changed'] = false;
            if (c['PAPER_TRADE']) {
                for (i in Object.keys(act['exch_trades'])) {
                    seq = Object.keys(act['exch_trades'])[i];
console.log(`i=${i} seq=${seq}`);
console.log(`exch_trades = ${JSON.stringify(act['exch_trades'])}`);
                    if (Object.keys(act['exch_trades'][seq])[0] == 'newTrade') {
                        trade = act['exch_trades'][seq]['newTrade'];
                        for (order in act['active_orders']) {
                            rate = act['active_orders'][order]['rate'];
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
                        for (order in act['active_orders']) {
                            rate = act['active_orders'][order]['rate'];
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
                if (act['fetching_balances']) {
                    l.w("Trying to fetch balances in the middle of already fetching balances");
                } else {
                    continued = true;
                    act['fetching_balances'] = true; // Consider diffing returnOpenOrders or returnMyTradeHistory for more exact info
//                    polo.returnBalances(function (err, balances) {    // Wrong! Returns _available_ balances, after deducting value on orders
                    polo.returnCompleteBalances("exchange", function (err, balances) {
                        act['fetching_balances'] = false;
                        if (err) {
                            l.e("Failed to get balances: " + err.message);
                        } else {
                            l.d("\n\nGot complete balances.");
                            new_balance = parseFloat(balances[act['coin_name']]['available']) + parseFloat(balances[act['coin_name']]['onOrders']);
//                            console.log(balances);
                            l.i("\nUpdating market " + mname + " balance with coin " + act['coin_name'] + " balance: " + new_balance);
//                                (parseFloat(balances[act['coin_name']]['available']) + parseFloat(balances[act['coin_name']]['onOrders'])).toString());
                            act['current_balance'] = new_balance; //parseFloat(balances[act['coin_name']]['available']) +
                            act['btc_balance'] = parseFloat(balances['BTC']['available']);
                            l.i("Updated BTC balance to " + act['btc_balance']);
//                                                     parseFloat(balances[act['coin_name']]['onOrders']);
//                            if (new_balance < parseFloat(act['
//                            console.log("act is now " + JSON.stringify(act));
                        }
                        done_or_sell(mname, act, market);
                    });
                }
            }
        }
        if (!continued) {
            done_or_sell(mname, act, market);
        }
    },

//  act={"start":1528285827585,"timeout":60,"prev_balance":0,"current_balance":0,"total_amount":74.86000318514343,"type":"Buy","my_orders":{},"amount_changed":0,"trades":[],"triggerRunning":true,"done":false}
    triggerBuy: function(mname, act, market) {
        l.d(`triggerBuy: act=${JSON.stringify(act)}`);
        let continued = false;
        if (act['amount_changed']) {
            l.i('Amount of ' + act['coin_name'] + ' may have changed!');
            act['amount_changed'] = false;
            if (c['PAPER_TRADE']) {
                for (i in Object.keys(act['exch_trades'])) {
                    seq = Object.keys(act['exch_trades'])[i];
                    if (Object.keys(act['exch_trades'][seq])[0] == 'newTrade') {
                        trade = act['exch_trades'][seq]['newTrade'];
                        for (order in act['active_orders']) {
                            rate = act['active_orders'][order]['rate'];
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
                        for (order in act['active_orders']) {
                            rate = act['active_orders'][order]['rate'];
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
                if (act['fetching_balances']) {
                    l.w("Trying to fetch balances in the middle of already fetching balances");
                } else {
                    continued = true;
                    act['fetching_balances'] = true; // Consider diffing returnOpenOrders or returnMyTradeHistory for more exact info
//                    polo.returnBalances(function (err, balances) {    // Wrong! Returns _available_ balances, after deducting value on orders
                    polo.returnCompleteBalances("exchange", function (err, balances) {
                        act['fetching_balances'] = false;
                        if (err) {
                            l.e("Failed to get balances: " + err.message);
                        } else {
                            l.d("\n\nGot complete balances:");
                            l.v(balances);
                            new_balance = parseFloat(balances[act['coin_name']]['available']) + parseFloat(balances[act['coin_name']]['onOrders']);
                            l.i("\nUpdating " + mname + " balance with coin " + act['coin_name'] + " balance: " + new_balance);
//                                (parseFloat(balances[act['coin_name']]['available']) + parseFloat(balances[act['coin_name']]['onOrders'])).toString());
//                            console.log("\nUpdating " + mname + " balance with coin " + act['coin_name'] + " balance: " + balances[act['coin_name']]);
                            act['current_balance'] = new_balance; // parseFloat(balances[act['coin_name']]['available']) +
                                                                  // parseFloat(balances[act['coin_name']]['onOrders']);
                            l.v("act is now " + JSON.stringify(act));
                            act['btc_balance'] = parseFloat(balances['BTC']['available']);
                            l.i("Updated BTC balance to " + act['btc_balance']);
                        }
                        done_or_buy(mname, act, market);
                    });
                }
            }
        }
        if (!continued) {
            done_or_buy(mname, act, market);
        }
    },
};

function finalize_act (mname, act) {

    // dump order history
    if (polo) {
        polo.returnTradeHistory(mname, Math.floor(act['start']/1000), Math.floor(Date.now()/1000), 1000, function (err, body) {
            if (err) {
                l.e("Error fetching trade history: " + err);
            } else {
                l.d("Trade history for " + mname + ": " + JSON.stringify(body));
                fs.writeFile(c['VOLATILE_DIR'] + "tradeHistory_" + mname + "_" + Date.now() + ".json", JSON.stringify(body), (err) => {
                    if (err) throw err;
                    l.i('Trade history for ' + mname + ' has been saved!');
                });
            }
        });
    }
    act['done'] = true;
}

function done_or_sell (mname, act, market) {

    if (act['current_balance'] == null) {
        l.e('current balance is null. Freaking out.');
        process.exit(1);
    }
     
    l.i("remaining_amount to sell = " + remaining_amount(act)); // TODO: use the confabulator's better estimate

    if (act['mname'] == 'USDT_BTC' && remaining_amount(act) <= c['MINIMUM_BTC_TRADE']) {

        l.i(`Current balance is ${act['current_balance']}${act['coin_name']}. We wanted ${act['prev_balance'] + act['total_amount']}${act['coin_name']}, so that's enough.`);
        return finalize_act(mname, act);
    }

//    if (act['prev_balance'] - act['total_amount'] <= act['current_balance'] + c['MINIMUM_TRADE']) {
    if (remaining_amount(act) * act['price'] < c['MINIMUM_TRADE']) {

        l.i(`Current balance is ${act['current_balance']}${act['coin_name']}. We wanted ${act['prev_balance'] - act['total_amount']}${act['coin_name']}, so that's enough.`);
        return finalize_act(mname, act);
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

    if (act['mname'] == 'USDT_BTC' && remaining_amount(act) <= c['MINIMUM_BTC_TRADE']) {

        l.i(`Current balance is ${act['current_balance']}. We wanted ${act['prev_balance'] + act['total_amount']}, so that's enough.`);
        return finalize_act(mname, act);;
    }

//    if (act['prev_balance'] + act['total_amount'] <= act['current_balance'] + c['MINIMUM_TRADE']) {
    if (remaining_amount(act) * act['price'] < c['MINIMUM_TRADE']) {

        l.i(`Current balance is ${act['current_balance']}. We wanted ${act['prev_balance'] + act['total_amount']}, so that's enough.`);
        return finalize_act(mname, act);;
    }

    l.i("remaining_amount to buy = " + remaining_amount(act));

    update_orders(mname, act, market);
}

function update_orders (mname, act, market) {

    if (Object.keys(act['pending_add']).length != 0 || Object.keys(act['pending_remove']).length != 0) { // Can/should this be more fine grained?

        if (act['pending_timestamp'] == 0) {
            l.e("Pending actions exist, yet timestamp is 0! Dying.");
            process.exit(1);
        }

        if (act['pending_timestamp'] + c['PENDING_TIMEOUT'] < Date.now()) {

            l.w("\nPending timeout reached. Killing all orders.\n");

            polo.returnOpenOrders(act['mname'], function (err, body) {

                if (err) {
                    l.e("Failed feching open orders (" + err + "). Will retry.");
                } else {
// [{"orderNumber":"127346485219","type":"buy","rate":"0.02918501","startingAmount":"0.00506735","amount":"0.00506735","total":"0.00014789","date":"2018-06-15 06:44:24","margin":0}]
// {"0.00210001":{"mname":"BTC_GAS","rate":0.00210001,"type":"Buy","amount":2.2387186711550737}}
                    l.i("Fetched open orders: " + JSON.stringify(body));
                    act['active_orders'] = {};
                    for (order_id in body) {
                        order = body[order_id];
                        act['active_orders'][order['rate']] = { // This can't be right. We need to recreate the order, find it in act{} or outright them outright.
                            mname: act['mname'],
                            rate: order['rate'],
                            type: act['type'],
                            amount: order['amount'],
                            id: order['orderNumber'],
                        };
                        if (order['amount'] != order['startingAmount']) {
                            act['amount_changed'] = true;
                        }
                    }
                    act['pending_add'] = {};
                    act['pending_remove'] = {};
                    act['pending_timestamp'] = 0;
//                    if (body.length > 0)
//                        process.exit(0); // to capture the order format.
                }
            });

        }
        // TODO: Check if pending timeout reached. If yes, cancel all orders and continue (Do we need another flag for that?)
        l.i("We have pending orders, so will skip update this time. (ttl=" + (-Date.now() + act['pending_timestamp'] + c['PENDING_TIMEOUT']) + "ms)");
        return;
    }

    if (act['fetching_balances'] == true) {
        l.i("We are fetching balances, so will skip update this time.");
        return;
    }

    new_orders = orderConfabulator.calc_new_orders(mname, act, market, remaining_amount(act));
//    console.log("Orig orders = " + JSON.stringify(act['my_orders']));
//    console.log("new orders = " + JSON.stringify(new_orders));

    diff = order_diff (act['active_orders'], new_orders);
    l.d("Order diff = " + JSON.stringify(diff));

//    replace_orders(act['my_orders'], diff);
    replace_orders(act, diff);
}

function remaining_amount (act) {

//    console.log("remaining amount -- prev_balance = " + act['prev_balance'] + " current_balance = " + act['current_balance'] + " total_amount = " + act['total_amount']);

    if (act['type'] == 'Buy') { // TODO: Should also restrict buys on BTC shortage - prolly by averaging on all open buys
        let rem = parseFloat(act['prev_balance']) + parseFloat(act['total_amount']) - parseFloat(act['current_balance']);
        let available_to_buy = parseFloat(act['btc_balance']) * parseFloat(act['price']);
        l.i("remaining " + act['mname'] + " amount: " + rem + "(we can afford " + available_to_buy + ")");
        if (available_to_buy < rem) {
            l.i("Restricting buying amount to remaining btc balance: " + rem + " => " + available_to_buy);
            return available_to_buy;
        }
        return rem;
    } else if (act['type'] == 'Sell') {
        let rem = - parseFloat(act['prev_balance']) + parseFloat(act['total_amount']) + parseFloat(act['current_balance']);
        if (parseFloat(act['current_balance']) < rem) {
            l.w("Restricting selling amount to remaining balance: " + rem + " => " + parseFloat(act['current_balance']));
            return parseFloat(act['current_balance']);
        }
        return rem;
    } else {
        l.e("Invalid act type: " + act['type']);
        process.exit(1);
    }
}

function order_diff (orders, new_orders) {

    old_orders = JSON.parse (JSON.stringify (orders)); // This function cannot make changes to the live set, that requires exch callback
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

    if (!order.hasOwnProperty('id')) {
        l.e("Cannot cancel unidentified order: " + JSON.stringify(order));
        process.exit(1);
    }
    if (!c['PAPER_TRADE']) {
        l.i("Cancelling order: " + JSON.stringify(order));
        polo.cancelOrder(order['id'], callback)
    }
}


function add_order(order, callback) {
//        add order to hash of orders !!! after you have and id for it !!!

//    console.log("\n\nadd_order: Adding order: " + order);

    if (!c['PAPER_TRADE']) {
        if (order['type'] == 'Buy') {
            l.i("Issuing buy order: " + JSON.stringify(order));
            polo.buy(order['mname'], order['rate'], order['amount'], false, false, false, callback);
        } else {
            l.i("Issuing sell order: " + JSON.stringify(order));
            polo.sell(order['mname'], order['rate'], order['amount'], false, false, false, callback);
        }
    }
}

//function set_new_orders(my_orders, adds) {
function set_new_orders(act, adds) {

    if (Object.keys(adds).length == 0) {
        l.i("set_new_orders() called with no adds: " + JSON.stringify(adds));
        return;
    }

    l.i("In set_new_orders(). Have " + Object.keys(adds).length + " orders to add.");
    for (var order_id in Object.keys(adds)) {

        order_rate = Object.keys(adds)[order_id];

        order = adds[order_rate];

        l.d("order_rate = " + order_rate + " and order = " + JSON.stringify(order));

//        if  order exists, WAT...
//        if paper_trade, ehm... do nothing? how do you transact?
//        else
//            set up the order, and put the id in the book.

        //act['pending_add'][order['rate']] = order;
        act['pending_add'][order_rate] = order;
        l.d("Order added to 'pending_add': " + JSON.stringify(act['pending_add']));
        act['pending_timestamp'] = Date.now();

        add_order(order, function (err, body) {

            l.i("Order at " + order_rate + " out of " + Object.keys(adds).length + (err ? " failed." : " added."));

            if (err) {
                l.e("\nFailed to add order: " + err);
//                console.log("toString(err) = " + toString(err));
//                console.log("stringify(err) = " + JSON.stringify(err));
//                console.log("err type is " + Object.prototype.toString.call(err));
//                console.log("Body received: " + JSON.stringify(body));
                l.e("Error body: " + JSON.stringify(body));       // When this fails with 'Not enough BTC.', how do I re-add it with a lower amount? Can I access my act?
//                if (toString(err).match('Not enough')) {
                if (body == undefined) {
                    l.e("body undefined.");
                } else if (body['error'].match('Not enough')) { // TODO: If this happens every time, start with a reduced amount.
                    l.e("Reducing total act amount from " + act['total_amount'] + " to " + (act['total_amount'] * 0.998)); // TODO: replace with balance calc
                    act['total_amount'] = 0.998 * parseFloat(act['total_amount']); // Like this? Do we need to tell anyone that an order wasn't executed?
                    act['amount_changed'] = true; // Is this enough? For all cases?
                    if (act['market_order']) {
                        act['done'] = true; // something is obviously wrong and we're outta time. TODO: how did we get here?
                    }
                } else if (body['error'].match('Nonce must be greater')) {
                    l.w("Stupid nonce. Will try waiting");
                } else if (body['error'].match('Invalid API key')) {
                    process.exit(1); // What do I do about these?!
                } else if (body['error'].match('Total must be at least')) {
                    l.w("Order too small, just skip it.");
                    act['done'] = true;
                } else { 
                    l.e("Unhandled error. WAT DO");
                    process.exit(0);
                }
//                process.exit(0);
            } else {
                l.i(`\nOrder is good for ${order['mname']}! limit order response is ${JSON.stringify(body)}. ID is ${body['orderNumber']}`);
                order['id'] = body['orderNumber'];
//                act['active_orders'][order['rate']] = body; // or something. Do we get and amount as well? What about market? And move the id to first level plox
                act['active_orders'][order_rate] = order;
                l.d("Added order to act['active_orders'] = " + JSON.stringify(act['active_orders']));
                // This might take longer than for the next trigger to arrive. We need to store the order in a 'pending' hash for the interval between
                // issuing the order and receiving its ID so it can be removed.
            }
            l.d("Removing pending order act[pa][" + order_rate + "] = " + JSON.stringify(order));
            delete act['pending_add'][order_rate];
            l.d("pending_add is now " + JSON.stringify(act['pending_add']));
            if (Object.keys(act['pending_add']).length == 0 && Object.keys(act['pending_remove']).length == 0) {
                act['pending_timestamp'] = 0;
            }
        });
    }
}

//function replace_orders (my_orders, diff) {
function replace_orders (act, diff) {       // TODO: Add another stage of moving orders instead of cancelling and adding, if they are close enough

//    var orders = 0;

    if (Object.keys(diff['remove']).length == 0) { //TODO: also, if there are pending removals
        l.i("No orders to remove, going straight to add " + Object.keys(diff['add']).length + " new ones.");
        return set_new_orders(act, diff['add']);
    }

    if (Object.keys(diff['remove']).length == 1 && Object.keys(diff['add']).length == 1) {    // TODO: Expand to multiple pairs (if and when)
        let add = diff['add'][Object.keys(diff['add'])[0]];
        let remove = diff['remove'][Object.keys(diff['remove'])[0]];
//        if (utils.are_close (add['amount'], remove['amount'], c['PRICE_RESOLUTION'])) {

            act['pending_add'][add['rate']] = add;
            act['pending_remove'][remove['rate']] = remove;
            delete act['active_orders'][remove['rate']];
            act['pending_timestamp'] = Date.now();
            l.i("moveOrder: added " + add['rate'] + " to pending_add and moved " + remove['rate'] + " from active to pending_remove.");
            l.i("    (id = " + remove['id'] + " rate = " + add['rate'] + " amount = " + add['amount']);

            // moveOrder(orderNumber, rate, amount, immediateOrCancel, postOnly [, callback])
            polo.moveOrder(remove['id'], add['rate'], add['amount'], false, false, function (err, body) {

                l.i("moveOrder returned. body = " + JSON.stringify(body));
                if (err) {
                    l.e("\nFailed to move order: " + err);
                    if (body['error'].match('Invalid order number')) {
                        l.w("Nothing to move, will have to add a new one.");
                    } else if (body['error'].match('Invalid API key')) {
                        process.exit(1); // What do I do about these?!
                    } else {
                        act['active_orders'][remove['rate']] = remove; // prolly still exists
                    }
                } else {
                    l.i("\nSuccessfully moved " + act['mname'] + " from " + remove['rate'] + " to " + add['rate']);
                    add['id'] = body['orderNumber'];
                    act['active_orders'][add['rate']] = add;
                }
                delete act['pending_add'][add['rate']];
                delete act['pending_remove'][remove['rate']];
                if (Object.keys(act['pending_add']).length == 0 && Object.keys(act['pending_remove']).length == 0) {
                    act['pending_timestamp'] = 0;
                }
            });
            return;
//        }
    }

    for (var order_id in Object.keys(diff['remove'])) {

        order_rate = Object.keys(diff['remove'])[order_id];
        order = diff['remove'][order_rate];

        act['pending_remove'][order_rate] = order;
        delete act['active_orders'][order_rate];
        act['pending_timestamp'] = Date.now();

		remove_order(order, function (err) {

			if (err) {
				l.e(`Failed to remove order no. ${order['id']}: ${err}`);
			}
            act['order_archive'].push(order);
            delete act['pending_remove'][order_rate];
            if (Object.keys(act['pending_add']).length == 0 && Object.keys(act['pending_remove']).length == 0) {
                act['pending_timestamp'] = 0;
            }
//            console.log("Removed order " + orders + "/" + Object.keys(diff['remove']).length);
            l.i("Removed " + act['mname'] + " order at " + order['rate'] + '. ' + Object.keys(act['pending_remove']).length + " orders left to remove.");
//			if (++orders == Object.keys(diff['remove']).length) {       // TODO: Do this through act{} members
			if (Object.keys(act['pending_remove']).length == 0) {
                l.i("Removed all orders needing removal. Calling set_new_orders()");
				set_new_orders(act, diff['add']);
			}
		});
	}
}
