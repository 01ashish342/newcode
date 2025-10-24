
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const coachSchema = new mongoose.Schema({
 coachImage: {
    type: String,
    default: "photo2.jpg" // fallback default image
  },
  name: { type: String, required: true },
  experience: { type: Number, required: true },
  team: { type: String, required: true },
  sport: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: "User" } 
});


module.exports = mongoose.model("Coach", coachSchema);
