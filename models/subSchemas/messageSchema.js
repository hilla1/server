import mongoose from 'mongoose';
import attachmentSchema from './attachmentSchema.js';

const replySchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  avatar: { type: String },
  time: { type: String },
  date: { type: String },
  content: { type: String },
  attachments: [attachmentSchema],
}, { _id: false });

const messageSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  avatar: { type: String },
  time: { type: String },
  date: { type: String },
  content: { type: String },
  attachments: [attachmentSchema],
  replies: [replySchema],
}, { _id: false });

export default messageSchema;
