import * as http from "node:http";
import * as fs from "node:fs";
import * as url from "node:url";

const clientHTML = fs.readFileSync("index.html");

let clients = [];

const server = new http.Server();
server.listen(8080);

server.on("request", (req, res) => {
  const pathname = url.parse(req.url).pathname;

  if (pathname === "/") {
    res
      .writeHead(200, {
        "Content-Type": "text/html",
      })
      .end(clientHTML);
    return;
  }

  if (pathname === "/chat") {
    if (req.method === "GET") return acceptNewClient(req, res);

    if (req.method === "POST") return broadcastNewMessage(req, res);
  }

  res.writeHead(404).end();
});

/**
 * @param { http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function acceptNewClient(req, res) {
  clients.push(res);

  req.socket.on("end", () => {
    clients.slice(clients.indexOf(res), 1);
    res.end();
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    connection: "keep-alive",
    "cache-control": "no-cache",
  });

  res.write("event: chat\ndata: Connected\n\n");
}

/**
 * @param { http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function broadcastNewMessage(req, res) {
  req.setEncoding("utf8");
  let body = "";
  for await (const chuck of req) {
    body += chuck;
  }

  res.writeHead(200).end();

  let message = "data: " + body.replace("\n", "\ndata: ");
  let event = `event: chat\n${message}\n\n`;

  clients.forEach((client) => client.write(event));
}
