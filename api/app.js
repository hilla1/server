// api/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import connectDB from "../config/mongodb.js";
import authRouter from "../routes/authRoutes.js";
import userRouter from "../routes/userRoutes.js";

const app = express();
connectDB();

const allowedOrigins = ['http://localhost:5173'];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// API Endpoints
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

export default app;
