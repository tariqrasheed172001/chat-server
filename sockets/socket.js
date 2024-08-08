const Message = require("../models/Message");
const mongoose = require("mongoose");
const socketIo = require("socket.io");
const cloudinary = require("../config/cloudinaryConfig"); // Adjust the path as needed
const Conversation = require("../models/Conversation");
const Ticket = require("../models/Ticket");
const errorLogger = require("../logger/errorLogger");
const infoLogger = require("../logger/infoLogger");
const successLogger = require("../logger/successLogger");

const rooms = new Set();
const agents = new Set();
const customerRooms = new Map(); // Track the current room for each customer

const setupSocketIO = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3001"],
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("joinAgent", () => {
      agents.add(socket.id);
      console.log("Agent joined: ", socket.id);
      rooms.forEach((room) => {
        socket.join(room);
      });
    });

    socket.on("join", (roomIds) => {
      if (!Array.isArray(roomIds)) {
        console.error("Expected roomIds to be an array");
        return;
      }
    
      // Join each room only if the socket is not already in that room
      roomIds.forEach(roomId => {
        if (!socket.rooms.has(roomId)) {
          socket.join(roomId);
          console.log(`Socket ${socket.id} joined room: ${roomId}`);
    
          // Notify agents about the new room
          agents.forEach((agentId) => {
            io.to(agentId).emit("newRoom", roomId);
            io.to(agentId).socketsJoin(roomId); // Ensure the agent joins the new room
          });
    
          // // Optionally, emit a message to the room that a new socket has joined
          // socket.to(roomId).emit("message", {
          //   sender: "System",
          //   message: `${socket.id} has joined the room`,
          //   room: roomId,
          // });
        }
      });
    
      // Optionally, send a confirmation to the client with the rooms joined
      socket.emit("assignedRooms", roomIds);
    });
    

    socket.on("createRoom", async (roomId, ticketId, customerId, callback) => {
      console.log("Creating new room with ID:", roomId);
      console.log("Ticket ID:", ticketId);
      console.log("custome ID:", customerId);

      // Ensure roomId, ticketId, and customerId are strings
      if (typeof roomId !== "string") {
        console.error("Invalid input types. roomId must be strings.");
        return (
          callback &&
          callback({
            success: false,
            message: "Invalid input types. roomId must be strings.",
          })
        );
      }

      // Ensure callback is a function
      if (typeof callback !== "function") {
        console.error("Callback is not a function");
        return;
      }

      if (!rooms.has(roomId)) {
        rooms.add(roomId);
        socket.join(roomId);
        customerRooms.set(socket.id, roomId);

        // Create a new conversation in the database
        let newConversation;
        try {
          newConversation = new Conversation({
            roomId: roomId, // Use roomId directly as a string
            ticketId: new mongoose.Types.ObjectId(ticketId),
            customerId: new mongoose.Types.ObjectId(customerId),
            messages: [],
          });

          await newConversation.save();
          infoLogger.info(`New conversation created with room ID: ${roomId}`);
        } catch (error) {
          console.error("Error creating new conversation:", error);
          return callback({
            success: false,
            message: "Error creating new conversation",
            error: error.message,
          });
        }

        // Fetch the ticket details
        let ticketDetails;
        try {
          ticketDetails = await Ticket.findById(ticketId).lean();
          if (!ticketDetails) {
            throw new Error("Ticket not found");
          }
        } catch (error) {
          console.error("Error fetching ticket details:", error);
          return callback({
            success: false,
            message: "Error fetching ticket details",
            error: error.message,
          });
        }

        const conversation = await Conversation.findById(newConversation._id)
          .populate("ticketId")
          .populate("messages");

        callback({
          success: true,
          conversation,
        });

        console.log(`Customer joined room: ${roomId}`);

        // Notify agents about the new room
        agents.forEach((agentId) => {
          io.to(agentId).emit("newConversation", conversation);
          io.to(agentId).socketsJoin(roomId); // Ensure the agent joins the new room
        });

        socket.to(roomId).emit("message", {
          sender: "System",
          message: `Customer has created room and joined, roomId: ${roomId}`,
          room: roomId,
        });
      } else {
        console.log("Room already exists, assigning existing room");
        socket.join(roomId);
        customerRooms.set(socket.id, roomId);

        // Fetch the ticket details for the existing room
        let ticketDetails;
        try {
          ticketDetails = await Ticket.findById(ticketId).lean();
          if (!ticketDetails) {
            throw new Error("Ticket not found");
          }
        } catch (error) {
          errorLogger.error("Error fetching ticket details:", error);
          return callback({
            success: false,
            message: "Error fetching ticket details",
            error: error.message,
          });
        }

        callback({
          success: true,
          roomId,
          ticketDetails,
        });
      }
    });

    socket.on("message", async (data) => {
      console.log(`Message received in room ${data.room}: ${data.message}`);

      const roomExists = (roomId) => {
        return io.sockets.adapter.rooms.has(roomId);
      };

      if (roomExists(data.room)) {
        console.log(`Room ${data.room} exists. Joining room.`);
      } else {
        console.log(`Room ${data.room} does not exist. Creating and joining room.`);
      }

      // socket.join(data.room);

      let attachmentUrl = null;

      // Check if there's an attachment and upload it
      if (data.attachment) {
        try {
          const uploadResponse = await cloudinary.uploader.upload(
            data.attachment,
            {
              folder: "chat_attachments",
              resource_type: "auto", // Automatically determine the resource type
            }
          );
          attachmentUrl = uploadResponse.secure_url;
        } catch (error) {
          errorLogger.error("Cloudinary upload error:", error);
          return;
        }
      }

      const messageData = {
        room: data.room,
        sender: data.sender,
        message: data.message,
        attachment: attachmentUrl,
        attachmentType: data.attachmentType,
        timestamp: Date.now(),
      };

      io.to(data.room).emit("message", messageData);

      try {
        // Save the message
        const message = new Message(messageData);
        await message.save();

        // Update the conversation to include the new message ID
        await Conversation.updateOne(
          { roomId: data.room },
          { $push: { messages: message._id } }
        );

        // Emit the message to the room
        // io.to(data.room).emit("message", message);
      } catch (error) {
        errorLogger.error(
          "Error saving message or updating conversation:",
          error
        );
      }
    });

    socket.on("assignUserToConversation", async (data, callback) => {
      infoLogger.info(
        `Assigning user to conversation. User ID: ${data.userId}, Conversation ID: ${data.conversationId}`
      );

      // Validate input
      if (
        !mongoose.Types.ObjectId.isValid(data.userId) ||
        !mongoose.Types.ObjectId.isValid(data.conversationId)
      ) {
        errorLogger.error(
          "Invalid input types. userId and conversationId must be valid ObjectId strings."
        );
        return (
          callback &&
          callback({
            success: false,
            message:
              "Invalid input types. userId and conversationId must be valid ObjectId strings.",
          })
        );
      }

      try {
        // Find the conversation and update the userId
        const updatedConversation = await Conversation.findByIdAndUpdate(
          data.conversationId,
          { userId: new mongoose.Types.ObjectId(data.userId) },
          { new: true } // Return the updated document
        ).lean();

        if (!updatedConversation) {
          throw new Error("Conversation not found");
        }

        successLogger.http(
          `User assigned to conversation. Conversation ID: ${data.conversationId}, User ID: ${data.userId}`
        );

        // Optionally, notify the client or agents about the update
        io.to(socket.id).emit(
          "userAssignedToConversation",
          updatedConversation
        );

        // Send a success response
        callback({
          success: true,
          message: "User assigned to conversation successfully",
          conversation: updatedConversation,
        });
      } catch (error) {
        errorLogger.error("Error assigning user to conversation:", error);
        callback({
          success: false,
          message: "Error assigning user to conversation",
          error: error.message,
        });
      }
    });

    socket.on("unassignUserFromConversation", async (data, callback) => {
      infoLogger.info(
        `Unassigning user from conversation. User ID: ${data.userId}, Conversation ID: ${data.conversationId}`
      );
    
      // Validate input
      if (
        !mongoose.Types.ObjectId.isValid(data.userId) ||
        !mongoose.Types.ObjectId.isValid(data.conversationId)
      ) {
        errorLogger.error(
          "Invalid input types. userId and conversationId must be valid ObjectId strings."
        );
        return (
          callback &&
          callback({
            success: false,
            message:
              "Invalid input types. userId and conversationId must be valid ObjectId strings.",
          })
        );
      }
    
      try {
        // Find the conversation and update the userId to null
        const updatedConversation = await Conversation.findByIdAndUpdate(
          data.conversationId,
          { userId: null },
          { new: true } // Return the updated document
        ).lean();
    
        if (!updatedConversation) {
          throw new Error("Conversation not found");
        }
    
        successLogger.http(
          `User unassigned from conversation. Conversation ID: ${data.conversationId}, User ID: ${data.userId}`
        );

        const conversation = await Conversation.findById(updatedConversation._id)
        .populate("ticketId")
        .populate("messages");
    
        // Optionally, notify the client or agents about the update
        io.to(socket.id).emit(
          "userUnassignedFromConversation",
          conversation
        );
    
        // Send a success response
        callback({
          success: true,
          message: "User unassigned from conversation successfully",
          conversation: conversation,
        });
      } catch (error) {
        errorLogger.error("Error unassigning user from conversation:", error);
        callback({
          success: false,
          message: "Error unassigning user from conversation",
          error: error.message,
        });
      }
    });
    
    socket.on("updateTicketStatus", async (data, callback) => {
      console.log(
        `Updating ticket status. Ticket ID: ${data.ticketId}, Status: ${data.status}`
      );

      // Validate the input
      if (
        typeof data.ticketId !== "string" ||
        typeof data.status !== "string"
      ) {
        console.error(
          "Invalid input types. ticketId and status must be strings."
        );
        return (
          callback &&
          callback({
            success: false,
            message:
              "Invalid input types. ticketId and status must be strings.",
          })
        );
      }

      try {
        // Find and update the ticket status
        const updatedTicket = await Ticket.findByIdAndUpdate(
          data.ticketId,
          { status: data.status },
          { new: true } // Return the updated document
        ).lean();

        if (!updatedTicket) {
          throw new Error("Ticket not found");
        }

        console.log(
          `Ticket status updated. Ticket ID: ${data.ticketId}, New Status: ${data.status}`
        );

        // Optionally, notify the client or agents about the update
        const ticketDetails = {
          roomId: data.roomId,
          status: data.status,
        }
        io.to(data.roomId).emit("ticketStatusUpdated", ticketDetails);

        // Send a success response
        callback({
          success: true,
          message: "Ticket status updated successfully",
          ticket: updatedTicket,
        });
      } catch (error) {
        console.error("Error updating ticket status:", error);
        callback({
          success: false,
          message: "Error updating ticket status",
          error: error.message,
        });
      }
    });

    socket.on("closeTicket", async (data, callback) => {
      console.log(`Closing ticket. Ticket ID: ${data.ticketId}`);

      // Validate the input
      if (typeof data.ticketId !== "string") {
        console.error("Invalid input type. ticketId must be a string.");
        return (
          callback &&
          callback({
            success: false,
            message: "Invalid input type. ticketId must be a string.",
          })
        );
      }

      try {
        // Find the conversation by ticketId and update feedback
        const updatedConversation = await Conversation.findOneAndUpdate(
          { ticketId: new mongoose.Types.ObjectId(data.ticketId) },
          {
            feedback: {
              rating: data.feedback.rating,
              resolved: data.feedback.resolved,
              comments: data.feedback.comments,
            },
          },
          { new: true }
        ).lean();

        if (!updatedConversation) {
          throw new Error("Conversation not found");
        }

        // Update the ticket status to "Closed"
        const updatedTicket = await Ticket.findByIdAndUpdate(
          data.ticketId,
          { status: "closed" },
          { new: true } // Return the updated document
        ).lean();

        if (!updatedTicket) {
          throw new Error("Ticket not found");
        }

        console.log(`Ticket closed. Ticket ID: ${data.ticketId}`);

        // Optionally, notify the client or agents about the update
        const ticketDetails = {
          roomId: data.roomId,
          status: 'closed',
        }
        io.to(data.roomId).emit("ticketClosed", ticketDetails);

        // Send a success response
        callback({
          success: true,
          message: "Ticket closed and feedback updated successfully",
          conversation: updatedConversation,
          ticket: updatedTicket,
        });
      } catch (error) {
        console.error("Error closing ticket or updating feedback:", error);
        callback({
          success: false,
          message: "Error closing ticket or updating feedback",
          error: error.message,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
      const room = customerRooms.get(socket.id);
      if (room) {
        customerRooms.delete(socket.id);
        if (io.sockets.adapter.rooms.get(room)?.size === 0) {
          rooms.delete(room);
          agents.forEach((agentId) => {
            io.to(agentId).emit("roomRemoved", room);
          });
        }
      }
    });
  });
};

module.exports = setupSocketIO;
