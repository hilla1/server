import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import transporter from '../config/nodemailer.js';
import { OAuth2Client } from 'google-auth-library';
import { setAuthCookies } from '../utils/setAuthCookies.js';
import { clearAuthCookies } from '../utils/clearAuthCookies.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
const redirectURL = `${process.env.BASE_URL}/auth/oauth/callback`;

export const register = async (req, res)=>{

    if (!req.body) {
    return res.json({ message: 'Request body is missing' });
     }
    const {name, email, password} = req.body;

    if(!name || !email || !password){
        return res.json({success: false, message: 'Missing Details'})
    }

    try {

        const existingUser = await userModel.findOne({email});

        if(existingUser){
            return res.json({success: false, message: 'User already exists'}) 
        }

        const hashedPassword = await bcrypt.hash(password,10);

        const user = new userModel({name, email, password:hashedPassword});
        await user.save();

        const token = jwt.sign({id: user._id, role: user.role}, process.env.JWT_SECRET, { expiresIn: '7d'});

        setAuthCookies(res, token);

        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: 'Welcome to TwB (Tech with Brands)',
            text: `Welcome to TwB. Your account has been created with email id: ${email}`
        }

        await transporter.sendMail(mailOptions);

        return res.json({success: true, message: 'Account created succesfully'});
        //return res.redirect(`${process.env.VITE_CLIENT_URL}/dashboard`);
        
    } catch (error) {
        return res.json({success:false, message: error.message});
    }
};

export const login = async (req,res)=>{
    
    if (!req.body) {
    return res.json({ message: 'Request body is missing' });
     }

    const {email, password} = req.body;

    if(!email || !password){
        return res.json({success: false, message: 'Email and password are required'});
    }

    try {
        const user = await userModel.findOne({email});

        if(!user){
            return res.json({success: false, message: 'Invalid email'});
        }

        const isMatch = await bcrypt.compare(password,user.password);

        if(!isMatch){
            return res.json({success: false, message: 'Invalid password'});
        }

        const token = jwt.sign({id: user._id, role: user.role}, process.env.JWT_SECRET, { expiresIn: '7d'});

        setAuthCookies(res, token);

        return res.json({success: true, message: 'Login successful'});
        //return res.redirect(`${process.env.VITE_CLIENT_URL}/dashboard`);

    } catch (error) {
        return res.json({success: false, message:error.message });
    }

}

// Redirect user to Google Consent Screen
export const googleOAuthRedirect = (req, res) => {
  const authorizeUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', 
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    redirect_uri: redirectURL,
  });
  
  res.redirect(authorizeUrl);
};

// Handle Google OAuth callback and login/register user
export const googleOAuthCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Authorization code is required' });
  }

  try {
    const { tokens } = await client.getToken({
      code,
      redirect_uri: redirectURL,
    });
    client.setCredentials(tokens);

    const response = await client.request({
      url: 'https://www.googleapis.com/oauth2/v3/userinfo',
    });

    const { sub: googleId, email, name, picture } = response.data;

    let user = await userModel.findOne({ email });
    const isNewUser = !user;

    if (!user) {

      user = new userModel({
        name,
        email,
        googleId,
        isAccountVerified: true,
        avatar: picture,
        role: 'client', 
      });
      await user.save();

      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: email,
        subject: 'Welcome to TwB (Tech with Brands)',
        text: `Welcome to TwB. Your account has been created with email: ${email}`,
      });
    } else {

     let shouldSave = false;

    if (!user.avatar && picture) {
       user.avatar = picture;
       shouldSave = true;
     }

    if (!user.isAccountVerified) {
       user.isAccountVerified = true;
       shouldSave = true;
     }

    if (shouldSave) {
    await user.save();
    }
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    setAuthCookies(res, token);

    return res.redirect(`${process.env.VITE_CLIENT_URL}/dashboard`);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const logout = async (req,res)=>{
    try {
        clearAuthCookies(res);
        return res.json({success: true, message:"Logged out"});

    } catch (error) {
        return res.json({success: false, message:error.message});
    }
}


export const sendVerifyOtp = async (req,res)=>{
    try {
        const userId = req.userId;

        const user = await userModel.findById(userId);

        if(user.isAccountVerified){
            return res.json({success: false, message:"Account already verified"});
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));

        user.verifyOtp = otp;
        user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;

        await user.save();

        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Acccount verification OTP',
            text: ` Your OTP is ${otp}.Verify your account using this OTP.`
        }
        
        await transporter.sendMail(mailOptions);

        return res.json({success: true, message:'Verification OTP sent on Email'});

    } catch (error) {
        return res.json({success: false, message:error.message});
    }
}


export const verifyEmail = async (req,res)=>{

    if (!req.body) {
    return res.json({ message: 'Request body is missing' });
     }

     const userId = req.userId;
     const {otp} = req.body;

    if(!userId || !otp){
        return res.json({success: false, message:'Missing Details'});
    }

    try {
        const user = await userModel.findById(userId);

        if(!user){
            return res.json({success: false, message:'User not found'});
        }
        
        if(user.verifyOtp === '' || user.verifyOtp !== otp){
            return res.json({success: false, message:'Invalid OTP'});
        }

        if(user.verifyOtpExpireAt < Date.now()){
            return res.json({success: false, message:'OTP Expired'});
        }

        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpireAt = 0;

        await user.save();
        return res.json({success: true, message:'Email verified successfully'});

    } catch (error) {
        return res.json({success: false, message:error.message});
    }

}

export const isAuthenticated = async (req,res)=>{
    try {
        return res.json({success: true, message: 'Authenticated', role:req.userRole});
    } catch (error) {
        return res.json({success: false, message:error.message});
    }
}

export const sendResetOtp = async (req, res)=>{

    if (!req.body) {
    return res.json({ message: 'Request body is missing' });
     }

    const {email} = req.body;

    if(!email){
        return res.json({success: false, message:'Email is required'});  
    }

    try {
        const user = await userModel.findOne({email});

        if(!user){
            return res.json({success: false, message:'User not found'});
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));

        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;

        await user.save();

        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Password reset OTP',
            text: ` Your OTP for resetting your password is ${otp}. Use this OTP to proceed with resetting your password.`
        }
        
        await transporter.sendMail(mailOptions);

        return res.json({success: true, message:'OTP sent to your Email'});
        
    } catch (error) {
        return res.json({success: false, message:error.message});
    }
}

export const resetPassword = async (req, res)=>{

    if (!req.body) {
    return res.json({ message: 'Request body is missing' });
     }

    const {email, otp, newPassword} = req.body;

    if(!email || !otp || !newPassword){
        return res.json({success: false, message:'Email, OTP, and new password are required'});
    }

    try {
        const user = await userModel.findOne({email});
        if(!user){
            return res.json({success: false, message:'User not found'});
        }

        if(user.resetOtp === "" || user.resetOtp !== otp){
            return res.json({success: false, message:'Invalid OTP'});
        }

        if(user.resetOtpExpireAt < Date.now()){
            return res.json({success: false, message:'OTP Expired'});
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.resetOtp = '';
        user.resetOtpExpireAt = 0;

        await user.save();

        return res.json({success: true, message:'Password has been reset successfully'});

    } catch (error) {
        return res.json({success: false, message:error.message});
    }
}