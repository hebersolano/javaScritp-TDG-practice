import * as net from "node:net";

let server = new net.Server();
server.on("connection", (socket) => {
  socket.end("Hello World", "utf8");
});

// server.listen("3000", "localhost", (e) => {
//   console.log(e);
// });

//* schedule blocking tasks after event loop is free
// setImmediate()
