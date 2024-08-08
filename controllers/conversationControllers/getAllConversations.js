const mongoose = require('mongoose');
const axios = require('axios'); // Make sure axios is installed
const Conversation = require('../../models/Conversation');
const errorLogger = require('../../logger/errorLogger');
const successLogger = require('../../logger/successLogger');

const getAllConversations = async (req, res) => {
  try {
    // Fetch conversations from the primary database
    const conversations = await Conversation.find()
      .populate('ticketId')
      .populate('messages');

    // Extract customer IDs from the conversations
    const customerIds = [...new Set(conversations.map(convo => convo.customerId.toString()))]; // Convert to strings and remove duplicates

    // Fetch customer details in a single request
    const { data: customers } = await axios.post(`${process.env.AUTH_MICROSERVICE_URL}/customers/batch`, { ids: customerIds });

    // Convert fetched customers to a map for easier lookup
    const customerMap = customers.reduce((map, cust) => {
      map[cust._id.toString()] = cust;
      return map;
    }, {});

    // Combine conversation data with customer details
    const conversationsWithCustomers = conversations.map(convo => ({
      ...convo._doc,
      customer: customerMap[convo.customerId.toString()] || null
    }));

    successLogger.http("Conversations retrieved successfully");
    res.status(200).json(conversationsWithCustomers);
  } catch (error) {
    errorLogger.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  getAllConversations,
};
