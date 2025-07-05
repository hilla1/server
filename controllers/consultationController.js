// consultationController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import transporter from '../config/nodemailer.js';
import { setAuthCookies } from '../utils/setAuthCookies.js';
import consultationModel from "../models/consultationModel.js";
import userModel from "../models/userModel.js";
import { format } from 'date-fns';
import querystring from 'querystring';

export const createConsultation = async (req, res) => {
  try {
    const token = req.cookies?.token;
    let userId = null;
    let role = null;
    let loggedInUser = null;

    // Decode token and fetch user
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;

        loggedInUser = await userModel.findById(userId);
        if (!loggedInUser) {
          return res.json({ success: false, message: 'User not found' });
        }

        role = loggedInUser.role;

        // Restrict regular users from submitting consultations for others
        if ((role !== 'admin' && role !== 'consultant') && loggedInUser.email !== req.body.email) {
          return res.json({
            success: false,
            message: 'You are not allowed to create consultations for other users',
          });
        }
      } catch (err) {
        return res.json({ success: false, message: 'Invalid or expired token' });
      }
    }

    const {
      fullName: name,
      email,
      phoneNumber,
      services,
      budget,
      timeline,
      description,
      timeSlot,
    } = req.body;

    if (!email || !name) {
      return res.json({ success: false, message: 'Full name and email are required' });
    }

    let targetUser = null;
    let creatingForSomeoneElse = false;

    // Determine if creating for another user
    if (userId && role === 'admin' || role === 'consultant') {
      if (loggedInUser.email !== email) {
        creatingForSomeoneElse = true;
      } else {
        targetUser = loggedInUser;
      }
    } else if (userId) {
      targetUser = loggedInUser;
    }

    // If user doesn't exist, create them
    if (!targetUser) {
      targetUser = await userModel.findOne({ email });

      if (!targetUser) {
        const randomPassword = crypto.randomBytes(6).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        targetUser = new userModel({ name, email, password: hashedPassword });
        await targetUser.save();

        // Set cookie for guests
        if (!creatingForSomeoneElse) {
          const newToken = jwt.sign({ id: targetUser._id, role: targetUser.role }, process.env.JWT_SECRET, {
            expiresIn: '7d',
          });
          setAuthCookies(res, newToken);
        }

        // Send welcome email
        const welcomeMail = {
          from: process.env.SENDER_EMAIL,
          to: email,
          subject: 'Welcome to Tech with Brands – Your Account Details',
          text: `Hi ${name},\n\nAn account has been created for you on Tech with Brands.\n\nLogin Email: ${email}\nPassword: ${randomPassword}\n\nLogin and update your password at https://techwithbrands.com\n\nBest,\nTech with Brands Team`,
        };

        await transporter.sendMail(welcomeMail);
      }
    }

    // Parse and validate timeSlot
    const localDate = new Date(timeSlot);
    if (!localDate || isNaN(localDate)) {
      return res.json({ success: false, message: 'Invalid timeSlot format provided.' });
    }

    // Format for Nairobi timezone
    const emailFormatterDate = new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const emailFormatterTime = new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });

    const formattedDate = emailFormatterDate.format(localDate);
    const formattedTime = emailFormatterTime.format(localDate);

    // Convert to UTC for Google Calendar
    const utcStart = new Date(localDate.getTime() - 3 * 60 * 60 * 1000);
    const utcEnd = new Date(utcStart.getTime() + 45 * 60 * 1000);

    const calendarStartUTC = format(utcStart, "yyyyMMdd'T'HHmmss'Z'");
    const calendarEndUTC = format(utcEnd, "yyyyMMdd'T'HHmmss'Z'");

    const calendarLink = `https://calendar.google.com/calendar/render?${querystring.stringify({
      action: 'TEMPLATE',
      text: 'Tech with Brands - Consultation',
      details: `Consultation with Tech with Brands.\n\nDescription: ${description || 'N/A'}`,
      location: 'https://techwithbrands.com',
      dates: `${calendarStartUTC}/${calendarEndUTC}`,
    })}`;

    // Create consultation record
    const newConsultation = new consultationModel({
      user: targetUser._id,
      phoneNumber:phoneNumber || '', 
      services: services || [],
      budget: budget || '',
      timeline: timeline || '',
      description: description || '',
      timeSlot: timeSlot || '',
      status: creatingForSomeoneElse ? 'scheduled' : 'pending',
      handlers: creatingForSomeoneElse ? [userId] : [],
    });

    await newConsultation.save();

    // Send confirmation to client
    const confirmationMail = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Your Consultation Has Been Scheduled',
      text: `Hi ${targetUser.name || name},\n\nYour consultation request has been submitted successfully.\n\n🗓 Scheduled for: ${formattedDate} at ${formattedTime}\n📍 Location: Online (Tech with Brands)\n\n👉 You can track the progress by logging into your account at https://techwithbrands.com\n\n📅 Add to your calendar: ${calendarLink}\n\nThanks for choosing Tech with Brands!\n\nBest,\nThe Tech with Brands Team`,
    };

    await transporter.sendMail(confirmationMail);

    // Notify admin/consultant
    if (creatingForSomeoneElse && loggedInUser) {
      const handlerMail = {
      from: process.env.SENDER_EMAIL,
      to: loggedInUser.email,
      subject: `You Scheduled a Consultation for ${targetUser.name}`,
      text: `Hi ${loggedInUser.name},\n\nYou have successfully scheduled a consultation on behalf of:

     👤 Client: ${targetUser.name} (${targetUser.email})
     📞 Phone: ${phoneNumber}
     🗓 Date: ${formattedDate}
     🕒 Time: ${formattedTime}
     🧾 Services: ${services?.join(', ') || 'N/A'}
     📝 Description: ${description || 'N/A'}

     📅 Add to your calendar: ${calendarLink}

     🔗 Manage the consultation: https://techwithbrands.com/dashboard

    Best,
    Tech with Brands Team`,
    };

    await transporter.sendMail(handlerMail);
    }

    return res.json({
      success: true,
      message: creatingForSomeoneElse
        ? 'Consultation created on behalf of another user and emails sent.'
        : 'Consultation created and email sent successfully.',
    });

  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: 'Server error: ' + error.message });
  }
};


