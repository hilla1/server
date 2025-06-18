import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    phoneNumber: {
      type: String,
      default: '',
    },
    services: {
      type: [String],
      default: [],
    },
    budget: {
      type: String,
      default: '',
    },
    timeline: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    timeSlot: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'rescheduled', 'canceled', 'completed'],
      default: 'pending',
    },
    handlers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
      },
    ],
    rescheduleHistory: [
      {
        oldTimeSlot: {
          type: String,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const consultationModel =
  mongoose.models.Consultation || mongoose.model('Consultation', consultationSchema);

export default consultationModel;
