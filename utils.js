module.exports = {

    are_close: function (a, b, distance) {
        if (parseFloat(a) - parseFloat(b) < parseFloat(distance) &&
            parseFloat(b) - parseFloat(a) < parseFloat(distance)) {
            return true;
        }
        return false;
    },

    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    getSortedOB: function (ob) {
 
        return Object.keys(ob).sort(function (a, b) { return a - b }).map(x => [x, ob[x]]);
    },

    midprice: function (market) {
        getSortedOB = module.exports['getSortedOB'];
//        console.log('midprice: mname=' + market['mname'] + ' bottom=' + getSortedOB(market['ob_bids']).reverse()[0][0] + ' top=' + getSortedOB(market['ob_asks'])[0][0]);
        ret = .5 * (parseFloat(getSortedOB(market['ob_bids']).reverse()[0][0]) + parseFloat(getSortedOB(market['ob_asks'])[0][0]));
//        console.log('midprice: returning ' + ret);
        return ret;
//        return .5 * (getSortedOB(market['ob_bids']).reverse()[0][0] + getSortedOB(market['ob_asks'])[0][0]);
    },

    get_depth_price: function  (no_deeper_than, ob) {
        console.log ('get_depth_price: no_deeper_than = ' + no_deeper_than + 'alt');
        v = 0;
//        i = 0;
//        for ((price, volume) in ob) {
        for (order in ob) {
            price = ob[order][0];
            volume = ob[order][1];
//            i++;
            console.log('price = ' + price + 'bsat => v + volume = ' + v + 'altsat + ' + volume + 'altsat');
            if (parseFloat(v) + parseFloat(volume) > no_deeper_than) {
                return price;
            } else {
                v += parseFloat(volume);
            }
        }
        throw "OB depleted";
    },
};

