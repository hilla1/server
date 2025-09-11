// models/projectModel.js
import mongoose from 'mongoose';
import messageSchema from './subSchemas/messageSchema.js';
import deliverableSchema from './subSchemas/deliverableSchema.js';
import teamMemberSchema from './subSchemas/teamMemberSchema.js';
import phaseSchema from './subSchemas/phaseSchema.js';

const { Schema } = mongoose;

const projectSchema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "user", required: true },

  projectName: { type: String, required: true, minlength: 3, maxlength: 100, trim: true },
  projectType: { type: String, required: true, trim: true, enum: ['logo_design', 'branding', 'web_development', 'app_development', 'other'] }, // Added enum for better validation; extend as needed
  description: { type: String, required: true, minlength: 50, maxlength: 5000 },
  timeline: { type: String, required: true, trim: true },
  budget: { type: String, required: true, trim: true },
  features: { type: [String], required: true, validate: [arrayLimit(1, 50), 'Features must have between 1 and 50 items'] },
  priority: { type: String, required: true, trim: true, enum: ['low', 'medium', 'high', 'critical'] },
  integrations: { type: [String], default: [], validate: [arrayLimit(0, 20), 'Integrations must have at most 20 items'] },

  files: [
    {
      name: { type: String, required: true, trim: true },
      size: { type: Number, required: true, min: 0 },
      url: { type: String, required: true, trim: true },
      publicId: { type: String, required: true, trim: true },
    },
  ],

  plan: {
    name: { type: String, trim: true },
    description: { type: String, maxlength: 1000 },
    price: { type: String, trim: true },
    period: { type: String, trim: true },
    features: { type: [String], default: [], validate: [arrayLimit(0, 20), 'Plan features must have at most 20 items'] },
  },

  progress: { type: Number, default: 0, min: 0, max: 100 },

  dashboardFiles: [
    {
      name: { type: String, trim: true },
      size: { type: Number, min: 0 },
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],

  recentFiles: [
    {
      name: { type: String, trim: true },
      type: { type: String, trim: true },
      size: { type: String, trim: true },
      time: { type: String, trim: true },
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
  ],

  phases: [phaseSchema],

  notifications: [
    {
      message: { type: String, trim: true },
      time: { type: String, trim: true },
      unread: { type: Boolean, default: true },
    },
  ],

  activityLog: [
    {
      user: { type: String, trim: true },
      action: { type: String, trim: true },
      item: { type: String, trim: true },
      time: { type: String, trim: true },
    },
  ],

  teamMembers: [teamMemberSchema],

  sharedFiles: [
    {
      fileName: { type: String, trim: true },
      sharedBy: { type: String, trim: true },
      date: { type: String, trim: true },
      time: { type: String, trim: true },
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      size: { type: Number, min: 0 },
      type: { type: String, trim: true },
    },
  ],

  messages: [messageSchema],

  finalApproval: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, maxlength: 2000 },
    improvements: { type: String, maxlength: 2000 },
    approvedAt: { type: Date, default: null },
  },

  deliverables: [deliverableSchema],

  summary: {
    title: { type: String, trim: true },
    duration: { type: String, trim: true },
    completedFeatures: { type: [String], default: [] },
    teamMembers: { type: [String], default: [] },
    technologies: { type: [String], default: [] },
  },
}, {
  timestamps: true,
});

// Helper validator for array limits
function arrayLimit(min, max) {
  return function (val) {
    return val.length >= min && val.length <= max;
  };
}

// Indexes for scalability and query performance
projectSchema.index({ client: 1 });
projectSchema.index({ projectName: 1, client: 1 });
projectSchema.index({ projectType: 1 });
projectSchema.index({ createdAt: -1 });

const projectModel = mongoose.models.project || mongoose.model('project', projectSchema);
export default projectModel;