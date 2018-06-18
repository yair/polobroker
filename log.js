
// levels
// c - critical
// e - error
// w - warning
// i - info
// d - debug
// v - verbose

var defaults = {

    min = 'd',
    color = 'f',
    level = info,
};

module.exports = {

    log = function (payload, options) {

        opts = get_opts (options);

        console.log (payload);
    }
}

function get_opts (options) {

    var o = defaults;

    for (i in Object.keys(options)) {

        key = Object.keys(options)[i];
        o[key] = options[key];
    }

    return o;
}
