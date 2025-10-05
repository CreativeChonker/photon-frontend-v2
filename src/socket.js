import { io } from "socket.io-client";

// Connect to your deployed terminal backend on Render
export const socket = io("https://photon-terminal.onrender.com", {
  transports: ["polling"],      // avoids websocket upgrade issues on Render
  reconnection: true,           // auto-reconnect if it drops
  reconnectionAttempts: 10,     // try up to 10 times
  reconnectionDelay: 1000,      // 1s delay between retries
  timeout: 25000,               // 25s connect timeout
});


