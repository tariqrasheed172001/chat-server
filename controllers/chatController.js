const Message = require('../models/Message');

const getMessages = async (room) => {
  return await Message.find({ room });
};

const saveMessage = async (data) => {
  const message = new Message(data);
  await message.save();
  return message;
};

module.exports = {
  getMessages,
  saveMessage,
};
