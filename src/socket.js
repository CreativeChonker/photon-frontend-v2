import { io } from "socket.io-client";

// Use polling for Render compatibility
export const socket = io("https://ocr-prototype-backend.onrender.com", {
  transports: ["polling"], // Polling avoids Render websocket upgrade issues
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 25000,
});
