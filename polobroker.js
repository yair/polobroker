const Poloniex = require('poloniex-api-node');
const fs = require('fs');
const CircularJSON = require('circular-json');
var Inotify = require('inotify').Inotify;
var inotify = new Inotify();
const poloTrader = require('./poloTrader');
const moment = require('moment');
const utils = require('./utils');
const l = require ('./log');

// config (i.e. global consts)

const c = { //TODO: move to config file
    MINIMUM_TRADE: 0.0001,         // 10ksat @poloni
    MINIMUM_BTC_TRADE: 0.000001,   // 100sat @poloni
    PRICE_RESOLUTION: 0.00000001,  // 1sat @poloni
    PENDING_TIMEOUT: 15000,        // ms
    TIMER_PERIOD: 3000,            // ms
    LOG_STREAMS: false,
    VOLATILE_DIR: '/home/yair/w/volatile/',
    ORDERS_FN: 'orders.json',
    PAPER_TRADE: false, // Set orders on top of existing ones and don't execute
    BASEDIR: '/home/yair/w/dm_raw/sr/' + `${Math.floor(new Date() / 1000)}/`,
};

// Get secrets
var secrets;
var data = fs.readFileSync ('secrets.json', 'utf8');
secrets = JSON.parse(data);

// global vars
var acts = { sells: {}, buys: {}, archive: {} };
var markets = {};
var timer = null;
var poloniex = new Poloniex(secrets['key'], secrets['secret'], { nonce: () => Date.now() * 2000 });
var full_market_list = {};

// test polo login
poloniex.returnBalances(function (err, balances) {
      if (err) {
          l.e("Failed to login to polo: " + err);
          process.exit(1);
      } else {
          l.i("Successfully logged in." ); //+ JSON.stringify(balances));
      }
});

// Init exchange recorder
if (c['LOG_STREAMS']) {
    fs.mkdirSync(c['BASEDIR']);
    const actionsdir = `${c['BASEDIR']}actions/`;
    fs.mkdirSync(actionsdir);
    l.i(`Base folder created at ${c['BASEDIR']}`);
}

// Init trading module
poloTrader.init(c, poloniex);

// Testing - subscribing only to the ticker, and only when websocket is connected, to the rest of the coins.

l.i("Subscribing to polo ticker");
poloniex.subscribe('ticker');
subscribeToAllCoins();
// Set up polo handlers

if (c['LOG_STREAMS']) {
    ticker_stream = fs.createWriteStream(c['BASEDIR'] + 'ticker');
}

// subscribe to ticker and all ob channels, for later analysis

