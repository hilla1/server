// subSchemas/phaseSchema.js
import mongoose from 'mongoose';
import taskSchema from './taskSchema.js';
import milestoneSchema from './milestoneSchema.js';

const { Schema } = mongoose;

const phaseSchema = new Schema({
  id: { type: Schema.Types.Mixed }, // For manual ID assignment if needed (e.g., UUID)
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  status: {
    type: String,
    enum: ["completed", "active", "pending"],
    default: "pending",
  },
  startDate: { type: Date },
  endDate: { type: Date },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  tasks: [taskSchema],
  milestones: [milestoneSchema],
}, { _id: false });

export default phaseSchema;