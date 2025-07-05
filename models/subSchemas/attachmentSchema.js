import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  name: { type: String },
  blob: {
    data: { type: [Number] },
    type: { type: String },
  },
}, { _id: false });

export default attachmentSchema;
