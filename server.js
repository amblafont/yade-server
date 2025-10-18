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
var hostname = '0.0.0.0'; // localhost
if (process.env.YADEHOSTNAME !== undefined) {
    hostname = process.env.YADEHOSTNAME;
}
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
function freshSession(name) {
    return { name: name, queue: [], nextId: 0, lastBreakId: null, lastSnapshot: null };
}
var sessions = {};
function getSessionFromClient(ws) {
    var sessionName = getSessionName(ws);
    if (!(sessionName in sessions))
        return null;
    return sessions[sessionName];
}
// let queue:item[] = [];
// let nextId = 0;
// let lastBreakId:null|number = null; 
// let lastSnapshot:null|{msg:Data,id : number, snapshot:true, sender:WebSocket.WebSocket} = null;
function closeSession(session, reason) {
    getSessionClients(session).forEach(function (ws) {
        closeConnection(ws, reason);
    });
    console.log("Closing session " + session.name + ": " + reason);
    delete sessions[session.name];
    var ks = Object.keys(sessions);
    console.log("Remaining opened sessions: " + ks.join(", "));
}
function closeIfNoClient(session) {
    var nclient = getSessionClients(session).length;
    // for (let ws of wss.clients) {
    //   if (getSessionName(ws) == session)
    //     nclient++;
    // }
    if (nclient > 0) {
        console.log("Session " + session.name + ": still " + nclient + " connected");
    }
    else {
        closeSession(session, "no client left");
    }
    // console.log("Deleting session " + session + " (no client left).");
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
function sendQueueSince(session, ws, expectedId) {
    // strictly bigger is impossible (already checked before)
    if (expectedId >= session.nextId) {
        return true;
    }
    var idFirst = expectedId;
    var diffs = [];
    // looking if snapshot is available
    if (session.lastSnapshot != null && session.lastSnapshot.id >= expectedId) {
        idFirst = session.lastSnapshot.id + 1;
        diffs.push(session.lastSnapshot);
    }
    var depth = session.nextId - idFirst;
    if (depth > session.queue.length) {
        var clients = chooseSnapshotClient(session);
        if (clients.length == 0) {
            var reason = "no updated client to get data from (server restarted)";
            closeSession(session, reason);
            return false;
        }
        sendRequestSnapshot(clients);
        return true;
    }
    // let data:ServerToClientDiff[] = []; // queue.slice(-depth);
    for (var i = 0; i < depth; i++) {
        var msg = session.queue[session.queue.length - depth + i];
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
// we add those properties to each ws client.
var expectedIdKey = "expectedId";
var sessionNameKey = "sessionName";
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
function getSessionName(ws) {
    if (hasProperty(ws, sessionNameKey)) {
        return ws[sessionNameKey];
    }
    console.log("client has not " + sessionNameKey);
    return "";
}
function setSessionName(ws, sessionName) {
    var ws2 = ws;
    ws2[sessionNameKey] = sessionName;
}
function minimalId(session) {
    var id = session.nextId - session.queue.length - 1;
    if (session.lastSnapshot != null && session.lastSnapshot.id > id)
        return session.lastSnapshot.id;
    return id;
}
// function getSessionClients(session:session):WebSocket.WebSocket[] {
//   let clients = [];
//   for (client of wss.clients)
//   return clients;
// }
function chooseSnapshotClient(session) {
    var clients = [];
    var minId = minimalId(session);
    getSessionClients(session).forEach(function (ws) {
        if (getExpectedId(ws) >= minId)
            clients.push(ws);
    });
    return clients;
}
function saveMsg(session, ws, msg) {
    if (!msg.history)
        return;
    session.queue.push({ msg: msg.msg, sender: ws, id: session.nextId, snapshot: msg.snapshot });
    session.nextId++;
    session.queue = session.queue.slice(-depthHistory);
    console.log("saving msg; queue length: %d", session.queue.length);
}
function handleReceiveStart(session, ws, msg) {
    if (!msg.snapshot) {
        sendRequestSnapshot([ws]);
        return;
    }
    var id = session.nextId;
    session.lastBreakId = id;
    session.nextId++;
    // saveMsg(ws, msg);
    updateLastSnapshot(session, ws, msg.msg, id);
    broadcastMsg(session, ws, msg, id);
}
function updateLastSnapshot(session, ws, msg, id) {
    session.lastSnapshot = { id: id, snapshot: true, msg: msg, sender: ws };
}
function getSessionClients(session) {
    var clients = [];
    wss.clients.forEach(function each(client) {
        if (getSessionName(client) == session.name)
            clients.push(client);
    });
    return clients;
}
function broadcastMsg(session, ws, msg, id) {
    if (!msg.broadcast) {
        return;
    }
    var clients = getSessionClients(session);
    console.log("sending diff to %d clients", clients.length);
    clients.forEach(function each(client) {
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
wss.on('connection', function connection(ws, request) {
    // extract session name from url
    var url = request.url;
    console.log("new connection with url: " + url);
    if (url === undefined) {
        closeConnection(ws, "no session specified");
        return;
    }
    var sessionName = url.substring(1); // removing leading /
    if (sessionName == "")
        sessionName = "default";
    console.log("session name: " + sessionName);
    setSessionName(ws, sessionName);
    var session = getSessionFromClient(ws);
    if (session === null) {
        console.log("Creating new session: " + sessionName);
        session = freshSession(sessionName);
        sessions[sessionName] = session;
    }
    // */
    ws.on('error', console.error);
    ws.on('close', function close() {
        // if (wss.clients.size == 0)
        closeIfNoClient(session);
    });
    ws.on('message', function message(data) {
        var str = data.toString();
        ;
        console.log('received (' + session.name + '): %s', str.substring(0, 200));
        // console.log('the queue:');
        // console.log(queue);
        var msg = JSON.parse(str);
        // if (msg.expectedId > getExpectedId(ws))
        setExpectedId(ws, msg.expectedId);
        if (msg.expectedId > session.nextId) {
            closeConnection(ws, "impossible: expectedId(" + msg.expectedId + ") > nextId(" + session.nextId + ")");
            return;
        }
        if (session.lastSnapshot === null) {
            console.log("no snapshot available (prelude)");
            handleReceiveStart(session, ws, msg);
            return;
        }
        if (!sendQueueSince(session, ws, msg.expectedId))
            return;
        if (session.lastBreakId !== null && msg.expectedId <= session.lastBreakId) {
            return;
        }
        if (msg.break)
            session.lastBreakId = session.nextId;
        if (msg.snapshot && session.lastSnapshot.id > msg.expectedId) {
            updateLastSnapshot(session, ws, msg.msg, msg.expectedId - 1);
        }
        // msg.id = currentId;
        var currentId;
        if (msg.history)
            currentId = session.nextId;
        else
            currentId = session.nextId - 1;
        saveMsg(session, ws, msg);
        broadcastMsg(session, ws, msg, currentId);
    });
});
