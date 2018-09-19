const orderConfabulator = require('./orderConfabulator');

// loop over data file, and maintain state (ob, stats). Every once in a while, an action arrives, and the confabulator is used to decide how to trade it.
// Doesn't sound like a lot of fun, also, some duplication. Shouldn't we be doing it with the poloTrader code? It already maintains all this stuff.
// Yeah, we should manually drive the handlers and fake the time. That should work. There might be many places to fake the time. Perhaps we should put it in the handlers.
