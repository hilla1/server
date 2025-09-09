import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import serverless from "serverless-http";

import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import consultationRouter from "./routes/consultationRoutes.js";
import paypalRouter from "./routes/paypalRoutes.js";
import stripeRouter from "./routes/stripeRoutes.js";
import mpesaRouter from "./routes/mpesaRoutes.js";
import exchangeRouter from "./routes/exchangeRoute.js";
import fileRouter from "./routes/fileRoutes.js";
import projectRouter from "./routes/projectRoutes.js";

const app = express();
connectDB();

const allowedOrigins = [process.env.VITE_CLIENT_URL || "http://localhost:3000"];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// API Endpoints
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/consultation', consultationRouter);
app.use('/api/paypal', paypalRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/mpesa", mpesaRouter);
app.use("/api/exchange", exchangeRouter);
app.use("/api/file", fileRouter);
app.use("/api/project", projectRouter);

// Export for Vercel serverless
export const handler = serverless(app);