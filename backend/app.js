require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const app = express();
const mongoose = require("mongoose");
const dbUrl=process.env.ATLAS_DBURL

const User = require("./models/newUser.js"); 
const Coach = require("./models/Coach.js");
const Appointment  = require("./models/Appointment.js");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const session = require("express-session");
const MongoStore = require("connect-mongo");

const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { isLoggedIn, saveRedirectUrl } = require("./middleware.js");
const ExpressError = require("./utils/ExpressError.js");

const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server);

const Razorpay = require("razorpay");

// =================== Cloudinary Config ===================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// =================== Multer Config ===================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// =================== Razorpay Config ===================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_KEY
});

// =================== App Config ===================
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const store= MongoStore.create({
  mongoUrl: dbUrl,
  crypto:{
    secret:process.env.SECRET,
  },
touchAfter: 24*3600,
})

store.on("error",()=>{
  console.log("session store error",err);
}
)


app.use(session({
  store,

  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    expire: Date.now() + 7*24*60*60*1000,
    maxAge: 7*24*60*60*1000,
  }
}));


app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// =================== DB Connection ===================
const port = 5000;

main()
  .then(() => console.log("Connected to database"))
  .catch((err) => console.log(err));

async function main() {
  await mongoose.connect(dbUrl);
}

// =================== Middleware ===================
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.curruser = req.user;
  next();
});

// =================== Routes ===================

app.get("/", (req, res) => {
  res.redirect("/home");
});

// --- Signup ---
app.get("/signup", (req,res) => res.render("basicsignup.ejs"));
app.get("/signup/player", (req, res) => res.render("signup.ejs"));
app.get("/signup/coach", (req, res) => res.render("signup.ejs"));

app.post("/signup", async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    req.login(registeredUser, err => {
      if(err) return next(err);
      req.flash("success","Signup successfully");
      res.redirect("/addcoach");
    });
  } catch(err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});

// --- Login ---
app.get("/login", (req,res) => res.render("login.ejs"));

app.post("/login", saveRedirectUrl,
  passport.authenticate("local", { failureRedirect:"/login", failureFlash: true }),
  async (req, res) => {
    let redirectUrl = res.locals.redirectUrl || "/home";
    res.redirect(redirectUrl);  
});

app.get("/logout", (req,res,next) => {
  req.logout(err => {
    if(err) return next(err);
    req.flash("success","Logged out successfully");
    res.redirect("/home");
  });
});

// --- Home / Coaches ---
app.get("/home", async (req, res) => {
  try {
    const coaches = await Coach.find({});
    res.render("home.ejs", { coaches });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading home page");
  }
});

app.get("/viewcoach/:id", async (req, res) => {
  const { id } = req.params;
  const coach = await Coach.findById(id);
  res.render("viewcoach.ejs", { coach });
});

// --- Add Coach ---
app.get("/addcoach", isLoggedIn, (req, res) => res.render("addCoach.ejs"));

app.post("/addcoach", isLoggedIn, upload.single("coachImage"), async (req, res) => {
  try {
    let coachImageUrl = "/uploads/photo2.jpg";
    if(req.file){
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "coaches" },
          (err, result) => err ? reject(err) : resolve(result)
        );
        stream.end(req.file.buffer);
      });
      coachImageUrl = result.secure_url;
    }

    const { name, experience, team, sport } = req.body;
    const newCoach = new Coach({ coachImage: coachImageUrl, name, experience, team, sport, owner: req.user._id });
    await newCoach.save();
    req.flash("success", "Coach added successfully");
    res.redirect("/home");
  } catch(err) {
    console.error(err);
    req.flash("error", "Error saving coach");
    res.redirect("/addcoach");
  }
});

// --- Edit Coach ---
app.get("/editcoach/:id", async (req,res) => {
  try {
    const { id } = req.params;
    const coach = await Coach.findById(id).populate("owner");
    if(!coach){
      req.flash("error","Coach not found");
      return res.redirect("/home");
    }
    res.render("editcoach.ejs",{ coach });
  } catch(err) {
    console.error(err);
    req.flash("error","Something went wrong");
    res.redirect("/home");
  }
});

