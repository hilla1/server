import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http"; // ✅ Add this
import { Server } from "socket.io"; // ✅ Add this
import 'dotenv/config';

import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import consultationRouter from "./routes/consultationRoutes.js";
import paypalRouter from "./routes/paypalRoutes.js";
import stripeRouter from "./routes/stripeRoutes.js";
import mpesaRouter from "./routes/mpesaRoutes.js";
import exchangeRouter from "./routes/exchangeRoute.js";

const app = express();
const port = process.env.PORT || 5000;
connectDB();

const allowedOrigins = [process.env.VITE_CLIENT_URL];

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// ✅ Create HTTP server
const server = http.createServer(app);

// ✅ Create WebSocket server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// ✅ Attach io instance to app for controller access
app.set("io", io);

// ✅ WebSocket connection logic
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("joinRoom", (checkoutRequestId) => {
    socket.join(checkoutRequestId);
    console.log(`✅ Socket ${socket.id} joined room: ${checkoutRequestId}`);
  });

  socket.on("leaveRoom", (checkoutRequestId) => {
    socket.leave(checkoutRequestId);
    console.log(`ℹ️ Socket ${socket.id} left room: ${checkoutRequestId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ✅ API Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/consultation", consultationRouter);
app.use("/api/paypal", paypalRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/mpesa", mpesaRouter); // emits socket event in callback
app.use("/api/exchange", exchangeRouter);

// ✅ Start HTTP + WebSocket server
server.listen(port, () => {
  console.log(`🚀 Server running on port: ${port}`);
});
