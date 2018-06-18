
module.exports = {

    are_close: function (a, b, distance) {
        if (parseFloat(a) - parseFloat(b) < parseFloat(distance) &&
            parseFloat(b) - parseFloat(a) < parseFloat(distance)) {
            return true;
        }
        return false;
    },
};

