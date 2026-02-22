//const Game = require('./models/game');
const Game = require("../modules/game/model");
require("dotenv").config();  // Load environment variables

class Database {

  static #mongoose = require("mongoose");


  constructor() {

  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  connect() {
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL environment variable is not set");
      console.error("For local MongoDB, use: mongodb://127.0.0.1:27017/chess");
      return;
    }

    // Detect if this is a local MongoDB connection
    const isLocalConnection =
      process.env.DATABASE_URL.includes('127.0.0.1') ||
      process.env.DATABASE_URL.includes('localhost') ||
      (process.env.DATABASE_URL.startsWith('mongodb://') && !process.env.DATABASE_URL.startsWith('mongodb+srv://'));

    // Detect if this is a MongoDB Atlas connection (mongodb+srv://)
    const isAtlasConnection = process.env.DATABASE_URL.startsWith('mongodb+srv://');

    const connectionOptions = {
      serverSelectionTimeoutMS: 30000, // Timeout after 30s (increased for network issues)
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      connectTimeoutMS: 30000, // Connection timeout (increased)
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Reduced from 2 to avoid connection issues
    };

    // For MongoDB Atlas (mongodb+srv://), TLS is automatically handled by the connection string
    // Only explicitly configure TLS for non-Atlas remote connections
    if (!isLocalConnection && !isAtlasConnection) {
      connectionOptions.tls = true;
      connectionOptions.tlsAllowInvalidCertificates = false;
      connectionOptions.tlsAllowInvalidHostnames = false;
      console.log("Detected remote MongoDB connection (non-Atlas) - TLS enabled");
    } else if (isAtlasConnection) {
      console.log("Detected MongoDB Atlas connection - TLS handled automatically by connection string");
    } else {
      console.log("Detected local MongoDB connection - TLS disabled");
    }

    Database.#mongoose.connect(process.env.DATABASE_URL, connectionOptions)
      .then(() => {
        console.log("db connected successfully");
      })
      .catch((error) => {
        console.error("MongoDB initial connection error:", error.message);
        console.error("Full error details:", error);
        // Don't exit - Mongoose will retry automatically
      });

    const db = Database.#mongoose.connection;

    db.on("error", (error) => {
      console.error("MongoDB connection error:", error.message);
      console.error("Full error details:", error);
      // Mongoose will automatically attempt to reconnect
    });

    db.on("disconnected", () => {
      console.warn("MongoDB disconnected. Mongoose will attempt to reconnect automatically...");
    });

    db.on("reconnected", () => {
      console.log("MongoDB reconnected successfully");
    });

    db.once("open", () => {
      console.log("db connected");
    });

    // Handle connection state
    db.on("connecting", () => {
      console.log("MongoDB connecting...");
    });

    db.on("connected", () => {
      console.log("MongoDB connected");
    });
  }

  //   connect() {
  //     //Database.#mongoose.connect('mongodb://127.0.0.1:27017/chess')
  //     Database.#mongoose.connect(process.env.DATABASE_URL)

  //       .then(async () => {
  //         console.log("db connected");
  //         //  await Game.deleteMany({})

  //       })

  //       .catch(() => {
  //         console.log("error connecting to db");
  //       });

  //   }
}

module.exports = { Database, Game };