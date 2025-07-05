import mongoose from 'mongoose';
import messageSchema from './subSchemas/messageSchema.js';
import deliverableSchema from './subSchemas/deliverableSchema.js';
import teamMemberSchema from './subSchemas/teamMemberSchema.js';

const { Schema } = mongoose;

const projectSchema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "user", required: true },

  projectName: { type: String, required: true, minlength: 3, trim: true },
  projectType: { type: String, required: true, trim: true },
  description: { type: String, required: true, minlength: 50 },
  timeline: { type: String, required: true, trim: true },
  budget: { type: String, required: true, trim: true },
  features: { type: [String], required: true },
  priority: { type: String, required: true, trim: true },
  integrations: { type: [String], default: [] },

  files: [
    {
      name: { type: String, required: true },
      size: { type: Number, required: true },
      url: { type: String, required: true },
      publicId: { type: String, required: true },
    },
  ],

  plan: {
    name: { type: String },
    description: { type: String },
    price: { type: String },
    period: { type: String },
    features: [String],
  },

  progress: { type: Number, default: 0 },

  dashboardFiles: [
    {
      name: { type: String },
      size: { type: Number },
      url: { type: String },
      publicId: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],

  recentFiles: [
    {
      name: { type: String },
      type: { type: String },
      size: { type: String },
      time: { type: String },
    },
  ],

  phases: [
    {
      name: { type: String },
      status: {
        type: String,
        enum: ["completed", "active", "pending"],
        default: "pending",
      },
      startDate: { type: Date },
      endDate: { type: Date },
      progress: { type: Number, default: 0 },
    },
  ],

  milestones: [
    {
      title: { type: String },
      progress: { type: Number, default: 0 },
      dueDate: { type: Date },
      status: {
        type: String,
        enum: ["completed", "active", "pending"],
        default: "pending",
      },
    },
  ],

  notifications: [
    {
      message: { type: String },
      time: { type: String },
      unread: { type: Boolean, default: true },
    },
  ],

  activityLog: [
    {
      user: { type: String },
      action: { type: String },
      item: { type: String },
      time: { type: String },
    },
  ],

  teamMembers: [teamMemberSchema],

  sharedFiles: [
    {
      fileName: { type: String },
      sharedBy: { type: String },
      date: { type: String },
      time: { type: String },
    },
  ],

  messages: [messageSchema],

  finalApproval: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String },
    improvements: { type: String },
    approvedAt: { type: Date, default: null },
  },

  deliverables: [deliverableSchema],

  summary: {
    title: { type: String },
    duration: { type: String },
    completedFeatures: [String],
    teamMembers: [String],
    technologies: [String],
  },
}, {
  timestamps: true,
});

const projectModel = mongoose.models.project || mongoose.model('project', projectSchema);
export default projectModel;
