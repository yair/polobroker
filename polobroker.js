const Poloniex = require('poloniex-api-node');
const fs = require('fs');

const LOG_STREAMS = false;
const LOG_ACTIONS = true;

const basedir = '/home/yair/w/dm_raw/sr/' + `${Math.floor(new Date() / 1000)}/`;
fs.mkdirSync(basedir);
const actionsdir = `${basedir}actions/`;
fs.mkdirSync(actionsdir);
console.log(`Base folder created at ${basedir}`);
let markets = {};

//let poloniex = new Poloniex({'proxy': '127.0.0.1:4711'});
let poloniex = new Poloniex();

if (LOG_STREAMS) {
    ticker_stream = fs.createWriteStream(basedir + 'ticker');
}

poloniex.subscribe('ticker');

poloniex.returnTicker().then((ticker) => {
//          console.log(ticker);
//    console.log(Object.keys(ticker));
    for (market in Object.keys(ticker)) {
        let mname = Object.keys(ticker)[market];

        if (mname != 'BTC_ETH') {     // delme
            continue;
        }

//        console.log(`Subscribing to ${Object.keys(ticker)[market]}`);
        if (LOG_STREAMS) {
            let fname = basedir + mname;
//        console.log(`opening writable stream for ${mname}: ${fname}`);
            markets[mname] = { 'stream': fs.createWriteStream(fname) };
//        console.log(`Stream for ${mname} opened.`);
        } else {
            markets[mname] = { 'mname': mname };
        }
        console.log(`Subscribing to ${mname}`);
        poloniex.subscribe(mname);  // here or on fs stream open?
    }
    console.log('2.5');
    poloniex.openWebSocket({ version: 2 });
    console.log('3');
}).catch((err) => {
          console.log(err.message);
});

//return;

//poloniex.subscribe('BTC_ETC');

console.log('1');
poloniex.on('message', (channelName, data, seq) => {
    let line = {'time': Math.floor(new Date()),
                'seq': seq,
                'payload': data};
    if (channelName === 'ticker') {
//              console.log(`Ticker: ${JSON.stringify(data)}`);
//        ticker_stream.write(`${JSON.stringify(data)}\n`);
        if (LOG_STREAMS) {
            ticker_stream.write(`${JSON.stringify(line)}\n`);
        }
        updateFromTicker(data, seq);

    } else if (channelName in markets) {
//        console.log(`Writing to markets[${channelName}]=${JSON.stringify(markets[channelName])}`);
        if (LOG_STREAMS) {
            markets[channelName]['stream'].write(`${JSON.stringify(line)}\n`);
        }
        updateFromStream(channelName, data, seq);
    } else {
        console.log(`Unrecognized channel: ${channelName}`);
    }

//      if (channelName === 'BTC_ETC') {
//              console.log(`/order book and trade updates received for currency pair ${channelName}`);
//              console.log(`|data sequence number is ${seq}`);
//              console.log(`Order book update ${seq} for ${channelName}: ${JSON.stringify(data)}`);
//            }
});

function updateFromTicker (data, seq) {

//    We will want price and volume stats from here, eventually
//    console.log ("Hello from updateFromTicker()");
}

function updateFromStream (mname, payload, seq) {

// {"time":1528097394703,"seq":21799528,"payload":[{"type":"orderBookModify","data":{"type":"bid","rate":"0.38950016","amount":"0.17200000"}}]}
// {"time":1528102259498,"seq":21799529,"payload":[{"type":"orderBookRemove","data":{"type":"ask","rate":"0.42496919","amount":"0.00000000"}},{"type":"orderBookModify","data":{"type":"ask","rate":"0.42070720","amount":"0.00044029"}}]}
// {"time":1528097393972,"seq":21799527,"payload":[{"type":"orderBook","data":{"asks":{"0.41437801":"0.09631826","0.41439677":"0.00173136","0.41453870":"0.00173136","0.
//    console.log ("Hello from updateFromStream()");
//    console.log(`payload=${JSON.stringify(payload)}`);
    for (item in payload) {
        let item_type = payload[item]['type'];
        let data = payload[item]['data'];
//        console.log(`item_type = ${item_type}`);
        if (item_type == 'orderBook') {
//            console.log('new orderBook');
            markets[mname]['ob_asks'] = data['asks'];   // copy the whole thing
            markets[mname]['ob_bids'] = data['bids'];   // copy the whole thing
        } else if (item_type == 'orderBookModify') {
//            console.log('orderBookModify');
            if (data['type'] == 'bid') {
                markets[mname]['ob_bids'][data['rate']] = data['amount'];
            } else if (data['type'] == 'ask') {
                markets[mname]['ob_asks'][data['rate']] = data['amount'];
            } else {
                console.log(`Unknown orderBookModify type: ${data['type']}`);
            }
        } else if (item_type == 'orderBookRemove') {
//            console.log('orderBookRemove');
            delete markets[mname][data['type'] == 'ask' ? 'ob_asks' : 'ob_bids'][data['rate']];
        } else {
            console.log(`Unfamiliar item type: ${item_type}`);
        }
    }

    // updateOBstats()
    //
    // if ('trading' in Object.keys(markets['mname']))
    //      trigger order recalc

//    if (!seq%20) {

//        console.log ("asks=" + JSON.stringify (getSortedOB (markets[mname]['ob_asks']).slice(0, 5)));
//        console.log ("bids=" + JSON.stringify (getSortedOB (markets[mname]['ob_bids']).slice(-5).reverse()));
//    }
}

function getSortedOB (ob) {
//    var skeys = Object.keys(ob)
//    for (var key in ob) keys.push (key);

//    array = [];
//    for (skey in Object.keys(ob).sort()) {
//        array.push([skey, ob[skey]]);
//    }
 
    return Object.keys(ob).sort().map(x => [x, ob[x]]);
//    return Object.keys(ob).sort().map(x => {x, ob[x]});
/*  ret = [];
    function getSortedKeys(obj) {
            var keys = []; for(var key in obj) keys.push(key);
            return keys.sort(function(a,b){return obj[b]-obj[a]});
    }*/
}

poloniex.on('open', () => {
      console.log(`Poloniex WebSocket connection open`);
});

poloniex.on('close', (reason, details) => {
      console.log(`Poloniex WebSocket connection disconnected`);
});

poloniex.on('error', (error) => {
      console.log(`An error has occured: ${JSON.stringify(error)}`);
});

poloniex.on('heartbeat', () => {
//      console.log('Heartbeat - 60 second timeout');
});

console.log('2');

