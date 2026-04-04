const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'crash.log');

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

function log(msg) {
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${msg}\n`);
}

log("Starting wrapper...");

try {
    require('./index.js');
    log("index.js required successfully.");
} catch (err) {
    log(`CRASH: ${err.message}\n${err.stack}`);
    console.error(err);
    process.exit(1);
}
