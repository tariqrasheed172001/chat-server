const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the schema for the conversation
const conversationSchema = new Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,  // Ensure that room IDs are unique
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',  // Reference to the Ticket model
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',  // Reference to the User model for customer details
    required: true,
  },
  // userId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',  // Reference to the User model for agent details
  //   required: true,
  // },
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',  // Reference to the Message model
  }],

  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    resolved: {
      type: String,
      enum: ['Yes', 'No'],
    },
    comments: {
      type: String,
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Conversation', conversationSchema);
