// middleware/uploadMiddleware.js
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

// Use memory storage (buffer)
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// Upload buffer to Cloudinary
export const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result); // secure_url, public_id
        }
      }
    ).end(fileBuffer);
  });
};

// Delete from Cloudinary using publicId and invalidate CDN
export const deleteFromCloudinary = async (publicId) => {

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { invalidate: true },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
  });
};
