const forever = require('forever-monitor');
const Monitor = forever.Monitor;

class Process extends Monitor {
    constructor(script, options, type) {
        super(script, options);
        this.type = type;
    }
}

module.exports = Process;