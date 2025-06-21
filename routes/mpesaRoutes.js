import express from "express";
import { checkTransactionStatus, getTransaction, initiateStkPush, mpesaCallback } from "../controllers/mpesaController.js";

const mpesaRouter = express.Router();

mpesaRouter.post("/stk-push", initiateStkPush);
mpesaRouter.post("/callback", mpesaCallback);
mpesaRouter.get("/mpesa/transaction-status", checkTransactionStatus);
mpesaRouter.get("/mpesa/transactions/:id", getTransaction);

export default mpesaRouter;
