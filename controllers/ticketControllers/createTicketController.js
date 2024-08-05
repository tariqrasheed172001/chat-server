// controllers/ticketController.js
const errorLogger = require('../../logger/errorLogger');
const successLogger = require('../../logger/successLogger');
const Ticket = require('../../models/Ticket');  // Adjust the path to where your model is defined

// Controller function to create a new ticket
const createTicketController = async (req, res) => {
  try {
    // Extract ticket data from request body
    const { name, description, type } = req.body;

    // Validate input data
    if (!description || !name || !type) {
      errorLogger.error('Description, name, and type are required.');
      return res.status(400).json({ message: 'Description, name, and type are required.' });
    }

    // Create a new ticket
    const newTicket = new Ticket({
      description,
      name,
      type,
    });

    // Save the ticket to the database
    const savedTicket = await newTicket.save();

    // Respond with the created ticket
    successLogger.http("Ticket created successfully.")
    res.status(201).json(savedTicket);
  } catch (error) {
    // Handle errors
    errorLogger.error(`Error creating ticket: ${error}`);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
    createTicketController,
};
