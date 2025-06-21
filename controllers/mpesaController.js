import axios from "axios";
import moment from "moment";
import MpesaTransaction from "../models/mpesaModel.js";

// Get M-Pesa access token
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

// Initiate STK Push
export const initiateStkPush = async (req, res) => {
  const { phone, amount = 1 } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ 
      success: false, 
      message: "Phone and amount are required." 
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
      AccountReference: "TWB_PAYMENT",
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

    // Save transaction with initial status
    const transaction = await MpesaTransaction.create({
      phone: phoneFormatted,
      amount,
      checkoutRequestID: response.data.CheckoutRequestID,
      merchantRequestID: response.data.MerchantRequestID,
      status: "Pending", // Initial status
    });

    return res.json({
      success: true,
      message: "STK push initiated successfully",
      data: {
        ...response.data,
        transactionId: transaction._id
      },
    });
  } catch (err) {
    const errorData = err.response?.data || { errorMessage: err.message };
    console.error("STK Push Error:", errorData);

    return res.status(500).json({
      success: false,
      message: errorData.errorMessage || "Failed to initiate payment",
      error: errorData,
    });
  }
};

// M-Pesa Callback Handler
export const mpesaCallback = async (req, res) => {
  try {
    const callbackData = req.body;
    console.log("Raw Callback:", JSON.stringify(callbackData, null, 2));

    if (!callbackData.Body.stkCallback) {
      return res.status(400).json({ success: false, message: "Invalid callback format" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = 
      callbackData.Body.stkCallback;

    // Find and update transaction
    const transaction = await MpesaTransaction.findOneAndUpdate(
      { checkoutRequestID: CheckoutRequestID },
      {
        $set: {
          status: ResultCode === "0" ? "Completed" : "Failed",
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
      console.warn("Transaction not found for CheckoutRequestID:", CheckoutRequestID);
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    // Extract payment details if successful
    if (ResultCode === "0" && CallbackMetadata?.Item) {
      const updateData = {};
      CallbackMetadata.Item.forEach(item => {
        if (item.Name === "MpesaReceiptNumber") updateData.mpesaReceiptNumber = item.Value;
        if (item.Name === "Amount") updateData.amount = item.Value;
        if (item.Name === "TransactionDate") updateData.transactionDate = item.Value;
        if (item.Name === "PhoneNumber") updateData.phone = item.Value;
      });

      await MpesaTransaction.updateOne(
        { _id: transaction._id },
        { $set: updateData }
      );
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Callback Error:", err);
    res.status(500).json({ success: false, message: "Callback processing failed" });
  }
};

// Check Transaction Status
export const checkTransactionStatus = async (req, res) => {
  try {
    const { checkoutRequestId } = req.query;

    if (!checkoutRequestId) {
      return res.status(400).json({ 
        success: false, 
        message: "checkoutRequestId is required" 
      });
    }

    const transaction = await MpesaTransaction.findOne({ 
      checkoutRequestID: checkoutRequestId 
    });

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: "Transaction not found" 
      });
    }

    res.json({
      success: true,
      status: transaction.status,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        phone: transaction.phone,
        receiptNumber: transaction.mpesaReceiptNumber,
        date: transaction.transactionDate,
        status: transaction.status,
      },
    });
  } catch (err) {
    console.error("Status Check Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error checking transaction status" 
    });
  }
};

// Query Transaction by ID
export const getTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await MpesaTransaction.findById(id);

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: "Transaction not found" 
      });
    }

    res.json({
      success: true,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        phone: transaction.phone,
        status: transaction.status,
        receiptNumber: transaction.mpesaReceiptNumber,
        date: transaction.transactionDate,
        createdAt: transaction.createdAt,
      },
    });
  } catch (err) {
    console.error("Get Transaction Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching transaction" 
    });
  }
};