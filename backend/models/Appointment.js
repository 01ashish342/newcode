const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  payment_id: String,
  booking_id: String,
  amount: Number,
  method: String,
  status: { type: String, default: "pending" },
  createdAt: Date,
});

const appointmentSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  date: Date,
  time: String,
  reason: String,
  status: { type: String, default: "pending" },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "Coach" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  payment: paymentSchema, // ✅ nested properly
});

module.exports = mongoose.model("Appointment", appointmentSchema);
