const express = require("express");
const mainRouter = express.Router();

const ticketRouter = require("./ticketRoutes");

mainRouter.use("/tickets", ticketRouter);

module.exports = mainRouter;
