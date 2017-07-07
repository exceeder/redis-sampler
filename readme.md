NodeJS app to quickly verify what is going on with the Redis you are running. Mostly useful if you share a Redis 
instance between multiple apps and want to know where all the memory went without causing any production issues.

Supports Node 6.x and up.

Runs 10k samples against the server to collect some stats via RANDOMKEY.

Does not support Redis with authentication, but it is simple enough to tweak to your needs.

Example usage:
```
>npm install
>node index.js 
or
>node index.js some-host:3679
```

Example output:
```
Redis Server found:3.0.2
      uptime in sec:188834
      connected clients:15
      used memory:1.19M
      used memory RSS:1.19M
      total commands processed:427619
      total net input:16.46 MB
      total net output:28.35 MB
Sample via RANDOMKEY size:10000
 sampled types:{"string":5,"hash":2}
 sampled common prefixes:
    [string] count:2 avg size:6.00 avg ttl:0
    [hash] count:2 avg size:30.50 avg ttl:0
    [api] count:3 avg size:120.33 avg ttl:866
```

License: Apache 2.0

Note: this solution is somewhat inspired by this Ruby redis-sampler: https://github.com/antirez/redis-sampler