app.post("/editcoach/:id", upload.single("coachImage"), async (req,res) => {
  try {
    const { id } = req.params;
    const { name, experience, team, sport } = req.body;
    const updateData = { name, experience, team, sport };

    if(req.file){
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "coaches" },
          (err, result) => err ? reject(err) : resolve(result)
        );
        stream.end(req.file.buffer);
      });
      updateData.coachImage = result.secure_url;
    }

    await Coach.findByIdAndUpdate(id, updateData, { new: true });
    req.flash("success","Coach updated successfully");
    res.redirect("/home");
  } catch(err){
    console.error(err);
    req.flash("error","Failed to update coach");
    res.redirect("/home");
  }
});

// --- Profile ---
app.get("/myprofile", isLoggedIn, async (req,res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render("myprofile.ejs",{ user });
  } catch(err){
    console.error(err);
    res.status(500).send("Error loading profile");
  }
});

app.get("/editprofile", isLoggedIn, async (req,res) => {
  const user = await User.findById(req.user._id);
  res.render("editprofile.ejs",{ user });
});

app.post("/editprofile", isLoggedIn, async (req,res) => {
  const { username } = req.body;
  await User.findByIdAndUpdate(req.user._id,{ username });
  req.flash("success","Profile updated successfully");
  res.redirect("/myprofile");
});

// --- Search ---
app.get("/search", isLoggedIn, async (req,res) => {
  const { q } = req.query;
  let coaches = [];
  let sport = "";
  if(q){
    const lowerQ = q.toLowerCase();
    if(lowerQ === "cricket") coaches = await Coach.find({ sport: "cricket" });
    else if(lowerQ === "football") coaches = await Coach.find({ sport: "football" });
    else coaches = await Coach.find({ name: { $regex: q, $options: "i" } });
  }
  res.render("search.ejs",{ coaches, sport, q });
});

// --- Appointments ---
app.get("/appointment/:id", async (req,res) => {
  const coach = await Coach.findById(req.params.id);
  if(!coach){
    req.flash("error","Coach not found");
    return res.redirect("/home");
  }
  res.render("Appointment",{ coach });
});

app.post("/appointment", isLoggedIn, async (req,res) => {
  try {
    const { name,email,phone,date,time,reason,coachId } = req.body;
    const newAppointment = new Appointment({
      name,email,phone,date,time,reason,
      coach: coachId,
      user: req.user._id,
      status: "pending"
    });
    await newAppointment.save();
    req.flash("success","Your appointment request has been sent successfully. Wait for acceptance!");
    res.redirect("/home");
  } catch(err){
    console.error(err);
    res.status(500).send("Error saving appointment");
  }
});

// --- My Appointments / Requests ---
app.get("/myappointments", isLoggedIn, async (req,res) => {
  const coach = await Coach.findOne({ owner: req.user._id });
  if(!coach){
    req.flash("error","You are not registered as a coach yet.");
    return res.redirect("/home");
  }
  const appointments = await Appointment.find({ coach: coach._id });
  res.render("myappointment.ejs",{ appointments });
});

app.get("/myrequest", isLoggedIn, async (req,res) => {
  const appointments = await Appointment.find({ user: req.user._id }).populate("coach");
  res.render("myrequest",{ appointments });
});

app.post("/accept/:id", async (req,res) => {
  const appointmentId = req.params.id;
  const updated = await Appointment.findByIdAndUpdate(appointmentId,{ status:"accepted"},{ new:true });
  if(!updated) return res.status(404).json({ message:"Appointment not found" });
  res.json({ message:"Appointment accepted!", appointment: updated });
});

