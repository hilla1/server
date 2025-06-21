import mongoose from "mongoose";

const mpesaTransactionSchema = new mongoose.Schema(
  {
    phone: { 
      type: String, 
      required: true 
    },
    amount: { 
      type: Number, 
      required: true 
    },
    checkoutRequestID: { 
      type: String, 
      required: true, 
      unique: true,
      index: true  // This creates the index automatically
    },
    merchantRequestID: { 
      type: String 
    },
    mpesaReceiptNumber: { 
      type: String 
    },
    transactionDate: { 
      type: String 
    },
    status: { 
      type: String, 
      enum: ["Pending", "Completed", "Failed", "Cancelled"],
      default: "Pending"
    },
    resultCode: { 
      type: String 
    },
    resultDesc: { 
      type: String 
    },
    callbackMetadata: { 
      type: mongoose.Schema.Types.Mixed 
    },
    rawCallback: { 
      type: mongoose.Schema.Types.Mixed 
    },
  },
  { 
    timestamps: true 
  }
);

mpesaTransactionSchema.index({ phone: 1 });
mpesaTransactionSchema.index({ status: 1 });
mpesaTransactionSchema.index({ createdAt: 1 });

export default mongoose.model("MpesaTransaction", mpesaTransactionSchema);