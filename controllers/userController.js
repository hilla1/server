import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt';

export const getUserData = async (req, res)=>{
    try {
        const userId = req.userId;

        const user = await userModel.findById(userId);

        if(!user){
            return res.json({success:false, message: 'User not found'});
        }

        return res.json({success:true, userData: {
            name: user.name,
            email: user.email,
            role:req.userRole,
            avatar:user.avatar,
            isAccountVerified: user.isAccountVerified
        }});
        
    } catch (error) {
        return res.json({success:false, message: error.message});
    }
}

export const updateProfile = async (req, res) => {
  const { name, avatar } = req.body;
  const userId = req.userId;

  if (!userId) return res.json({ success: false, message: 'Unauthorized' });

  try {
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { name, avatar },
      { new: true }
    );

    return res.json({ success: true, message: 'Profile updated', user: updatedUser });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};


export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.userId;

  if (!userId) return res.json({ success: false, message: 'Unauthorized' });

  try {
    const user = await userModel.findById(userId);
    if (!user) return res.json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.json({ success: false, message: 'Incorrect current password' });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
