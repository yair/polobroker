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
        return .5 * (getSortedOB(market['ob_bids']).reverse()[0][0] + getSortedOB(market['ob_asks'])[0][0]);
    },

    get_depth_price: function  (no_deeper_than, ob) {
        console.log ('get_depth_price: no_deeper_than = ' + str(no_deeper_than) + 'altsat');
        v = 0;
        i = 0;
        for ((price, volume) in ob) {
            i++;
            console.log('price = ' + str(price) + 'bsat => v + volume = ' + str(v) + 'altsat + ' + str(volume) + 'altsat');
            if (v + volume > no_deeper_than) {
                return price;
            } else {
                v += volume;
            }
        }
        throw "OB depleted";
    },
};

