// middleware/verifyToken.js
const axios = require('axios');
const errorLogger = require('../logger/errorLogger');
const successLogger = require('../logger/successLogger');

// URL of your authentication microservice

const verifyTokenMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1]; // Assuming Bearer token

    if (!token) {
      errorLogger.error("No token provided");
      return res.status(401).json({ message: 'No token provided' });
    }
    console.log("token:", token);
    // Send token to authentication microservice for verification
    const response = await axios.post(`${process.env.AUTH_MICROSERVICE_URL}/token/verify`, {role: 'Customer'}, {
      headers: {
        Authorization: `Bearer ${token}`, // Include the token in the headers
        "Content-Type": "application/json", // Optional: set content type
      },
    });

    if (response.status === 200) {
      // Token is valid
      successLogger.http("Successfull token validation.")
      next();
    } else {
      // Invalid token or non-200 response
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    errorLogger.error(`Error verifying token: ${error}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = verifyTokenMiddleware;
