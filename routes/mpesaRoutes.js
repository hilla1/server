import express from "express";
import { initiateStkPush, mpesaCallback } from "../controllers/mpesaController.js";

const mpesaRouter = express.Router();

mpesaRouter.post("/stk-push", initiateStkPush);
mpesaRouter.post("/callback", mpesaCallback);

export default mpesaRouter;