// Get consultations based on user role
export const getConsultations = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    let filter = {};

    if (userRole === 'client') {
      filter = { user: userId };
    } else if (userRole === 'consultant') {
      filter = {
        $or: [
          { user: userId },
          { handlers: userId }
        ]
      };
    } else if (userRole === 'admin') {
      // No filter — admin sees everything
      filter = {};
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const consultations = await consultationModel
      .find(filter)
      .populate('user', 'name email avatar')        // Populate client info
      .populate('handlers', 'name email avatar');   // Populate consultant(s)

    return res.json({ success: true, consultations });
  } catch (error) {
    console.error('Error fetching consultations:', error);
    return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};


// Get individual consultation by ID (accessible to admins, handlers, and the user who created it)
export const getConsultationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const consultation = await consultationModel
      .findById(id)
      .populate('user', 'name email')
      .populate('handlers', 'name email');

    if (!consultation) {
      return res.json({ success: false, message: "Consultation not found" });
    }

    // Authorization logic
    if (
      userRole !== 'admin' &&
      consultation.user.toString() !== userId &&
      !consultation.handlers.some(handler => handler._id.toString() === userId)
    ) {
      return res.json({ success: false, message: "Unauthorized access to this consultation" });
    }

    return res.json({ success: true, consultation });
    
  } catch (error) {
    console.error("Error fetching consultation by ID:", error);
    return res.json({ success: false, message: "Server error: " + error.message });
  }
};


