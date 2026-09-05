// pm2 process definition for the relay.

module.exports = {
    apps: [{
        name: 'pombo-relay',
        script: 'index.js',
        cwd: __dirname,
        exec_mode: 'fork',
        instances: 1,
        autorestart: true,
        // The embedded Streamr network node can grow to several GB over a day,
        // so cap the process rather than let the host reach its OOM killer.
        max_memory_restart: '1500M',
        // Without this pm2 appends the process id to the log file names, so a
        // delete/start cycle silently moves the logs to a new path.
        merge_logs: true,
        time: true
    }]
};
