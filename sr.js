const Poloniex = require('poloniex-api-node');
const fs = require('fs');

const basedir = '/home/yair/w/dm_raw/sr/' + `${Math.floor(new Date() / 1000)}/`;
fs.mkdirSync(basedir);
console.log(`Base folder created at ${basedir}`);
let markets = {};

//let poloniex = new Poloniex({'proxy': '127.0.0.1:4711'});
let poloniex = new Poloniex();

ticker_stream = fs.createWriteStream(basedir + 'ticker');
poloniex.subscribe('ticker');

poloniex.returnTicker().then((ticker) => {
//          console.log(ticker);
//    console.log(Object.keys(ticker));
    for (market in Object.keys(ticker)) {
        let mname = Object.keys(ticker)[market];
//        console.log(`Subscribing to ${Object.keys(ticker)[market]}`);
        let fname = basedir + mname;
//        console.log(`opening writable stream for ${mname}: ${fname}`);
        markets[mname] = { 'stream': fs.createWriteStream(fname) };
//        console.log(`Stream for ${mname} opened.`);
        console.log(`Subscribing to ${mname} => ${fname}`);
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
        ticker_stream.write(`${JSON.stringify(line)}\n`);
    } else if (channelName in markets) {
//        console.log(`Writing to markets[${channelName}]=${JSON.stringify(markets[channelName])}`);
        markets[channelName]['stream'].write(`${JSON.stringify(line)}\n`);
    } else {
        console.log(`Unrecognized channel: ${channelName}`);
    }

//      if (channelName === 'BTC_ETC') {
//              console.log(`/order book and trade updates received for currency pair ${channelName}`);
//              console.log(`|data sequence number is ${seq}`);
//              console.log(`Order book update ${seq} for ${channelName}: ${JSON.stringify(data)}`);
//            }
});

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
      console.log('Heartbeat - 60 second timeout');
});

console.log('2');

