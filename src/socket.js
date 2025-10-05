import { io } from "socket.io-client";

// TEMP: force polling so we bypass websocket upgrade issues
export const socket = io("https://photon-backend.onrender.com", {
  transports: ["polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 25000,
});

