const mongoose = require("mongoose");
const { Schema } = mongoose;
require("dotenv").config(); // Load environment variables from .env file
const Counter = require('./TicketCounterSchema');

// Define the schema for the ticket object
const ticketSchema = new Schema({
  ticketNumber: {
    type: String,
    unique: true, // Ensure each ticket number is unique
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["open", "resolved", "closed"], // Define allowed status values
    default: "open", // Set default status to 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now, // Set default to current date/time
  },
});

// Pre-save hook to generate ticketNumber with prefix
ticketSchema.pre("save", async function (next) {
  if (this.isNew) {
    const prefix = process.env.TICKET_PREFIX || "DEX"; // Default to "DEX" if not specified
    const year = new Date().getFullYear();
    try {
      const counter = await Counter.findByIdAndUpdate(
        "ticket", // Identifier for the ticket counter
        { $inc: { sequence_value: 1 } }, // Increment the counter
        { new: true, upsert: true } // Create if it doesn’t exist
      );

      const sequence = counter.sequence_value;
      this.ticketNumber = `${prefix}${year}${sequence}`; // Create ticketNumber with prefix and counter
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model("Ticket", ticketSchema);
