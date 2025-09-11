// subSchemas/milestoneSchema.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const milestoneSchema = new Schema({
  id: { type: Schema.Types.Mixed }, // For manual ID assignment if needed (e.g., UUID)
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  description: { type: String, maxlength: 2000 },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ["completed", "active", "pending"],
    default: "pending",
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  requiredTasks: [{ type: Schema.Types.Mixed }], // Array of task IDs (Mixed for flexibility with manual IDs)
}, { _id: false });

export default milestoneSchema;