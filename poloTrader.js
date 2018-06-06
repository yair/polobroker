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
        console.log("Dunno how to sell!");
    },

//  act={"start":1528285827585,"timeout":60,"prev_balance":0,"current_balance":0,"total_amount":74.86000318514343,"type":"Buy","my_orders":{},"amount_changed":0,"trades":[],"triggerRunning":true,"done":false}
    triggerBuy: function(mname, act, market) {
        console.log(`triggerBuy: act=${JSON.stringify(act)}`);
        let continued = false;
        if (act['amount_changed']) {
            act['amount_changed'] = false;
            if (c['PAPER_TRADE']) {
                for (i in Object.keys(act['exch_trades'])) {
                    trade = act['exch_trades'][i];
                    act['current_balance'] = Math.min (act['current_balance'] + act['total_amount'],
                                                       act['current_balance'] + trade['amount']);
                    delete act['exch_trades'][trade];
                }
            } else {    // This takes a long time, but we don't know if the executed trade was due to our order
                continued = true;
                poloniex.returnBalances(function (err, balances) {
                    if (err) {
                        console.log("Failed to get balances: " + err.message);
                    } else {
                        console.log(balances);
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
    act['done'] = true;
}

function done_or_buy (mname, act, market) {

    if (act['prev_balance'] + act['total_amount'] <= act['current_balance'] + c['MINIMUM_TRADE']) {

        console.log(`Current balance is ${act['current_balance']}. We wanted ${act['prev_balance'] + act['total_amount']}, so that's enough.`);
        return finalize_act(mname, act);;
    }

    remaining_amount = act['prev_balance'] + act['total_amount'] - act['current_balance'];

    new_orders = orderConfabulator.calc_new_orders(mname, act, market, remaining_amount);

    diff = order_diff (act['my_orders'], new_orders);

    replace_orders(act['my_orders'], diff);
}

function order_diff (old_orders, new_orders) {

//    old_orders = JSON.parse (JSON.stringify (orders));
    diff = { remove: {}, add: {} };

    for (old_order in old_orders) {
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
            if (old_order['amount'] != new_orders[old_order]['amount']) { // same price, different amount
                diff['remove'][old_order] = old_orders[old_order];
                diff['add'][old_order] = new_orders[old_order];
                delete old_orders[old_order];
            }
            delete new_orders[old_order];
        } else {
            diff['remove'][old_order] = old_orders[old_order];
            delete old_orders[old_order];
        }
    }
    for (new_order in new_orders) {
        diff['add'][new_order] = new_orders[new_order];
    }
    return diff;
}

function remove_order(order, callback) {

    if (!c['PAPER_TRADE']) {
        polo.cancelOrder(order['id'], callback)
    }
}


function add_order(order, callback) {
//        add order to hash of orders !!! after you have and id for it !!!
    if (!c[PAPER_TRADE]) {
        if (order['type'] == 'Buy') {
            polo.buy(order['mname'], order['rate'], order['amount'], false, false, false, callback);
        } else {
            polo.sell(order['mname'], order['rate'], order['amount'], false, false, false, callback);
        }
    }
}

function set_new_orders(my_orders, adds) {

    for (var order in adds) {

//        if  order exists, WAT...
//        if paper_trade, ehm... do nothing? how do you transact?
//        else
//            set up the order, and put the id in the book.

        add_order(order, function (err, body) {

            if (err) {
                console.log("Failed to add order: " + err);
            } else {
                console.log(`limit order response is ${body}. Add id to order!`);
                my_orders[body['rate']] = body; // or something. Do we get and amount as well? What about market? And move the id to first level plox
            }
        });
    }
}

function replace_orders (my_orders, diff) {

    var orders = 0;

    if (diff['remove'].length == 0)
        return set_new_orders(diff['add']);

    for (var order in diff['remove']) {

		remove_order(order, function (err) {

			if (err) {
				console.log(`Failed to remove order no. ${order['id']}: ${err}`);
			}
			if (++orders == diff['remove'].length) {
				set_new_orders(my_orders, diff['add']);
			}
		});
	}
}
