// controllers/fileController.js
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from '../middleware/uploadMiddleware.js';

export const uploadFile = async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.json({ success: false, message: 'Unauthorized' });
  }

  try {
    if (!req.file) {
      return res.json({ success: false, message: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer);


    return res.json({
      success: true,
      message: 'File uploaded successfully',
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const deleteFile = async (req, res) => {
  const userId = req.userId;
  const { publicId } = req.body;

  if (!userId) {
    return res.json({ success: false, message: 'Unauthorized' });
  }

  if (!publicId) {
    return res.json({ success: false, message: 'Missing publicId' });
  }

  try {

    const result = await deleteFromCloudinary(publicId);

    if (result.result === 'ok') {
      return res.json({ success: true, message: 'File deleted successfully' });
    }

    return res.json({
      success: false,
      message: `Delete failed: ${result.result || 'Unknown error'}`,
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
