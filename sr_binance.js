//const Poloniex = require('poloniex-api-node');
const binance = require('node-binance-api')().options({
  APIKEY: '09UxIZ56EDIk3qDAhPYNmHvBiApnZaWhNu55H77xc3sZiY1g2S7BT5z35zFaXUyg',
  APISECRET: 'pDYr7ro4DMcFiH9fASjnYgna2jR3hIyVYqw8ePZed9Ulatoz5mq2JE9UrI3mSm7h',
  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
  test: true // If you want to use sandbox mode where orders are simulated
});
const fs = require('fs');
const u = require('./utils')

const TESTING = false;
let test_counter = 0;

const timestamp = `${Math.floor(new Date() / 1000)}`;
const basetmp = '/tmp/sr_binance/';
const stopfile = `${basetmp}stop`;
const basedir = `${basetmp}${timestamp}/`;
//const basedir = '/home/yair/w/dm_raw/sr/' + `${Math.floor(new Date() / 1000)}/`;
const archive = `/home/yair/w/dm_raw/sr_binance/srb_${timestamp}.txz`;

fs.mkdirSync(basedir);
console.log(`Base folder created at ${basedir}`);
let latest_depths = {};
let golden_ratio = 1.61803398875;

binance.prices (async (error, ticker) => {
//  console.log("prices()", ticker);
    for (market in Object.keys(ticker)) {
        let mname = Object.keys(ticker)[market];
        latest_depths[mname] = new Date();
		if (mname != 'BTCUSDT' && mname.substring(mname.length - 3, mname.length) != 'BTC')
			continue;
		let fname = `${basedir}${mname}`
        let stream = fs.createWriteStream(fname);
		binance.websockets.depth([mname], (depth) => {
        	stream.write(`${JSON.stringify(depth)}\n`);
            if ((new Date() - latest_depths[mname]) > 3600 * 1000 * golden_ratio) { // refresh partial OBs
		        binance.depth(mname, (error, depth, symbol) => {
                	stream.write(`${JSON.stringify(depth)}\n`);
        		}, 1000);
                latest_depths[mname] = new Date();
            }
		});
		binance.websockets.trades([mname], (trades) =>{
        	stream.write(`${JSON.stringify(trades)}\n`);
		});
		binance.depth(mname, (error, depth, symbol) => {
        	stream.write(`${JSON.stringify(depth)}\n`);
		}, 1000);
        await u.sleep(1000);
	}
//  console.log("Price of BTC: ", ticker.BTCUSDT);
});
return

binance.websockets.depth(['BNBBTC'], (depth) => {		// ok, that's one, now we also need the trades, and to get the initial ob.
  console.log(depth)
//  let {e:eventType, E:eventTime, s:symbol, u:updateId, b:bidDepth, a:askDepth} = depth;
/*  console.log(symbol+" market depth update");
  console.log("eventType: " + eventType)
  console.log("eventTime: " + eventTime)
  console.log("bidDepth: " + bidDepth)
  console.log("askDepth: " + askDepth)*/
//  console.log(bidDepth, askDepth);
});

binance.websockets.trades(['BNBBTC', 'ETHBTC'], (trades) => {
  console.log(trades)
/*  let {e:eventType, E:eventTime, s:symbol, p:price, q:quantity, m:maker, a:tradeId} = trades;
  console.log(symbol+" trade update. price: "+price+", quantity: "+quantity+", maker: "+maker);*/
});
/*
binance.websockets.depthCache(['BNBBTC'], (symbol, depth) => {
      let bids = binance.sortBids(depth.bids);
      let asks = binance.sortAsks(depth.asks);
      console.log(symbol+" depth cache update");
      console.log("bids", bids);
      console.log("asks", asks);
      console.log("best bid: "+binance.first(bids));
      console.log("best ask: "+binance.first(asks));
});*/

return
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
    if (TESTING && test_counter++ == 100) { // stop after a while if testing
        console.log("In testing mode. Stopping after 100 messages.");
        poloniex.closeWebSocket();
    }
    if (fs.existsSync(stopfile)) {          // stop if told to
        console.log(`Triggered to stop by the existence of ${stopfile}`);
        poloniex.closeWebSocket();
    }
    /* TODO:                                // stop if short on space
     * if (exec('df /', (err, stdout, stderr) => {
     *      if (stdout[1][5] >= 94%) {
     *          poloniex.closeWebSocket();
     *      }
     * });*/

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
    console.log(`Poloniex WebSocket connection disconnected. Archiving results.`);
    archive_results();
});

poloniex.on('error', (error) => {
    console.log(`An error has occured: ${JSON.stringify(error)}`);
});

poloniex.on('heartbeat', () => {
    console.log('Heartbeat - 60 second timeout');
});

console.log('2');

function archive_results () {

    const { exec } = require('child_process');

    exec(`cd ${basetmp} && tar cJf ${archive} ${timestamp}`, (err, stdout, stderr) => {

        if (err) {
            console.log(`Failed to archive session results: ${err}`);
            return;
        }

        console.log(`Results archiving done.`);
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        console.log(`Deleting uncompressed files from ${basedir}`);

        exec(`cd ${basetmp} && rm -Rf ${timestamp}`, (err, stdout, stderr) => {

            if (err) {
                console.log(`Failed to remove session uncompressed files: ${err}`);
                return;
            }

            console.log(`Removed uncompressed session files.`);
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
        });
    });
}