// --- Video Calls ---
io.on("connection",(socket)=>{
  console.log("User connected");

  socket.on("ready",({ appointmentId })=>{
    socket.join(appointmentId);
  });

  socket.on("offer",({ appointmentId, offer })=>{
    socket.to(appointmentId).emit("offer",{ offer });
  });

  socket.on("answer",({ appointmentId, answer })=>{
    socket.to(appointmentId).emit("answer",{ answer });
  });

  socket.on("ice-candidate",({ appointmentId, candidate })=>{
    socket.to(appointmentId).emit("ice-candidate",{ candidate });
  });

  socket.on("disconnect",()=>console.log("User disconnected"));
});

app.get("/videocall/:id", isLoggedIn, async (req,res)=>{
  try {
    const appointment = await Appointment.findById(req.params.id).populate("coach");
    if(!appointment){
      req.flash("error","Appointment not found");
      return res.redirect("/myrequest");
    }

    if(!appointment.payment || appointment.payment.status !== "success"){
      req.flash("error","Payment pending. Complete payment to join the call.");
      return res.redirect(`/pay/${appointment._id}`);
    }

    if(appointment.status !== "accepted"){
      req.flash("error","Appointment not accepted yet.");
      return res.redirect("/myrequest");
    }

    const now = new Date();
    const appointmentTime = new Date(appointment.date);
    const [hours, minutes] = appointment.time.split(":");
    appointmentTime.setHours(hours);
    appointmentTime.setMinutes(minutes);

    if(now < appointmentTime){
      req.flash("error","You can start the call only at the scheduled time.");
      return res.redirect("/myrequest");
    }

    res.render("videocalling",{ appointment });
  } catch(err){
    console.error(err);
    req.flash("error","Cannot access video call.");
    res.redirect("/myrequest");
  }
});

app.get("/coach/videocall/:id", isLoggedIn, async (req,res)=>{
  try{
    const appointment = await Appointment.findById(req.params.id).populate("coach");
    if(!appointment){
      req.flash("error","Appointment not found");
      return res.redirect("/myappointments");
    }

    if(!appointment.coach.owner.equals(req.user._id)){
      req.flash("error","You are not authorized to join this call");
      return res.redirect("/myappointments");
    }

    if(appointment.status !== "accepted"){
      req.flash("error","Appointment not accepted yet.");
      return res.redirect("/myappointments");
    }

    const now = new Date();
    const appointmentTime = new Date(appointment.date);
    const [hours, minutes] = appointment.time.split(":");
    appointmentTime.setHours(hours);
    appointmentTime.setMinutes(minutes);

    if(now < appointmentTime){
      req.flash("error","You can start the call only at the scheduled time.");
      return res.redirect("/myappointments");
    }

    res.render("coachVideocall",{ appointment });
  }catch(err){
    console.error(err);
    req.flash("error","Cannot access video call");
    res.redirect("/myappointments");
  }
});

// --- Payment ---
app.get("/pay/:id", async (req,res)=>{
  const { id } = req.params;
  const appointment = await Appointment.findById(id);
  if(!appointment){
    req.flash("error","Appointment not found");
    return res.redirect("/myrequest");
  }
  const amount = 499; // demo price
  res.render("payment",{ id, amount, appointment });
});

app.post("/pay/:id/complete", async (req,res)=>{
  const { id } = req.params;
  const { method } = req.body;

  const fakePayment = {
    payment_id: `FAKE_${Date.now()}`,
    booking_id: id,
    amount: 499,
    method: method || "Card",
    status: "success",
    createdAt: new Date()
  };

  const updatedAppointment = await Appointment.findByIdAndUpdate(id, { $set:{ payment: fakePayment }},{ new:true });
  if(!updatedAppointment){
    req.flash("error","Appointment not found");
    return res.redirect("/myrequest");
  }

  res.redirect(`/videocall/${id}`);
});

app.post("/pay/:id/cancel", (req,res)=>{
  const { id } = req.params;
  res.send(`Payment for ${id} cancelled (simulated).`);
});

// --- Error route ---
app.get("/err", (req,res)=>{ abcd=abcd; });

app.use((err,req,res,next)=>{
  const { statuscode=500, message="Something went wrong" } = err;
  res.status(statuscode).send(message);
});

// =================== Start Server ===================
server.listen(port,()=>console.log(`Server running on port ${port}`));
