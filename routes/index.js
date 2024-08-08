const express = require("express");
const mainRouter = express.Router();

const ticketRouter = require("./ticketRoutes");
const conversationRouter = require("./conversationRoutes");

mainRouter.use("/tickets", ticketRouter);
mainRouter.use("/conversations", conversationRouter)

module.exports = mainRouter;
