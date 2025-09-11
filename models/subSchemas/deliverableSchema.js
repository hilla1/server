// subSchemas/deliverableSchema.js
import mongoose from 'mongoose';

const deliverableSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  name: { type: String },
  type: {
    type: String,
    enum: ['application', 'code', 'design', 'documentation', 'video', 'other'],
  },
  description: { type: String },
  size: { type: String },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'pending',
  },
  url: { type: String },
  publicId: { type: String },
}, { _id: false });

export default deliverableSchema;