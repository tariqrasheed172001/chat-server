const mongoose = require("mongoose");
const { Schema } = mongoose;

const TicketCounterSchema = new Schema({
  _id: { type: String, required: true }, // Use a string for the identifier (e.g., "ticket")
  sequence_value: { type: Number, default: 0 },
});

const Counter = mongoose.model("TicketCounter", TicketCounterSchema);

module.exports = Counter;