export const updateById = async (req, res) => {
  try {
    const { id } = req.params;
    const { timeSlot, status, services, phoneNumber } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;

    const consultation = await consultationModel
      .findById(id)
      .populate('user', 'name email')
      .populate('handlers', 'name email');

    if (!consultation) {
      return res.json({ success: false, message: 'Consultation not found' });
    }

    const isAdmin = userRole === 'admin';
    const isHandler = consultation.handlers.some(h => h._id.toString() === userId);
    const isClient = consultation.user._id.toString() === userId;

    if (!isAdmin && !isHandler && !isClient) {
      return res.json({ success: false, message: 'Unauthorized to update this consultation' });
    }

    if (isClient) {
      if (!consultation.handlers || consultation.handlers.length === 0) {
        return res.json({
          success: false,
          message: 'You cannot reschedule a consultation unless it has a handler assigned.',
        });
      }
      if (consultation.status !== 'pending') {
        return res.json({
          success: false,
          message: 'You can only reschedule consultations while their status is pending.',
        });
      }
    }

    const changes = [];
    let timeSlotChanged = false;
    let statusChanged = false;
    let servicesChanged = false;
    let phoneChanged = false;

    // Validate
    if (timeSlot && isNaN(new Date(timeSlot))) {
      return res.json({ success: false, message: 'Invalid timeSlot format' });
    }
    if (status && !['pending', 'scheduled', 'rescheduled', 'canceled', 'completed'].includes(status)) {
      return res.json({ success: false, message: 'Invalid status value' });
    }

    // Detect changes
    if (timeSlot && new Date(timeSlot).toISOString() !== new Date(consultation.timeSlot).toISOString()) {
      consultation.rescheduleHistory = consultation.rescheduleHistory || [];
      consultation.rescheduleHistory.push({
        oldTimeSlot: consultation.timeSlot,
        changedAt: new Date(),
      });
      consultation.timeSlot = timeSlot;
      timeSlotChanged = true;
      changes.push(`🕒 Time changed to ${new Date(timeSlot).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`);
    }

    if (status && status !== consultation.status) {
      consultation.status = status;
      statusChanged = true;
      changes.push(`📌 Status changed to "${status}"`);
    }

    if (services && JSON.stringify(services) !== JSON.stringify(consultation.services)) {
      consultation.services = services;
      servicesChanged = true;
      changes.push(`🛠 Services updated`);
    }

    if (phoneNumber && phoneNumber !== consultation.phoneNumber) {
      consultation.phoneNumber = phoneNumber;
      phoneChanged = true;
      changes.push(`📞 Phone number updated to ${phoneNumber}`);
    }

    if (!timeSlotChanged && !statusChanged && !servicesChanged && !phoneChanged) {
      return res.json({ success: false, message: 'No changes were made.' });
    }

    // Auto update status if time changed
    if (timeSlotChanged && !status) {
      consultation.status = 'rescheduled';
      changes.push(`📌 Status auto-set to "rescheduled" due to time change`);
    }

    await consultation.save();

    // Format time for calendar and human display
    const newTime = new Date(consultation.timeSlot);
    const formattedDate = new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(newTime);

    const formattedTime = new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(newTime);

    const utcStart = new Date(newTime.getTime() - 3 * 60 * 60 * 1000);
    const utcEnd = new Date(utcStart.getTime() + 45 * 60 * 1000);
    const calendarStartUTC = format(utcStart, "yyyyMMdd'T'HHmmss'Z'");
    const calendarEndUTC = format(utcEnd, "yyyyMMdd'T'HHmmss'Z'");

    const calendarDetails = `Your consultation has been updated.

    👤 Name: ${consultation.user.name}
    📧 Email: ${consultation.user.email}
    📞 Phone: ${consultation.phoneNumber}
    🗓 Date: ${formattedDate}
    🕒 Time: ${formattedTime}
     `;

    const calendarLink = `https://calendar.google.com/calendar/render?${querystring.stringify({
      action: 'TEMPLATE',
      text: 'Tech with Brands - Updated Consultation',
      details: calendarDetails,
      location: 'https://techwithbrands.com',
      dates: `${calendarStartUTC}/${calendarEndUTC}`,
    })}`;

    const changeSummary = changes.join('\n');

    // Email to client
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: consultation.user.email,
      subject: 'Your Consultation Has Been Updated',
      text: `Hi ${consultation.user.name},\n\nYour consultation has been updated:\n\n${changeSummary}\n\n🗓 Date: ${formattedDate}\n🕒 Time: ${formattedTime}\n\n📞 Phone: ${consultation.phoneNumber}\n📅 Add to Calendar: ${calendarLink}\n\nThanks,\nTech with Brands Team`,
    });

    // Email to each handler (including updated phone number)
    if (consultation.handlers && consultation.handlers.length > 0) {
      for (const handler of consultation.handlers) {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: handler.email,
          subject: 'A Consultation You Handle Has Been Updated',
          text: `Hi ${handler.name},\n\nThe consultation with ${consultation.user.name} has been updated:\n\n${changeSummary}\n\n📞 Phone: ${consultation.phoneNumber}\n🗓 Date: ${formattedDate}\n🕒 Time: ${formattedTime}\n📅 Add to Calendar: ${calendarLink}\n\nThanks,\nTech with Brands Team`,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Consultation updated and notifications sent.',
    });
  } catch (error) {
    console.error('Error updating consultation:', error);
    return res.json({ success: false, message: 'Server error: ' + error.message });
  }
};


