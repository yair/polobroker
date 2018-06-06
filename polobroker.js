const Poloniex = require('poloniex-api-node');
const fs = require('fs');
var Inotify = require('inotify').Inotify;
var inotify = new Inotify();
const poloTrader = require('./poloTrader');

const c = { //TODO: move to config file
    MINIMUM_TRADE: 0.0001,         // 10ksat @poloni
    PRICE_RESOLUTION: 0.00000001,  // 1sat @poloni
    LOG_STREAMS: false,
    VOLATILE_DIR: '/home/yair/w/volatile/',
    ORDERS_FN: 'orders.json',
    PAPER_TRADE: true, // Set orders on top of existing ones and don't execute
};

var acts = { sells: {}, buys: {} };

const basedir = '/home/yair/w/dm_raw/sr/' + `${Math.floor(new Date() / 1000)}/`;
if (c['LOG_STREAMS']) {
    fs.mkdirSync(basedir);
    const actionsdir = `${basedir}actions/`;
    fs.mkdirSync(actionsdir);
    console.log(`Base folder created at ${basedir}`);
}
let markets = {};
var timer = null;

let poloniex = new Poloniex();

poloTrader.init(c, poloniex);

if (c['LOG_STREAMS']) {
    ticker_stream = fs.createWriteStream(basedir + 'ticker');
}

// subscribe to ticker and all ob channels, for later analysis
poloniex.subscribe('ticker');                                           // TODO: move these to poloniex.on('open'), maybe they'll work. Why did they stop?!

