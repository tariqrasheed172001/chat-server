// routes/ticketRoutes.js
const express = require("express");
const { getAllConversations } = require("../controllers/conversationControllers/getAllConversations");
const conversationRouter = express.Router();
const verifyTokenMiddleware = require("../middlewares/verifyTokenMiddleware");
const { getConversationsByCustomerId } = require("../controllers/conversationControllers/getConversationsByCustomerId");

// Route to create a new ticket
conversationRouter.get("/all", getAllConversations);
conversationRouter.get("/:customerId", getConversationsByCustomerId)

module.exports = conversationRouter;
