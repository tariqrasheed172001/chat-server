const express = require("express");
const http = require("http");
const connectDB = require("./config/db");
const cors = require("cors");
require("dotenv").config();
const setupSocketIO = require("./sockets/socket");
const mainRouter = require("./routes");

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/v1", mainRouter);

// Setup Socket.IO
setupSocketIO(server);

const PORT = process.env.PORT || 6000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