poloniex.returnTicker().then((ticker) => {
    for (market in Object.keys(ticker)) {
        let mname = Object.keys(ticker)[market];

        if (mname != 'BTC_USDT') {     // delme
            continue;
        }

        if (c['LOG_STREAMS']) {
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
        console.log(`Unrecognized channel: ${channelName}`);
    }
});

function updateFromTicker (data, seq) {

//    We will want price and volume stats from here, eventually, but also maybe updating live balances. How is this different from 'newTrade' event?
}

function updateFromStream (mname, payload, seq) {

    let lives = [];
    if (Object.keys(acts['sells']).length != 0) {
        lives = acts['sells'];
    } else if (Object.keys(acts['buys']).length != 0) {
        lives = acts['buys'];
    }

    for (item in payload) {
        let item_type = payload[item]['type'];
        let data = payload[item]['data'];
        if (item_type == 'orderBook') {
            markets[mname]['ob_asks'] = data['asks'];   // copy the whole thing
            markets[mname]['ob_bids'] = data['bids'];   // copy the whole thing
            console.log("Populated order book for " + mname);
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
		} else if (item_type == 'newTrade') {
// {"type":"newTrade","data":{"tradeID":"43691798","type":"buy","rate":"0.07939500","amount":"0.00213805","total":"0.00016975","date":"2018-06-05T10:52:06.000Z"}}
			// Update price and volume stats, I guess
            // No! This is also for adjusting remaining amount to trade! TODO
            if (mname in Object.keys(lives)) {
                if (data['rate'] in Object.keys(lives[mname]['my_orders'])) {
                    lives[mname]['amount_changed'] = 1;
                    // def need hit trades for paper trading, and maybe not only.
                    lives[mname]['exch_trades'][seq] = data; // keep all trades?
                }
            }
        } else {
            console.log(`Unfamiliar item type: ${item_type} payload: ${JSON.stringify(payload)}`);
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
            console.log(`Triggering ${live} from stream update`);
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

function trigger (mname) {
    console.log(`Triggered: ${mname}: ${Object.keys(acts['sells']).length} sells, ${Object.keys(acts['buys']).length} buys (${Object.keys(acts['buys'])})`);
    if (Object.keys(acts['sells']).length != 0 && acts['sells'].hasOwnProperty(mname)) {

        if (acts['sells'][mname]['done']) {
            console.log(`Sell ${mname} action done. Deleting object.`);
            delete acts['sells'][mname]; // Actually, should archive these for later analysis
            return;
        }
        if (!acts['sells'][mname]['triggerRunning']) {
            acts['sells'][mname]['triggerRunning'] = true;
            poloTrader.triggerSell(mname, acts['sells'][mname], markets[mname]);
            acts['sells'][mname]['triggerRunning'] = false;
        }
    } else if (Object.keys(acts['buys']).length != 0 && acts['buys'].hasOwnProperty(mname)) {
    
        if (acts['buys'][mname]['done']) {
            console.log(`Buy ${mname} action done. Deleting object.`);
            delete acts['buys'][mname];
            return;
        }
        if (!acts['buys'][mname]['triggerRunning']) {
            acts['buys'][mname]['triggerRunning'] = true;
            console.log('markets[' + mname + ']["ob_bids"]=');
            console.log(markets[mname]['ob_bids']);
            poloTrader.triggerBuy(mname, acts['buys'][mname], markets[mname]);
            acts['buys'][mname]['triggerRunning'] = false;
        }
    } else {
        console.log(`Market ${mname} triggered but isn't alive`);
    }
}

function triggerAll () {

    if (Object.keys(acts['sells']).length != 0) {
        for (act in Object.keys(acts['sells'])) {
//            trigger(acts['sells'][Object.keys(acts['sells'])[act]]);
            trigger(Object.keys(acts['sells'])[act]);
        }
    } else if (Object.keys(acts['buys']).length != 0) { // Don't start buying until sells are done.
        for (act in Object.keys(acts['buys'])) {
//            trigger(acts['buys'][Object.keys(acts['buys'])[act]]);
            trigger(Object.keys(acts['buys'])[act]);
        }
    } else {
        console.log("triggerAll called with nothing to do. Finalizing.");
        clearInterval(timer);
		fs.unlink (c['VOLATILE_DIR'] + c['ORDERS_FN'], function (err) { 
			console.log(`${c['VOLATILE_DIR'] + c['ORDERS_FN']} read and removed.`);
		});
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

// {"timeout": 60, "actions": [["Buy", "BTC_USDT", 0, 74.86000318514343]]}
function processOrders () {
    if (Object.keys(acts['buys']) != 0 || Object.keys(acts['sells']) != 0) {
        console.log("ERROR: New batch arrived while older orders are still being processed. Aborting new batch!");
        return;
    }
	let fn = c['VOLATILE_DIR'] + c['ORDERS_FN'];
	fs.readFile (fn, 'utf8', function (err, data) {
        if (err) {
            console.log(`Error reading file ${fn}: ${err}`);
            return;
        }
		json = JSON.parse(data);
		timeout = json['timeout'];
		actions = json['actions'];
//		let sells = [];
//		let buys = [];
		for (i in actions) {
            action = actions[i];
			let act = {
				start: Date.now(),
				timeout: timeout,
				prev_balance: action[2],
				current_balance: action[2],
				total_amount: action[3],
				type: action[0],
                my_orders: {},
                amount_changed: 0,
                trades: [],
                triggerRunning: false,
                done: false,
			};
            console.log(`action: ${action}`);
            if (action[0] == 'Sell') {
                acts['sells'][action[1]] = act;
            } else if (action[0] == 'Buy') {
                acts['buys'][action[1]] = act;
            } else {
                console.log(`Unknown action: ${action[0]}`);
            }
		}
//		launchAllSells();
        triggerAll();
        timer = setInterval (triggerAll, 1000);
	});
}

poloniex.on('open', () => {
    console.log(`Poloniex WebSocket connection open. Opening fs listener.`);
/*	fs.watch('/home/yair/w/volatile/', {}, (eventType, filename) => {
		console.log(`Filename: ${filename}, eventType: ${eventType}`);
	});*/
	inotify.addWatch({
		path:		c['VOLATILE_DIR'],
		watch_for:	Inotify.IN_CLOSE,
		callback:	function (event) {
			console.log(`${event.name} closed.`);
			if (event.name == c['ORDERS_FN']) {
				processOrders();
			}
		}
	});
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


