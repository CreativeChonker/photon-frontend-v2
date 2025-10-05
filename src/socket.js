import { io } from "socket.io-client";

// Connect to your deployed terminal backend on Render
export const socket = io("https://photon-terminal-server.onrender.com", {
  transports: ["polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 25000,
});

