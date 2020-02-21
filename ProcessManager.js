const Process = require('./Process');

class ProcessManager {
    constructor() {
        this.monitors = [];
    }

    start(script, options, type, events) {
        const monitor = new Process(script, options, type);
        this.monitors.push(monitor);
        this.logEvents(monitor, events);
        monitor.start();
    }

    findByUid(uid, type) {
        const filterMonitors = this.monitors.filter(m => m.uid === uid && m.type === type);

        if (filterMonitors.length > 0) {
            return filterMonitors;
        }

        return [];
    }

    // restartByUid(uid) {
    //     const monitor = this.findByUid(uid);
    //     if (monitor) {
    //         monitor.restart();
    //     }
    // }

    stopByUid(uid, type) {
        const monitors = this.findByUid(uid, type);

        if (monitors && monitors.length) {
            monitors.forEach(m => {
                if (m.running) {
                    m.stop();
                }
            });
        }
    }

    killByUid(uid, type) {
        const monitors = this.findByUid(uid, type);

        if (monitors && monitors.length) {
            monitors.forEach(m => {
                if (m.running) {
                    m.kill();
                }
            });
       }
    }

    logEvents(monitor, events) {
        
        monitor.on('watch:restart', function (info) {
            forever.out.error('restarting script because ' + info.file + ' changed');
        });
        
        monitor.on('restart', function () {
            console.log(`Process with uid ${monitor.uid} restarted`);
        });

        monitor.on('error', function (err) {
            console.log('error occurs', err);
        });

        monitor.on('stdout', function(data) {
            console.log(data.toString());
        });

        monitor.on('stderr', function(data) {
            console.log('stderr error', data.toString());
        });
    
        monitor.on('exit:code', function (code, signal) {
            console.log(`Process with uid ${monitor.uid} stop with code: ${code}`);

            if (events && events.onExit) {
                events.onExit(code);
            }
        });
    }
}

module.exports = ProcessManager;