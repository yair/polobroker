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

let poloniex = new Poloniex();

if (LOG_STREAMS) {
    ticker_stream = fs.createWriteStream(basedir + 'ticker');
}

// subscribe to ticker and all ob channels, for later analysis
poloniex.subscribe('ticker');

poloniex.returnTicker().then((ticker) => {
    for (market in Object.keys(ticker)) {
        let mname = Object.keys(ticker)[market];

        if (mname != 'BTC_ETH') {     // delme
            continue;
        }

        if (LOG_STREAMS) {
            let fname = basedir + mname;
            markets[mname] = { 'stream': fs.createWriteStream(fname) };
        } else {
            markets[mname] = { 'mname': mname };
        }
        console.log(`Subscribing to ${mname}`);
        poloniex.subscribe(mname);
    }
    poloniex.openWebSocket({ version: 2 });
}).catch((err) => {
          console.log(err.message);
});

poloniex.on('message', (channelName, data, seq) => {
    let line = {'time': Math.floor(new Date()),
                'seq': seq,
                'payload': data};
    if (channelName === 'ticker') {
        if (LOG_STREAMS) {
            ticker_stream.write(`${JSON.stringify(line)}\n`);
        }
        updateFromTicker(data, seq);
    } else if (channelName in markets) {
        if (LOG_STREAMS) {
            markets[channelName]['stream'].write(`${JSON.stringify(line)}\n`);
        }
        updateFromStream(channelName, data, seq);
    } else {
        console.log(`Unrecognized channel: ${channelName}`);
    }
});

function updateFromTicker (data, seq) {

//    We will want price and volume stats from here, eventually
}

function updateFromStream (mname, payload, seq) {

    for (item in payload) {
        let item_type = payload[item]['type'];
        let data = payload[item]['data'];
        if (item_type == 'orderBook') {
            markets[mname]['ob_asks'] = data['asks'];   // copy the whole thing
            markets[mname]['ob_bids'] = data['bids'];   // copy the whole thing
        } else if (item_type == 'orderBookModify') {
            if (data['type'] == 'bid') {
                markets[mname]['ob_bids'][data['rate']] = data['amount'];
            } else if (data['type'] == 'ask') {
                markets[mname]['ob_asks'][data['rate']] = data['amount'];
            } else {
                console.log(`Unknown orderBookModify type: ${data['type']}`);
            }
        } else if (item_type == 'orderBookRemove') {
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
 
    return Object.keys(ob).sort().map(x => [x, ob[x]]);
}

poloniex.on('open', () => {
    console.log(`Poloniex WebSocket connection open. Opening fs listener.`);
    
});

poloniex.on('close', (reason, details) => {
    console.log(`Poloniex WebSocket connection disconnected`);
});

poloniex.on('error', (error) => {
    console.log(`An error has occured: ${JSON.stringify(error)}`);
});

poloniex.on('heartbeat', () => {
//  console.log('Heartbeat - 60 second timeout');
});


