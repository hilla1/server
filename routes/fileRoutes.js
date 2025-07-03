// routes/fileRoutes.js
import express from 'express';
import userAuth from "../middleware/userAuth.js";
import { deleteFile, uploadFile } from '../controllers/fileController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const fileRouter = express.Router();

fileRouter.post('/upload', userAuth, upload.single('file'), uploadFile);
fileRouter.post('/delete', userAuth, deleteFile);

export default fileRouter;
