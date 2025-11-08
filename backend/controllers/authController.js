import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }
    if (user.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    res.status(200).json({ success: true, userId:user._id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const Register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Name, email, and password are required",
        });
    }
    const user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    const newUser = new User({ name, email, password , role });
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email , role: newUser.role},
      "your_jwt_secret",
      { expiresIn: "7d" }
    );
    await newUser.save();
    res.status(201).json({ success: true, token });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getRole = async (req, res) => {
  try {
    const id = req.params.userId
    const user = await User.findById(id)
    if(user){
      res.status(200).json({role:user.role})
    }
  } catch (error) {
        console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}