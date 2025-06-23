import axios from "axios";
import moment from "moment";
import MpesaTransaction from "../models/mpesaModel.js";

// Utility: Get M-Pesa Access Token
const getMpesaToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(
    `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  return res.data.access_token;
};

// Utility: Query M-Pesa transaction status
const queryMpesaTransactionStatus = async (checkoutRequestID) => {
  const accessToken = await getMpesaToken();
  const timestamp = moment().format("YYYYMMDDHHmmss");

  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString("base64");

  const response = await axios.post(
    `${process.env.MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.data;
};

// Controller: Initiate STK Push
export const initiateStkPush = async (req, res) => {
  const { phone, amount = 1 } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({
      success: false,
      message: "Phone and amount required.",
      details: { received: req.body },
    });
  }

  try {
    const accessToken = await getMpesaToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const phoneFormatted = phone.startsWith("254")
      ? phone
      : phone.replace(/^0/, "254");

    const response = await axios.post(
      `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: parseInt(amount),
        PartyA: phoneFormatted,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phoneFormatted,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: "Tech with Brands",
        TransactionDesc: "Plan Subscription Payment",
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const transaction = await MpesaTransaction.create({
      phone,
      amount,
      checkoutRequestID: response.data.CheckoutRequestID,
      requestPayload: req.body,
      mpesaResponse: response.data,
      status: "Pending",
    });

    return res.json({
      success: true,
      message: "STK push sent. Complete the payment on your phone.",
      data: response.data,
      transactionId: transaction._id,
    });
  } catch (err) {
    console.error("M-Pesa Error:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message:
        err.response?.data?.errorMessage || "M-Pesa payment initiation failed.",
      errorDetails: err.response?.data || err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Controller: Handle M-Pesa Callback
export const mpesaCallback = async (req, res) => {
  try {
    console.log("Received M-Pesa callback:", JSON.stringify(req.body, null, 2));

    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.sendStatus(200);

    const {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = callback;

    if (!CheckoutRequestID) return res.sendStatus(200);

    const transaction = await MpesaTransaction.findOne({
      checkoutRequestID: CheckoutRequestID,
    });

    if (!transaction) return res.sendStatus(200);

    // Update transaction details
    transaction.status = ResultCode === 0 ? "Completed" : "Failed";
    transaction.resultCode = ResultCode;
    transaction.resultDescription = ResultDesc;
    transaction.rawCallback = req.body;
    transaction.callbackReceivedAt = new Date();

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const items = CallbackMetadata.Item;
      transaction.mpesaReceiptNumber = items.find(
        (i) => i.Name === "MpesaReceiptNumber"
      )?.Value;
      transaction.transactionDate = items.find(
        (i) => i.Name === "TransactionDate"
      )?.Value;
      transaction.amountPaid = items.find((i) => i.Name === "Amount")?.Value;
      transaction.payerPhoneNumber = items.find(
        (i) => i.Name === "PhoneNumber"
      )?.Value;
    }

    await transaction.save();
    console.log(
      `Transaction ${CheckoutRequestID} updated with status: ${transaction.status}`
    );

    // Emit to WebSocket room using Socket.IO
    const io = req.app.get("io"); // ← get io instance from app
    io.to(CheckoutRequestID).emit("mpesa:statusUpdate", {
      checkoutRequestID: CheckoutRequestID,
      status: transaction.status,
      resultCode: transaction.resultCode,
      resultDescription: transaction.resultDescription,
      amount: transaction.amountPaid || transaction.amount,
      phone: transaction.payerPhoneNumber || transaction.phone,
      mpesaReceiptNumber: transaction.mpesaReceiptNumber || null,
      rawData: req.body,
    });

  } catch (error) {
    console.error("M-Pesa Callback Processing Error:", error.message);
  }

  res.sendStatus(200);
};


export const checkTransactionStatus = async (req, res) => {
  try {
    const { checkoutRequestId } = req.query;
    if (!checkoutRequestId) {
      return res.status(400).json({ success: false, message: "checkoutRequestId is required" });
    }

    let transaction = await MpesaTransaction.findOne({ checkoutRequestID: checkoutRequestId });
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    if (!transaction.status || transaction.status === "Pending") {
      try {
        const stkResponse = await queryMpesaTransactionStatus(checkoutRequestId);

        transaction.resultCode = stkResponse.ResultCode;
        transaction.resultDescription = stkResponse.ResultDesc;
        transaction.status = stkResponse.ResultCode === 0 ? "Completed" : "Failed";
        transaction.mpesaResponse = {
          ...transaction.mpesaResponse,
          realTimeQuery: stkResponse,
        };
        transaction.callbackReceivedAt = new Date();

        await transaction.save();

        // Emit update via WebSocket
        const io = req.app.get("io");
        io.to(checkoutRequestId).emit("mpesa:statusUpdate", {
          status: transaction.status,
          message: stkResponse.ResultDesc,
          data: transaction,
        });

        io.to(checkoutRequestId).emit("mpesa:cleanupRoom");
      } catch (queryErr) {
        console.error("STK Query Error:", queryErr.response?.data || queryErr.message);
      }
    }

    return res.json({
      success: transaction.status === "Completed",
      status: transaction.status,
      message: transaction.resultDescription,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        phone: transaction.phone,
        checkoutRequestID: transaction.checkoutRequestID,
        mpesaReceiptNumber: transaction.mpesaReceiptNumber,
        transactionDate: transaction.transactionDate,
        resultCode: transaction.resultCode,
        resultDescription: transaction.resultDescription,
      },
      rawData: {
        callback: transaction.rawCallback,
        mpesaResponse: transaction.mpesaResponse,
      },
    });
  } catch (error) {
    console.error("Check Status Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error checking transaction status",
      error: error.message,
    });
  }
};