export const assignHandler = async (req, res) => {
  const userId = req.userId;
  const userRole = req.userRole;
  const { emails, action } = req.body; // action = 'assign' or 'remove'
  const { id } = req.params;

  if (!id || !emails || !Array.isArray(emails) || !['assign', 'remove'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Consultation ID, valid emails array, and valid action are required',
    });
  }

  try {
    const consultation = await consultationModel
      .findById(id)
      .populate('handlers', 'email name')
      .populate('user', 'name email');

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }

    const isAuthorized = userRole === 'admin' || consultation.handlers.some(h => h._id.toString() === userId);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to modify handlers for this consultation',
      });
    }

    const results = [];

    // Format Nairobi time for emails
    const localDate = new Date(consultation.timeSlot);
    const dateOptions = { timeZone: 'Africa/Nairobi', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { timeZone: 'Africa/Nairobi', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' };
    const formattedDate = new Intl.DateTimeFormat('en-KE', dateOptions).format(localDate);
    const formattedTime = new Intl.DateTimeFormat('en-KE', timeOptions).format(localDate);
    const utcStart = new Date(localDate.getTime() - 3 * 60 * 60 * 1000);
    const utcEnd = new Date(utcStart.getTime() + 45 * 60 * 1000);
    const calendarStartUTC = format(utcStart, "yyyyMMdd'T'HHmmss'Z'");
    const calendarEndUTC = format(utcEnd, "yyyyMMdd'T'HHmmss'Z'");
    const calendarLink = `https://calendar.google.com/calendar/render?${querystring.stringify({
      action: 'TEMPLATE',
      text: 'Tech with Brands - Consultation',
      details: `Consultation scheduled.\n\nDescription: ${consultation.description || 'N/A'}`,
      location: 'https://techwithbrands.com',
      dates: `${calendarStartUTC}/${calendarEndUTC}`,
    })}`;

    if (action === 'remove') {
      for (const email of emails) {
        const user = await userModel.findOne({ email });
        if (!user) {
          results.push({ email, removed: false, reason: 'User not found' });
          continue;
        }

        const wasHandler = consultation.handlers.some(h => h._id.toString() === user._id.toString());
        if (!wasHandler) {
          results.push({ email, removed: false, reason: 'User is not a handler' });
          continue;
        }

        // Remove user from handlers
        consultation.handlers = consultation.handlers.filter(h => h._id.toString() !== user._id.toString());

        // Send removal email
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: user.email,
          subject: 'Removed from Consultation – Tech with Brands',
          text: `Hi ${user.name},\n\nYou have been removed as a handler from the following consultation:\n\n👤 Client: ${consultation.user?.name || 'N/A'}\n🧾 Services: ${consultation.services?.join(', ') || 'N/A'}\n📝 Description: ${consultation.description || 'N/A'}\n🗓 Scheduled for: ${formattedDate} at ${formattedTime}\n\nThis change was made by another authorized user.\n\nLogin for details: https://techwithbrands.com\n\nBest,\nTech with Brands Team`,
        });

        results.push({ email, removed: true });
      }

      await consultation.save();

      return res.json({
        success: true,
        message: 'Handler(s) removed successfully',
        results,
      });
    }

    const assignedUsers = [];

    for (const email of emails) {
      const alreadyHandler = consultation.handlers.some(h => h.email === email);
      if (alreadyHandler) {
        results.push({ email, assigned: false, reason: 'Already a handler' });
        continue;
      }

      let user = await userModel.findOne({ email });

      const sendAssignEmail = async (recipient) => {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: recipient.email,
          subject: 'You Have Been Assigned to a Consultation',
          text: `Hi ${recipient.name},\n\nYou have been assigned as a handler for the following consultation:\n\n👤 Client: ${consultation.user?.name || 'N/A'} (${consultation.user?.email || 'N/A'})\n🧾 Services: ${consultation.services?.join(', ') || 'N/A'}\n📝 Description: ${consultation.description || 'N/A'}\n🗓 Scheduled for: ${formattedDate} at ${formattedTime}\n📍 Location: Online (Tech with Brands)\n\n📅 Add to your calendar: ${calendarLink}\n\nLogin to manage: https://techwithbrands.com\n\nBest,\nTech with Brands Team`,
        });
      };

      if (!user) {
        const nameFromEmail = email.split('@')[0].replace(/\./g, ' ');
        const randomPassword = crypto.randomBytes(6).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = new userModel({
          name: nameFromEmail,
          email,
          password: hashedPassword,
          role: 'consultant',
        });

        await user.save();

        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: email,
          subject: 'Account Created – Tech with Brands',
          text: `Hi ${nameFromEmail},\n\nAn account has been created for you on Tech with Brands.\n\nLogin Email: ${email}\nPassword: ${randomPassword}\n\nLogin and change your password at https://techwithbrands.com\n\nBest,\nTech with Brands Team`,
        });

        await sendAssignEmail(user);
      } else {
        if (user.role !== 'consultant' && user.role !== 'admin') {
          user.role = 'consultant';
          await user.save();
        }

        await sendAssignEmail(user);
      }

      consultation.handlers.push(user._id);
      assignedUsers.push({ name: user.name, email: user.email });
      results.push({ email, assigned: true });
    }

    await consultation.save();

    return res.json({
      success: true,
      message: 'Handler(s) processed',
    });

  } catch (err) {
    console.error('Assign handler error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing handler(s)',
    });
  }
};



