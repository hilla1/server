import axios from "axios";
import moment from "moment";
import MpesaTransaction from "../models/mpesaModel.js";

// 1. Get M-Pesa Access Token
const getMpesaToken = async () => {
  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const response = await axios.get(
      `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    return response.data.access_token;
  } catch (err) {
    console.error("Token Error:", err.response?.data || err.message);
    throw new Error("Failed to get M-Pesa access token");
  }
};

// 2. Initiate STK Push
export const initiateStkPush = async (req, res) => {
  const { phone, amount = 1 } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({
      success: false,
      message: "Phone and amount are required.",
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
      : `254${phone.replace(/^0/, "")}`;

    const stkPayload = {
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
      TransactionDesc: "Service Payment",
    };

    const response = await axios.post(
      `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const transaction = await MpesaTransaction.create({
      phone: phoneFormatted,
      amount,
      checkoutRequestID: response.data.CheckoutRequestID,
      merchantRequestID: response.data.MerchantRequestID,
      status: "Pending",
    });

    return res.json({
      success: true,
      message: "STK push initiated successfully",
      data: {
        ...response.data,
        transactionId: transaction._id,
      },
    });
  } catch (err) {
    const errorData = err.response?.data || { errorMessage: err.message };
    console.error("STK Push Error:", errorData);

    const errorMessage =
      errorData.errorMessage || errorData.error?.message || "";
    const isInsufficient =
      errorMessage.toLowerCase().includes("insufficient") ||
      errorMessage.includes("DS timeout") ||
      errorMessage.includes("Request cancelled by user");

    return res.status(500).json({
      success: false,
      message: isInsufficient
        ? "Insufficient balance in M-Pesa account"
        : errorMessage || "Failed to initiate payment",
      errorType: isInsufficient ? "INSUFFICIENT_BALANCE" : "GENERIC_ERROR",
      error: errorData,
    });
  }
};

// 3. M-Pesa Callback Handler (REAL-TIME SOCKET UPDATE ADDED HERE)
export const mpesaCallback = async (req, res) => {
  try {
    const io = req.app.get("io"); // Socket.IO instance
    const callbackData = req.body;
    console.log("Raw Callback:", JSON.stringify(callbackData, null, 2));

    if (!callbackData.Body?.stkCallback) {
      return res.status(400).json({ success: false, message: "Invalid callback format" });
    }

    const {
      CheckoutRequestID,
      ResultCode: rawResultCode,
      ResultDesc,
      CallbackMetadata,
    } = callbackData.Body.stkCallback;

    const ResultCode = typeof rawResultCode === "string" ? parseInt(rawResultCode) : rawResultCode;

    const statusMap = {
      0: "Completed",
      1: "Insufficient",
      1032: "Cancelled",
      2001: "Timeout",
    };

    const status = statusMap[ResultCode] || "Failed";

    const transaction = await MpesaTransaction.findOneAndUpdate(
      { checkoutRequestID: CheckoutRequestID },
      {
        $set: {
          status,
          resultCode: ResultCode,
          resultDesc: ResultDesc,
          callbackMetadata: CallbackMetadata,
          rawCallback: callbackData,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    // Extract metadata if completed
    if (status === "Completed" && CallbackMetadata?.Item) {
      const updateData = {};
      CallbackMetadata.Item.forEach((item) => {
        if (item.Name === "MpesaReceiptNumber") updateData.mpesaReceiptNumber = item.Value;
        if (item.Name === "Amount") updateData.amount = item.Value;
        if (item.Name === "TransactionDate") updateData.transactionDate = item.Value;
        if (item.Name === "PhoneNumber") updateData.phone = item.Value;
      });

      await MpesaTransaction.updateOne({ _id: transaction._id }, { $set: updateData });
    }

    //  Emit to correct room and event name
    io.to(CheckoutRequestID).emit("mpesa:statusUpdate", {
      checkoutRequestID: CheckoutRequestID,
      status,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Callback Error:", err);
    res.status(500).json({ success: false, message: "Callback processing failed" });
  }
};
