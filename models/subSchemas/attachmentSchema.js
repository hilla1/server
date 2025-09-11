// subSchemas/attachmentSchema.js
import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  publicId: { type: String, required: true, trim: true },
  size: { type: Number, min: 0 },
  type: { type: String, trim: true },
}, { _id: false });

export default attachmentSchema;