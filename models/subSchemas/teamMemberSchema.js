// subSchemas/teamMemberSchema.js
import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  name: { type: String },
  designation: { type: String },
  avatar: { type: String },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline',
  },
}, { _id: false });

export default teamMemberSchema;