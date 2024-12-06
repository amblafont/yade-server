"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var WebSocket = require("ws");
var http = require("http");
// import {Data, ServerToClientDiffs, ClientToServerDiff, ServerToClientDiff, ServerToClientMsg} from "./interface.js";
var port = 8080;
if (process.env.PORT !== undefined) {
    var n = parseInt(process.env.PORT);
    if (!isNaN(n))
        port = n;
}
// Define the port and hostname
var hostname = '127.0.0.1'; // localhost
// Create the server
var server = http.createServer(function (req, res) {
    // Set the response HTTP headers
    res.statusCode = 200; // OK
    res.setHeader('Content-Type', 'text/html');
    res.end('Server ready! <a href="https://amblafont.github.io/graph-editor/index.html?server='
        + 'wss://' + req.headers.host
        + '">Connect from the diagram editor</a>.');
});
// Start the server
server.listen(port, hostname, function () {
    console.log("Server running at http://".concat(hostname, ":").concat(port, "/"));
});
var wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', function upgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
        wss.emit('connection', ws, request);
    });
});
/*
Ca peut demenader un
*/
var depthHistory = 20;
var queue = [];
var nextId = 0;
var lastBreakId = null;
var lastSnapshot = null;
function closeAll(reason) {
    wss.clients.forEach(function (ws) {
        closeConnection(ws, reason);
    });
}
function restart() {
    queue = [];
    nextId = 0;
    lastBreakId = null;
    lastSnapshot = null;
    console.log("Server restarted.");
}
function sendToClient(ws, data) {
    ws.send(JSON.stringify(data));
}
function sendRequestSnapshot(clients) {
    console.log("sending snapshot request to %d clients", clients.length);
    clients.forEach(function (client) { return sendToClient(client, { type: "snapshotRequest" }); });
}
function closeConnection(ws, reason) {
    console.log("closing connection: %s", reason);
    ws.close(1011, reason);
}
function sendQueueSince(ws, expectedId) {
    // strictly bigger is impossible (already checked before)
    if (expectedId >= nextId) {
        return true;
    }
    var idFirst = expectedId;
    var diffs = [];
    // looking if snapshot is available
    if (lastSnapshot != null && lastSnapshot.id >= expectedId) {
        idFirst = lastSnapshot.id + 1;
        diffs.push(lastSnapshot);
    }
    var depth = nextId - idFirst;
    if (depth > queue.length) {
        var clients = chooseSnapshotClient();
        if (clients.length == 0) {
            var reason = "no updated client to get data from (server restarted)";
            closeAll(reason);
            return false;
        }
        sendRequestSnapshot(clients);
        return true;
    }
    // let data:ServerToClientDiff[] = []; // queue.slice(-depth);
    for (var i = 0; i < depth; i++) {
        var msg = queue[queue.length - depth + i];
        diffs.push(msg);
        // diffs.push({isSender : ws === msg.sender, msg: msg.msg
        //     , id:msg.id, snapshot:msg.snapshot
        // });
    }
    var finalDiffs = diffs.map(function (msg) {
        return { "isSender": ws === msg.sender,
            "msg": msg.msg,
            "id": msg.id,
            "snapshot": msg.snapshot };
    });
    var stuff = { type: "diffs",
        data: finalDiffs
    };
    var stuff2 = stuff;
    console.log("sending %d diffs to one client", diffs.length);
    sendToClient(ws, stuff2);
    return true;
}
var expectedIdKey = "expectedId";
function hasProperty(obj, key) {
    return key in obj;
}
// function hasExpectedId(ws:WebSocket.WebSocket):boolean {
//   return hasProperty(ws,expectedIdKey);
// }
function getExpectedId(ws) {
    if (hasProperty(ws, expectedIdKey)) {
        return ws[expectedIdKey];
    }
    return -1;
}
function setExpectedId(ws, id) {
    var ws2 = ws;
    ws2[expectedIdKey] = id;
}
function minimalId() {
    var id = nextId - queue.length - 1;
    if (lastSnapshot != null && lastSnapshot.id > id)
        return lastSnapshot.id;
    return id;
}
function chooseSnapshotClient() {
    var clients = [];
    var minId = minimalId();
    wss.clients.forEach(function (ws) {
        if (getExpectedId(ws) >= minId)
            clients.push(ws);
    });
    return clients;
}
function saveMsg(ws, msg) {
    if (!msg.history)
        return;
    queue.push({ msg: msg.msg, sender: ws, id: nextId, snapshot: msg.snapshot });
    nextId++;
    queue = queue.slice(-depthHistory);
    console.log("saving msg; queue length: %d", queue.length);
}
function handleReceiveStart(ws, msg) {
    if (!msg.snapshot) {
        sendRequestSnapshot([ws]);
        return;
    }
    var id = nextId;
    lastBreakId = id;
    nextId++;
    // saveMsg(ws, msg);
    updateLastSnapshot(ws, msg.msg, id);
    broadcastMsg(ws, msg, id);
}
function updateLastSnapshot(ws, msg, id) {
    lastSnapshot = { id: id, snapshot: true, msg: msg, sender: ws };
}
function broadcastMsg(ws, msg, id) {
    if (!msg.broadcast) {
        return;
    }
    console.log("sending diff to %d clients", wss.clients.size);
    wss.clients.forEach(function each(client) {
        var data = { msg: msg.msg, isSender: client === ws, id: id,
            snapshot: msg.snapshot
        };
        if (client.readyState === WebSocket.OPEN) {
            sendToClient(client, { data: [data],
                type: "diffs"
            });
            // client.send(JSON.stringify(msg));
        }
    });
}
wss.on('connection', function connection(ws) {
    console.log("new connection");
    // */
    ws.on('error', console.error);
    ws.on('close', function close() {
        if (wss.clients.size == 0)
            restart();
    });
    ws.on('message', function message(data, isBinary) {
        var str = data.toString();
        ;
        console.log('received: %s', str.substring(0, 200));
        // console.log('the queue:');
        // console.log(queue);
        var msg = JSON.parse(str);
        // if (msg.expectedId > getExpectedId(ws))
        setExpectedId(ws, msg.expectedId);
        if (msg.expectedId > nextId) {
            closeConnection(ws, "impossible: expectedId(" + msg.expectedId + ") > nextId(" + nextId + ")");
            return;
        }
        if (lastSnapshot === null) {
            console.log("no snapshot available (prelude)");
            handleReceiveStart(ws, msg);
            return;
        }
        if (!sendQueueSince(ws, msg.expectedId))
            return;
        if (lastBreakId !== null && msg.expectedId <= lastBreakId) {
            return;
        }
        if (msg.break)
            lastBreakId = nextId;
        if (msg.snapshot && lastSnapshot.id > msg.expectedId) {
            updateLastSnapshot(ws, msg.msg, msg.expectedId - 1);
        }
        // msg.id = currentId;
        var currentId;
        if (msg.history)
            currentId = nextId;
        else
            currentId = nextId - 1;
        saveMsg(ws, msg);
        broadcastMsg(ws, msg, currentId);
    });
});
