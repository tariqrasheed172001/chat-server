const mongoose = require('mongoose');
require('dotenv').config();

const Counter = require('../models/TicketCounterSchema');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected...');
    
    // Initialize the counter if it does not exist
    await Counter.findByIdAndUpdate(
      "ticket",
      { $setOnInsert: { sequence_value: 0 } },
      { new: true, upsert: true }
    );
    console.log("Ticket counter initialized");
    
  } catch (err) {
    console.error("Connection failed to DB " + err.stack);
  }
};

module.exports = connectDB;
