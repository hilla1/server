// routes/projectRoutes.js
import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createProject,
  updateProject,
  getProjects,
  getProjectById,
  deleteProject,
} from "../controllers/projectController.js";

const projectRouter = express.Router();

projectRouter.post('/create', userAuth, createProject);
projectRouter.patch('/update/:projectId', userAuth, updateProject);
projectRouter.get('/', userAuth, getProjects);
projectRouter.get('/:projectId', userAuth, getProjectById);
projectRouter.delete('/:projectId', userAuth, deleteProject);

export default projectRouter;