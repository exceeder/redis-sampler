/**
 * Runs 10k samples against a Redis server to collect some stats.
 * License: Apache 2.0
 */

const redis = require("redis");
let host = '127.0.0.1';
let port = 6379;

//parse optional arguments
if (process.argv.length > 2) {
    let redisURL = process.argv[2].split(":");
    host = redisURL[0];
    if (redis[1] !== undefined) {
        port = Number.parseInt(redisURL[1]);
    }
}

//create Redis client connection
let client = redis.createClient(port,host);

client.on("error", function (err) {
    console.log("Error " + err);
});

const stats = {
    sampleSize: 0,
    knownKeys: {},
    types: {},
    prefixes: {}
};

function incFreq(hash, item, amount) {
    if (hash[item] === undefined) {
        hash[item] = 1
    } else {
        hash[item] += amount ? amount : 1;
    }
}

function sample(size) {
    stats.sampleSize = size;
    client.dbsize((err, res) => {
        stats.dbsize = res;
    });
    for (let i = 0; i < size; i++) {
        sampleIteration(i);
    }
}

function examineAsync(key) {
    let type = new Promise((resolve, reject) => {
        client.type(key, (err, res) => {
            if (err) reject(err); else resolve(res);
        });
    });
    let ttl = new Promise((resolve, reject) => {
        client.ttl(key, (err, res) => {
            if (err) reject(err); else resolve(res);
        });
    });
    let debug = new Promise((resolve, reject) => {
        client.debug("OBJECT", key, (err, res) => {
            if (err) reject(err); else {
                let arr = res.split(' ');
                let ret = {};
                arr.forEach(kv => {
                    let pair = kv.split(":");
                    if (pair.length > 1) {
                        ret[pair[0]] = isNaN(pair[1]) ? pair[1] : parseFloat(pair[1]);
                    }
                });
                resolve(ret);
            }
        });
    });
    return Promise.all([type, ttl, debug]);
}

function sampleIteration(idx) {
    client.sendCommand('RANDOMKEY', function (err, key) {
        //console.log(idx + ": " + key);
        examineAsync(key).then(v => {
            addSample(key, v[0], v[1], v[2]);
            if (idx === stats.sampleSize - 1) {
                printResults();
                client.quit();
            }
        }).catch(err => console.log(err.message));
    });
}

function addSample(key, type, ttl, debug) {
    if (stats.knownKeys[key] !== undefined) {
        return;
    }
    stats.knownKeys[key] = key;
    incFreq(stats.types, type);
    let splits = key.split(/[\s,:."]/);
    splits = splits.filter(e => e !== ''); //remove empties
    if (splits.length > 1) {
        addPrefixSample(splits[0], ttl, debug, 1);
    }
    if (splits.length > 2) {
        addPrefixSample(splits[0]+"~"+splits[1], ttl, debug, 2);
    }
}

function addPrefixSample(prefix, ttl, debug, level) {
    let p = stats.prefixes[prefix];
    if (p === undefined) {
        stats.prefixes[prefix] = p = {};
        p.level = level;
    }
    incFreq(p,"count");
    incFreq(p,"size",debug.serializedlength);
    if (ttl > 0) {
        incFreq(p, "ttl", ttl);
    } else {
        incFreq(p, "ttl", 0);
    }
}

function formatSize(size) {
    if (size === 0) return "0";
    let i = Math.floor( Math.log(size) / Math.log(1024) );
    return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB', 'PB'][i];
}

function printPrefixSummary(k,prefix) {
    console.log(`    [${k}] count: ${prefix.count}, avg size: ${(prefix.size / prefix.count).toFixed(2)}B, avg ttl: ${(prefix.ttl/prefix.count).toFixed(0)}s`);
}

function printResults() {
    stats.knownKeys = {};
    console.log("Redis Server found: "+client.server_info.redis_version);
    console.log("      uptime in seconds: "+client.server_info.uptime_in_seconds);
    console.log("      connected clients: "+client.server_info.connected_clients);
    console.log("      used memory: "+client.server_info.used_memory_human);
    console.log("      used memory RSS: "+client.server_info.used_memory_human);
    console.log("      total number of keys: "+stats.dbsize + ` (${Math.min(stats.sampleSize*100.0/stats.dbsize, 100).toFixed(2)}% sampled)`);
    console.log("      total commands processed: "+Number.parseInt(client.server_info.total_commands_processed).toLocaleString("en-US"));
    console.log("      total net input: "+formatSize(client.server_info.total_net_input_bytes));
    console.log("      total net output: "+formatSize(client.server_info.total_net_output_bytes));
    console.log("Sample size (via RANDOMKEY): "+stats.sampleSize);
    console.log(" sampled types: "+JSON.stringify(stats.types));
    console.log(" sampled top level prefixes (0 TTL means indefinite):");
    for (let k in stats.prefixes) {
        if (stats.prefixes.hasOwnProperty(k)) {
            let prefix = stats.prefixes[k];
            if (prefix.count < 2 || prefix.level > 1) continue; //omit single value or 2nd level prefixes
            printPrefixSummary(k, prefix);
        }
    }
    console.log(" sampled second level prefixes with more than one value (already included in first level):");
    for (let k in stats.prefixes) {
        if (stats.prefixes.hasOwnProperty(k)) {
            let prefix = stats.prefixes[k];
            if (prefix.count < 2 || prefix.level < 2) continue; //omit single value prefixes
            printPrefixSummary(k, prefix);
        }
    }
}

sample(10000);

