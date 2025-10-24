// seedCoaches.js
const mongoose = require("mongoose");
const Coach = require("./models/Coach");
// const FootballCoach = require("./models/FootballCoach");

async function main() {
  // Connect to MongoDB
  await mongoose.connect("mongodb://127.0.0.1:27017/newcode");
  console.log("Connected to database");

  // Clear existing data
  // await Coach.deleteMany();
  // await FootballCoach.deleteMany();

  // Sample Cricket Coaches
  const Coaches = [
    // { name: "Rahul Dravid", experience: 15, team: "India", sport:"Cricket" },
    // { name: "Gary Kirsten", experience: 12, team: "India",sport:"Cricket" },
    // { name: "Trevor Bayliss", experience: 18, team: "England",sport:"Cricket" }
  ];

  // Sample Football Coaches
  // const footballCoaches = [
  //   { name: "Pep Guardiola", experience: 20, team: "Manchester City" },
  //   { name: "Jurgen Klopp", experience: 18, team: "Liverpool" },
  //   { name: "Carlo Ancelotti", experience: 25, team: "Real Madrid" }
  // ];

  // Insert sample data
  await Coach.insertMany(Coaches);
  
  // await FootballCoach.insertMany(footballCoaches);
  

  console.log("Sample coaches added successfully!");
  mongoose.connection.close();
}

main().catch(err => console.error(err));
