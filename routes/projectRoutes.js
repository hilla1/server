import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createProject,
  updateProject,
  getProjects,
  getProjectById,
} from "../controllers/projectController.js";

const projectRouter = express.Router();

projectRouter.post('/create', userAuth, createProject);
projectRouter.patch('/update/:projectId', userAuth, updateProject);
projectRouter.get('/', userAuth, getProjects);
projectRouter.get('/:projectId', userAuth, getProjectById);

export default projectRouter;
