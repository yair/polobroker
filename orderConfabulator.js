var polo = null;
var c = null;

module.exports = {

    init: function (config, _polo) {
        polo = _polo;
        c = config;
    },

//  act={"start":1528285827585,"timeout":60,"prev_balance":0,"current_balance":0,"total_amount":74.86000318514343,"type":"Buy","my_orders":{},"amount_changed":0,"trades":[],"triggerRunning":true,"done":false}
    //
    calc_new_orders: function (mname, act, market, remaining_amout) {

        if (act['type'] != 'Buy') {
            console.log('Cannot confabulate sell orders.');
            return;
        }

        now = Date.now();

        // Trivial stupid ass thing
        if (now - act['start'] > act['timeout'] * 1000) {
            return marketBuy(mname, remaining_amount, market);
        }

        price = getSortedOB(market['ob_bids']).reverse()[0][0] + c['PAPER_TRADE'] ? 0 : c['PRICE_RESOLUTION'];

        return [{'mname': mname,
                 'rate': price,
                 'type': 'Buy',
                 'amount': remaining_amount }];
    },

};

function getSortedOB(ob) {
 
    return Object.keys(ob).sort().map(x => [x, ob[x]]);
};

function marketBuy(mname, remaining_amount, market) {

    price = 2 * getSortedOB(market['ob_bids']).reverse()[0][0];

    return [{'mname': mname,
             'rate': price,
             'type': 'Buy',
             'amount': remaining_amount }];
}
