// routes/ticketRoutes.js
const express = require('express');
const ticketRouter = express.Router();
const { createTicketController } = require('../controllers/ticketControllers/createTicketController');
const verifyTokenMiddleware = require('../middlewares/verifyTokenMiddleware');

// Route to create a new ticket
ticketRouter.post('/create', verifyTokenMiddleware , createTicketController);

module.exports = ticketRouter;