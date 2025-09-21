const http = require("http");

const server = http.createServer((req, res) => {
  res.end("Hello from inside Docker, served over HTTP!");
});

server.listen(3000, () => {
  console.log("Server runninggggg on port 3000");
});