function subscribeToAllCoins () {
poloniex.returnTicker().then( async (ticker) => {
    l.i(`Got ${Object.keys(ticker).length} markets to subscribe to.`);
//    coin_list = ['USDT_BTC', 'BTC_ETH', 'BTC_XRP', 'BTC_XMR', 'BTC_LTC', 'BTC_ETH', 'BTC_STR'];

    for (market in Object.keys(ticker)) {
        let mname = Object.keys(ticker)[market];
        full_market_list[mname] = true;

        if (!(mname.match('BTC'))) { // TODO: match instead on ^BTC | BTC$
            continue;
        }

//        await sleep (500);

        if (c['LOG_STREAMS']) {
            let fname = c['BASEDIR'] + mname;
            markets[mname] = { 'stream': fs.createWriteStream(fname) };
        } else {
            markets[mname] = { 'mname': mname };
        }
        l.d(`Subscribing to ${mname}`);
        poloniex.subscribe(mname);
    }
    l.i("Opening WebSocket");
    poloniex.openWebSocket({ version: 2 });
//    poloniex.openWebSocket({ version: 2 });
}).catch((err) => {
          l.e(err.message);
});
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

poloniex.on('message', (channelName, data, seq) => {
    let line = {'time': Math.floor(new Date()),
                'seq': seq,
                'payload': data};
    if (channelName === 'ticker') {
        if (c['LOG_STREAMS']) {
            ticker_stream.write(`${JSON.stringify(line)}\n`);
        }
        updateFromTicker(data, seq);
    } else if (channelName in markets) {
        if (c['LOG_STREAMS']) {
            markets[channelName]['stream'].write(`${JSON.stringify(line)}\n`);
        }
        updateFromStream(channelName, data, seq);
    } else {
        l.e(`Unrecognized channel: ${channelName}`);
    }
});

function getLiveActs () {
    let lives = [];
    if (Object.keys(acts['sells']).length != 0) {
        lives = acts['sells'];
    } else if (Object.keys(acts['buys']).length != 0) {
        lives = acts['buys'];
    }
    return lives;
}
// Got ticker: {"currencyPair":"USDT_BCH","last":"1108.11028432","lowestAsk":"1109.69471785","highestBid":"1108.11028432","percentChange":"-0.03662371","baseVolume":"2090681.91008974","quoteVolume":"1833.11814815","isFrozen":0,"24hrHigh":"1158.15280956","24hrLow":"1109.21839460"}
function updateFromTicker (data, seq) {

    // return; // I think newTrade should have all the info we need. Dunno. :/

    let lives = getLiveActs();
    let mname = data['currencyPair'];
    
    if (seq == null) {
        seq = "blah" + Math.random();
    }

 //    console.log('updateFromTicker: seq = ' + seq + ' mname = ' + mname);

//    if (mname in Object.keys(lives)) {
    if (lives.hasOwnProperty(mname)) {
        l.d(`\nGot ticker for live market ${mname}! data['last']=${data['last']}`);
        if (c['PAPER_TRADE'] || was_our_order_hit (lives[mname], data['last']) || lives[mname]['market_order']) {
//        if (c['PAPER_TRADE'] || data['last'] in Object.keys(lives[mname]['active_orders'])) {   // Is this correct? Also for paper trading? Let's ease it for paper. TODO: pending too
            lives[mname]['amount_changed'] = 1;
            // def need hit trades for paper trading, and maybe not only.
            lives[mname]['exch_trades'][seq] = { 'ticker': data, }; // keep all trades? <--- key is seq!
//            console.log("---> NewTrade");
        }
    } else {
//        console.log(`updateFromTicker: '${mname}' != '${Object.keys(lives)[0]}'`);
    }
//    console.log("Got ticker: " + JSON.stringify(data));
//    We will want price and volume stats from here, eventually, but also maybe updating live balances. How is this different from 'newTrade' event?
}

function was_our_order_hit (act, price) {

    order_prices = Object.keys(act['active_orders']).concat(Object.keys(act['pending_add']), Object.keys(act['pending_remove']));

    for (order_id in order_prices) {

        order_price = order_prices[order_id];

        if (act['market_order']) {

            l.i("\nJust issued a market order. Must have been our order that was hit.");
            return true;
        }

        l.d("Comparing prices: " + price + " vs. " + order_price);

        if (utils.are_close (order_price, price, c['PRICE_RESOLUTION'])) {

            l.i("\nOur order might have hit! better go fetch balances and check.");
            return true;
        }
    }

    l.i("Nah, I guess our order wasn't hit.");
    return false;
}

function updateFromStream (mname, payload, seq) {

    let lives = getLiveActs();

//    console.log('updateFromStream: seq = ' + seq);

    for (item in payload) {
        let item_type = payload[item]['type'];
        let data = payload[item]['data'];
        if (item_type == 'orderBook') {
            markets[mname]['ob_asks'] = data['asks'];   // copy the whole thing
            markets[mname]['ob_bids'] = data['bids'];   // copy the whole thing
            l.i("Populated order book for " + mname);
        } else if (item_type == 'orderBookModify') {
            if (data['type'] == 'bid') {
                markets[mname]['ob_bids'][data['rate']] = data['amount'];
            } else if (data['type'] == 'ask') {
                markets[mname]['ob_asks'][data['rate']] = data['amount'];
            } else {
                l.e(`Unknown orderBookModify type: ${data['type']}`);
            }
        } else if (item_type == 'orderBookRemove') {
            delete markets[mname][data['type'] == 'ask' ? 'ob_asks' : 'ob_bids'][data['rate']];
		} else if (item_type == 'newTrade') {
// {"type":"newTrade","data":{"tradeID":"43691798","type":"buy","rate":"0.07939500","amount":"0.00213805","total":"0.00016975","date":"2018-06-05T10:52:06.000Z"}}
			// Update price and volume stats, I guess
            // No! This is also for adjusting remaining amount to trade! TODO
//            if (mname in Object.keys(lives)) {
            if (lives.hasOwnProperty(mname)) {
                l.i(`Someone's order was hit! data['rate']=${data['rate']}`);
//                if (c['PAPER_TRADE'] || data['rate'] in Object.keys(lives[mname]['active_orders'])) {   // Is this correct? Also for paper trading? Let's ease it for paper. TODO: pending too
                if (c['PAPER_TRADE'] || was_our_order_hit (lives[mname], data['rate']) || lives[mname]['market_order']) {
                    lives[mname]['amount_changed'] = 1;
                    // def need hit trades for paper trading, and maybe not only.
                    lives[mname]['exch_trades'][seq] = { 'newTrade': data, }; // keep all trades? <--- key is seq!
                    l.i("---> NewTrade");
                }
            } else {
//                console.log(`newTrade: '${mname}' != '${Object.keys(lives)[0]}'`);
            }
        } else {
            l.e(`Unfamiliar item type: ${item_type} payload: ${JSON.stringify(payload)}`);
        }
        if (mname in Object.keys(lives)) {
            lives[mname]['trigger'] = 1;
        }
    }

//    console.log(`lives: ${JSON.stringify(lives)}`);
    for (i in Object.keys(lives)) {
//        console.log(`i=${i} Object.keys(lives)[i]=${Object.keys(lives)[i]}`);
        let live = Object.keys(lives)[i];
//        let live = lives[Object.keys(lives)[i]];
//        let live = lives[i];
//        console.log(`lives[${live}]: ${lives[live]}`);
        if (lives[live].hasOwnProperty(['trigger']) && lives[live]['trigger'] == 1) {
            l.d(`Triggering ${live} from stream update`);
            lives[live]['trigger'] = 0;
            trigger(live);
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

function finalize (act) {

    acts['archive'][act['mname']] = act;
    delete acts[act['type'] == 'Buy' ? 'buys' : 'sells'][act['mname']];

    l.i(act['type'] + " " + act['coin_name'] + " archived. Now fetching and cancelling open orders.");

    act['post_session_kills'] = {};

    poloniex.returnOpenOrders(act['mname'], function (err, body) {

        if (err) {
            l.w("Giving up on fetching " + act['coin_name'] + " orders after getting error: " + err);
        } else {
            kills_left = Object.keys(body).length; // !=0 means a problems. These shouldn't exist.
            l.i("\nGot " + kills_left + " orders to cancel for " + act['mname']);
            for (osn in body) {
                order = body[osn];
                l.w("Cancelling stray order " + order['orderNumber'] + " in market " + act['mname']);
                act['post_session_kills'][order['rate']] = order;

                poloniex.cancelOrder(order['orderNumber'], function (err2, body2) {

                    if (err) {
                        l.e("Giving up on cancelling order " + order['orderNumber'] + " in market " + act['mname'] + " after getting error: " + err2);
//                        act['post_session_kills'][order['rate']]['killed'] = false;
                    } else {
                        l.w("Successfully cancelled order " + order['orderNumber'] + " in market " + act['mname'] + ": " + JSON.stringify(body2));
//                        act['post_session_kills'][order['rate']]['killed'] = true;
                    }

                    if (--kills_left == 0) {
                        archive_act(act);
                    }
                });
            }

            if (kills_left == 0) {
                l.i("\nNo stray orders on finalizing " + act['mname'] + ". Good!");
                archive_act(act);
            }
        }
    });
}

function archive_act (act) {

    fs.writeFile(c['VOLATILE_DIR'] + "act_archive_" + act['mname'] + "_" + Date.now() + ".json", JSON.stringify(act));
}

function trigger (mname) {
    l.i(`\nTriggered: ${mname}: ${Object.keys(acts['sells']).length} sells (${Object.keys(acts['sells'])}), ${Object.keys(acts['buys']).length} buys (${Object.keys(acts['buys'])})`); //TODO: replace newline with a logger flag
    if (mname == undefined) {
        l.e("Triggered on undefined market! Stack:");
        console.trace();
        return;
    }
    if (Object.keys(acts['sells']).length != 0 && acts['sells'].hasOwnProperty(mname)) {

        if (acts['sells'][mname]['done']) {
            l.i(`Sell ${mname} action done. Moving object to archive and nuking its open orders.`);
//            delete acts['sells'][mname]; // Actually, should archive these for later analysis
            finalize(acts['sells'][mname]);
            if (Object.keys(acts['sells']).length == 0) {
                for (act in acts['buys']) {
                    acts['buys'][act]['start'] = Date.now();
                }
            }
            return;
        }
        if (!acts['sells'][mname]['triggerRunning']) {
            acts['sells'][mname]['triggerRunning'] = true;
            poloTrader.triggerSell(mname, acts['sells'][mname], markets[mname]);
            acts['sells'][mname]['triggerRunning'] = false;
        }
    } else if (Object.keys(acts['buys']).length != 0 && acts['buys'].hasOwnProperty(mname)) {
    
        if (acts['buys'][mname]['done']) {
            l.i(`Buy ${mname} action done. Moving object to archive and nuking its open orders.`);
            finalize(acts['buys'][mname]);
//            delete acts['buys'][mname];
            return;
        }
        if (!acts['buys'][mname]['triggerRunning']) {
            acts['buys'][mname]['triggerRunning'] = true;
//            console.log('markets[' + mname + ']["ob_bids"]=');
//            console.log(markets[mname]['ob_bids']);
            poloTrader.triggerBuy(mname, acts['buys'][mname], markets[mname]);
            acts['buys'][mname]['triggerRunning'] = false;
        }
    } else {
        l.e(`Market ${mname} triggered but isn't alive`);
    }
}

function triggerAll () {

    if (Object.keys(acts['sells']).length != 0) {
        l.v("acts['sells'] = " + JSON.stringify(acts['sells']));
        for (act in Object.keys(acts['sells'])) {
//            trigger(acts['sells'][Object.keys(acts['sells'])[act]]);
            let mname = Object.keys(acts['sells'])[act];
            if (mname == undefined) continue; // This happens when the previous act has been deleted. TODO: rewrite
            l.v("triggerAll triggering a sell for " + mname);
//            trigger(Object.keys(acts['sells'])[act]);
            trigger(mname);
        }
    } else if (Object.keys(acts['buys']).length != 0) { // Don't start buying until sells are done.
        l.i("acts['buys'] = " + JSON.stringify(acts['buys']));
        for (act in Object.keys(acts['buys'])) {
//            trigger(acts['buys'][Object.keys(acts['buys'])[act]]);
            let mname = Object.keys(acts['buys'])[act];
            if (mname == undefined) continue;
            l.v("triggerAll triggering a buy for " + mname);
            trigger(mname);
//            trigger(Object.keys(acts['buys'])[act]);                    //TODO: Why does this trigger undefined markets?
        }
    } else {
        l.i("\ntriggerAll called with nothing to do. Finalizing session. timer=" + CircularJSON.stringify(timer)); // TODO: kill timer if not dead, or see why it's not dead.
        clearInterval(timer);
        if (fs.existsSync(c['VOLATILE_DIR'] + c['ORDERS_FN'])) {
            fs.copyFileSync(c['VOLATILE_DIR'] + c['ORDERS_FN'],
                            c['VOLATILE_DIR'] + c['ORDERS_FN'] + ".bak-" + moment(Date.now()).utc().format("YYYYMMDDHHmmss"));
    		fs.unlink (c['VOLATILE_DIR'] + c['ORDERS_FN'], function (err) { 
                if (err) {
    			    l.e(`${c['VOLATILE_DIR'] + c['ORDERS_FN']} failed to be removed: ` + err);
                } else {
        			l.e(`${c['VOLATILE_DIR'] + c['ORDERS_FN']} read and removed.`);
                }
    		});
        }
    }
}

/*
function launchAllSells() {
	let triggered = 0;
	for (market in Object.keys(markets)) {
		if (markets[market]['action']['type'] == 'Sell') {
			triggered++;
			trigger(markets[market]);
		}
	}
    if (triggered == 0) {
        launchAllBuys();
    }

}*/

// {"amount": 0.0035932955158229475, "price": 0.00015453562082257122, "previous_balance": 0.00140241, "mname": "USDT_BTC", "type": "Sell"}
function invert_action (action) {
    action['type'] = action['type'] == 'Buy' ? 'Sell' : 'Buy';
    action['price'] = 1. / action['price'];
}

//  {"timeout": 60, "actions": [{"type": "Sell", "mname": "USDT_BTC", "previous_balance": 0.0, "amount": 62534.996173497115, "price": 0.00013088973355479538}, {"type": "Buy", "mname": "BTC_ETH", "previous_balance": 0.0, "amount": 0.013593996348746794, "price": 0.07880499958992004}, {"type": "Buy", "mname": "BTC_BCH", "previous_balance": 1e-08, "amount": 12.224722972993568, "price": 8.758000330999494e-05}, {"type": "Buy", "mname": "BTC_LTC", "previous_balance": 0.0, "amount": 0.05016217873748306, "price": 0.021290000528097153}, {"type": "Buy", "mname": "BTC_STR", "previous_balance": 0.0, "amount": 0.0682594569234755, "price": 0.015684999525547028}]}
function processOrders () {
    if (Object.keys(acts['buys']) != 0 || Object.keys(acts['sells']) != 0) {
        l.w("ERROR: New batch arrived while older orders are still being processed. Aborting new batch!");
        return;
    }
	let fn = c['VOLATILE_DIR'] + c['ORDERS_FN'];
	fs.readFile (fn, 'utf8', function (err, data) {
        if (err) {
            l.e(`Error reading file ${fn}: ${err}`);
            return;
        }
        l.i(c['ORDERS_FN'] + " dump: " + data);
		json = JSON.parse(data);
		timeout = json['timeout'];
		actions = json['actions'];
//		let sells = [];
//		let buys = [];
		for (i in actions) {
            action = actions[i];
            if (action['mname'] == 'USDT_BTC') {
                invert_action(action);
            } else if (action['amount'] * action['price'] < c['MINIMUM_TRADE']) {
                continue;
            }
			let act = {
                mname: action['mname'],
				start: Date.now(),
                price: action['price'],
				timeout: timeout,
				prev_balance: action['previous_balance'],
				current_balance: action['previous_balance'],
				total_amount: action['amount'],
				type: action['type'],
                amount_changed: 0,
                trades: [],
                triggerRunning: false,
                done: false,
                exch_trades: {},
                fetching_balances: false,
                active_orders: {},
                pending_add: {},
                pending_remove: {},
                pending_timestamp: 0,
                order_archive: [],
                market_order: false,
                coin_name: coin_name_from_market (action['mname']),
                btc_balance: Number.POSITIVE_INFINITY,
			};
            l.d(`action: ${JSON.stringify(action)}`);
            if (!(act['mname'] in full_market_list)) {
                l.e(`Uknown market ${act['mname']}. Aborting.`);
                process.exit(1);
            }
            if (act['type'] == 'Sell' && (act['prev_balance'] + c['PRICE_RESOLUTION'] - act['total_amount'] < 0.)) {
//                if (act['mname'] != 'USDT_BTC') {
                    l.e(`Trying to sell more than we have. Aborting.`);
                    process.exit(1);
//                }
            }
            if (action['type'] == 'Sell') {
                acts['sells'][action['mname']] = act;
            } else if (action['type'] == 'Buy') {
                acts['buys'][action['mname']] = act;
            } else {
                l.e(`Unknown action: ${action['type']}. Aborting.`);
                process.exit(1);
            }
		}
//		launchAllSells();
        triggerAll();
        clearInterval(timer); // Maybe this'll stop the unkillable timers :/
        timer = setInterval (triggerAll, c['TIMER_PERIOD']);
        l.d("Setting timer no. " + CircularJSON.stringify(timer));
	});
}

function coin_name_from_market (market) {

    if (market == 'USDT_BTC') {
        return 'USDT';
    } else {
        return market.substring(4);
    }
/*    res = (/^BTC_(.*)$/, /^(.*)_BTC$/);

    for (re in res) {

        m = market.match(re);
        if (m != null) {

            console.log ("coin in market " + market + " is " + m[1]);
            return m[1];
        }
    }*/
}

poloniex.on('open', (err, body) => {
    if (err) {
//        console.log("Error on open: " + CircularJSON.stringify(err)); 'snot an error
    }
    if (body) {
//        console.log("Body on open: " + JSON.stringify(body));
    }
    l.i(`Poloniex WebSocket connection open. Opening fs listener.`);
/*	fs.watch('/home/yair/w/volatile/', {}, (eventType, filename) => {
		console.log(`Filename: ${filename}, eventType: ${eventType}`);
	});*/
	inotify.addWatch({
		path:		c['VOLATILE_DIR'],
		watch_for:	Inotify.IN_CLOSE,
		callback:	function (event) {
			if (event.name == c['ORDERS_FN']) {
			    l.i(`${event.name} closed.`);
				processOrders();
			}
		}
	});
//    console.log("Testing -- subscribing to coin streams after websocket open.");
//    subscibeToAllCoins ();
});

poloniex.on('close', (reason, details) => {
    l.e(`Poloniex WebSocket connection disconnected`);
});

poloniex.on('error', (error) => {
    l.e(`An error has occured: ${JSON.stringify(error)}`);
    process.exit(1);
});

poloniex.on('heartbeat', () => {
//  console.log('Heartbeat - 60 second timeout');
});