// Check if a user exists by email
export const checkEmail = async (req, res) => {
  try {
    const { token } = req.cookies;

    if (token) {
      try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        return res.json({
          success: false,
          message: "User already logged in",
        });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    }

    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({
        success: false,
        message: "User does not exist",
      });
    }

    return res.json({
      success: true,
      message: "User exists",
    });

  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const deleteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const consultation = await consultationModel
      .findById(id)
      .populate('user', 'name email _id')
      .populate('handlers', 'name email _id');

    if (!consultation) {
      return res.json({ success: false, message: 'Consultation not found' });
    }

    const isAdmin = userRole === 'admin';
    const isClient = consultation.user._id.toString() === userId;
    const isHandler = consultation.handlers.some(handler => handler._id.toString() === userId);
    const isPending = consultation.status === 'pending';
    const isCreator = isClient;

    // Authorization check
    if (isAdmin) {
      // always allowed
    } else if (userRole === 'consultant') {
      if (!(isPending && (isHandler || isCreator))) {
        return res.json({
          success: false,
          message:
            'Unauthorized: Consultants can only delete pending consultations they handle or created',
        });
      }
    } else if (userRole === 'client') {
      if (!(isPending && isClient)) {
        return res.json({
          success: false,
          message: 'Unauthorized: Clients can only delete their own pending consultations',
        });
      }
    } else {
      return res.json({ success: false, message: 'Unauthorized role' });
    }

    // Save info before deletion
    const { name: clientName, email: clientEmail } = consultation.user;
    const handlerEmails = consultation.handlers.map(h => h.email);
    const handlerNames = consultation.handlers.map(h => h.name).join(', ');

    // Delete consultation
    await consultation.deleteOne();

    // Send email to the user (creator)
    const userMail = {
      from: process.env.SENDER_EMAIL,
      to: clientEmail,
      subject: 'Consultation Cancelled',
      text: `Hi ${clientName},\n\nYour consultation has been deleted successfully.\n\nIf this was a mistake, please reach out to our support.\n\nThank you,\nTech with Brands Team`,
    };
    await transporter.sendMail(userMail);

    // Notify handlers if any
    if (handlerEmails.length > 0) {
      for (const handler of consultation.handlers) {
        const mail = {
          from: process.env.SENDER_EMAIL,
          to: handler.email,
          subject: 'Consultation Assignment Cancelled',
          text: `Hi ${handler.name},\n\nThe consultation assigned to you (with ${clientName}) has been deleted.\n\nPlease check your dashboard for updates.\n\nThanks,\nTech with Brands Team`,
        };
        await transporter.sendMail(mail);
      }
    }

    return res.json({ success: true, message: 'Consultation deleted and notifications sent' });
  } catch (error) {
    console.error('Error deleting consultation:', error);
    return res.json({ success: false, message: 'Server error: ' + error.message });
  }
};
