
function getSortedOB(ob) {
 
    return Object.keys(ob).sort(function (a, b) { return a - b }).map(x => [x, ob[x]]);
};

function midprice(market) {
    return .5 * (getSortedOB(market['ob_bids']).reverse()[0][0] + getSortedOB(market['ob_asks'])[0][0]);
}

function get_depth_price (no_deeper_than, ob) {
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
}
