import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
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
const server = http.createServer(app); // Required for socket.io
const port = process.env.PORT || 5000;

// Setup socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.VITE_CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Match frontend event name: "mpesa:join"
io.on("connection", (socket) => {
  socket.on("mpesa:join", (checkoutRequestId) => {
    socket.join(checkoutRequestId);
  });

  socket.on("disconnect", () => {
    // Cleanup if needed
  });
});

connectDB();

// Share socket.io with routes via app instance
app.set("io", io);

const allowedOrigins = [process.env.VITE_CLIENT_URL];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/consultation', consultationRouter);
app.use('/api/paypal', paypalRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/mpesa", mpesaRouter);
app.use("/api/exchange", exchangeRouter);

// Start server
server.listen(port, () => console.log(`Server running on port ${port}`));
