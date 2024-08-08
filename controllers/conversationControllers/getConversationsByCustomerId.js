const mongoose = require('mongoose');
const axios = require('axios'); // Make sure axios is installed
const Conversation = require('../../models/Conversation');
const errorLogger = require('../../logger/errorLogger');
const successLogger = require('../../logger/successLogger');

const getConversationsByCustomerId = async (req, res) => {
  const { customerId } = req.params;

  try {
    // Fetch conversations for the given customer ID
    const conversations = await Conversation.find({ customerId })
      .populate('ticketId')
      .populate('messages');

    // If no conversations found, return an empty array
    if (!conversations.length) {
      return res.status(200).json([]);
    }

    // Extract user IDs from the conversations, handling potential null or undefined userIds
    const userIds = [...new Set(conversations
      .map(convo => convo.userId)
      .filter(id => id) // Filter out null or undefined IDs
      .map(id => id.toString())
    )];

    // Only fetch user details if there are user IDs
    let users = [];
    if (userIds.length) {
      const { data } = await axios.post(`${process.env.AUTH_MICROSERVICE_URL}/users/batch`, { ids: userIds });
      users = data || [];
    }

    // Convert fetched users to a map for easier lookup
    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {});

    // Combine conversation data with user details
    const conversationsWithUsers = conversations.map(convo => ({
      ...convo._doc,
      user: userMap[convo.userId?.toString()] || null // Handle cases where user details might be missing
    }));

    successLogger.http("Conversations retrieved successfully");
    res.status(200).json(conversationsWithUsers);
  } catch (error) {
    errorLogger.error('Error fetching conversations for customer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  getConversationsByCustomerId,
};
