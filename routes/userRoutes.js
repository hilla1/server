import express from "express";
import userAuth from "../middleware/userAuth.js";
import { changePassword, getUserData, updateProfile } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData);
userRouter.patch('/update-profile', userAuth, updateProfile);
userRouter.patch('/change-password', userAuth, changePassword);
export default userRouter;