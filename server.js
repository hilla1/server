import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({origin:allowedOrigins, credentials:true}));

// Api Endpoints
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/consultation', consultationRouter);        
app.use('/api/paypal', paypalRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/mpesa", mpesaRouter);
app.use("/api/exchange", exchangeRouter);

app.listen(port, ()=> console.log(`Server running on port:${port}`));