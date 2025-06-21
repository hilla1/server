import axios from "axios";
import moment from "moment";
import MpesaTransaction from "../models/mpesaModel.js";


const getMpesaToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(`${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  return res.data.access_token;
};

// STK PUSH initiation with amount
export const initiateStkPush = async (req, res) => {
  const { phone, amount = 1 } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ success: false, message: "Phone and amount required." });
  }

  try {
    const accessToken = await getMpesaToken();

    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const phoneFormatted = phone.startsWith("254") ? phone : phone.replace(/^0/, "254");

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
        AccountReference: "TWB",
        TransactionDesc: "Plan Subscription Payment",
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    // Save transaction
    await MpesaTransaction.create({
      phone,
      amount,
      checkoutRequestID: response.data.CheckoutRequestID,
    });

    return res.json({
      success: true,
      message: "STK push sent. Complete the payment on your phone.",
      data: response.data,
    });
  } catch (err) {
    console.error("M-Pesa Error:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: err.response?.data?.errorMessage || "M-Pesa payment initiation failed.",
    });
  }
};

// Callback handler
export const mpesaCallback = async (req, res) => {
  const body = req.body;

  try {
    const callback = body.Body?.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    const transaction = await MpesaTransaction.findOne({ checkoutRequestID: CheckoutRequestID });

    if (!transaction) {
      return res.sendStatus(200); // Always respond with 200 to Safaricom
    }

    transaction.status = ResultCode === 0 ? "Completed" : "Failed";
    transaction.rawCallback = callback;

    if (ResultCode === 0) {
      const items = CallbackMetadata.Item;
      transaction.mpesaReceiptNumber = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
      transaction.transactionDate = items.find((i) => i.Name === "TransactionDate")?.Value;
    }

    await transaction.save();
  } catch (error) {
    console.error("M-Pesa Callback Error:", error.message);
  }

  res.sendStatus(200); // Required by Safaricom
};
