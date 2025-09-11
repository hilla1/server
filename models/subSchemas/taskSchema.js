// subSchemas/taskSchema.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const taskSchema = new Schema({
  id: { type: Schema.Types.Mixed }, // For manual ID assignment if needed (e.g., UUID)
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  description: { type: String, maxlength: 2000 },
  assignee: { type: Schema.Types.ObjectId, ref: 'user' },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'done'],
    default: 'todo',
  },
  dueDate: { type: Date },
  completedAt: { type: Date },
  dependencies: [{ type: Schema.Types.Mixed }], // IDs of dependent tasks for DAG-like scalability
}, { _id: false });

export default taskSchema;