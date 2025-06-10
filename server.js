import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";

const app = express();
const port = process.env.PORT || 5000;
connectDB();

const allowedOrigins = ['http://localhost:5173'];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({origin:allowedOrigins, credentials:true}));

// Api Endpoints
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

app.listen(port, ()=> console.log(`Server running on port:${port}`));