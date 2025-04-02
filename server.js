const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

// Create Express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  methods: ["GET", "POST", "DELETE"],
}));

// Serve static files from the "uploads" folder (for product images)
app.use("/uploads", express.static("uploads"));

// ✅ MongoDB Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/vendorCustomerDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

/* ============================
   Define Schemas & Models
============================ */

// Vendor Schema
const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  businessName: { type: String, required: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
});
const Vendor = mongoose.model("Vendor", vendorSchema);

// Product Schema (with imageUrl field)
const productSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  imageUrl: { type: String }, // Stores full URL of the uploaded image
});
const Product = mongoose.model("Product", productSchema);

// Customer Schema
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
});
const Customer = mongoose.model("Customer", customerSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
  productName: { type: String, required: true },
  type: { type: String, enum: ["sale", "expense"], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});
const Transaction = mongoose.model("Transaction", transactionSchema);

// Chat Schema
const chatSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});
chatSchema.index({ timestamp: 1 }, { expireAfterSeconds: 3600 }); // Expire messages after 1 hour
const Chat = mongoose.model("Chat", chatSchema);

// Rating Schema
const ratingSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
  customerId: String,
  rating: { type: Number, min: 1, max: 5 },
  review: String,
});
const Rating = mongoose.model("Rating", ratingSchema);

/* ============================
   Multer Configuration
============================ */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Ensure this folder exists
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

/* ============================
   API Endpoints
============================ */

// Vendor Registration
app.post("/api/vendors", async (req, res) => {
  try {
    const { name, email, phone, businessName, location } = req.body;
    if (!name || !email || !phone || !businessName || !location) {
      return res.status(400).json({ error: "❌ All fields are required." });
    }
    const formattedLocation = {
      type: "Point",
      coordinates: [location.longitude, location.latitude], // [longitude, latitude]
    };
    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(400).json({ error: "❌ Email already registered." });
    }
    const newVendor = new Vendor({
      name,
      email,
      phone,
      businessName,
      location: formattedLocation,
    });
    await newVendor.save();
    res.status(201).json({ vendorId: newVendor._id, message: "✅ Vendor registered successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "❌ Failed to register vendor. Try again." });
  }
});

// Vendor Login
app.post("/api/vendor-login", async (req, res) => {
  try {
    const { email, name } = req.body;
    const vendor = await Vendor.findOne({ email: email.trim(), name: name.trim() });
    if (!vendor) {
      return res.status(404).json({ error: "❌ Vendor not found, please register." });
    }
    res.status(200).json({ message: "✅ Login successful!", vendor });
  } catch (error) {
    res.status(500).json({ error: "❌ Failed to login. Try again." });
  }
});

// Get Vendor Details
app.get("/api/vendor/:vendorId", async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.status(200).json(vendor);
  } catch (error) {
    res.status(500).json({ error: "Server error, try again" });
  }
});

// Update Vendor Location
app.put("/api/vendor-location/:vendorId", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "❌ Latitude and longitude are required." });
    }
    const updatedVendor = await Vendor.findByIdAndUpdate(
      req.params.vendorId,
      { location: { type: "Point", coordinates: [longitude, latitude] } },
      { new: true }
    );
    if (!updatedVendor) {
      return res.status(404).json({ error: "❌ Vendor not found." });
    }
    res.status(200).json({ message: "✅ Location updated successfully", vendor: updatedVendor });
  } catch (error) {
    console.error("Error updating vendor location:", error);
    res.status(500).json({ error: "❌ Server error." });
  }
});

// Customer Login
app.post("/api/customer-login", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "❌ Email and name are required." });
    }
    const customer = await Customer.findOne({ email: email.trim(), name: name.trim() });
    if (!customer) {
      return res.status(404).json({ error: "❌ Customer not found, please register." });
    }
    res.status(200).json({ message: "✅ Login successful!", customer });
  } catch (error) {
    console.error("❌ Customer Login Error:", error);
    res.status(500).json({ error: "❌ Failed to login. Try again." });
  }
});

// Customer Registration
app.post("/api/customers", async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "❌ All fields are required." });
    }
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({ error: "❌ Email already registered." });
    }
    const newCustomer = new Customer({ name, email, phone });
    await newCustomer.save();
    res.status(201).json({ message: "✅ Customer registered successfully!", customerId: newCustomer._id });
  } catch (error) {
    res.status(500).json({ error: "❌ Failed to register customer. Try again." });
  }
});

// Get All Products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "❌ Failed to fetch products." });
  }
});

// Get All Vendors
app.get("/api/vendors", async (req, res) => {
  try {
    const vendors = await Vendor.find({});
    res.json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Add Product with Image Upload
app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    const { vendorId, name, price } = req.body;
    if (!vendorId || !name || !price) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const vendorExists = await Vendor.findById(vendorId);
    if (!vendorExists) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    let imageUrl = "";
    if (req.file) {
      imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    }
    const product = new Product({
      vendorId,
      name,
      price,
      imageUrl,
    });
    await product.save();
    res.status(201).json({ message: "✅ Product added successfully!", product });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "❌ Server error, try again." });
  }
});

// Get Products for a Vendor
app.get("/api/products/:vendorId", async (req, res) => {
  try {
    const products = await Product.find({ vendorId: req.params.vendorId });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Server error, try again" });
  }
});

// Delete Product
app.delete("/api/products/:productId", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({ message: "✅ Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "❌ Server error, try again" });
  }
});

// Get Products by Vendor ID (Alternate Route)
app.get("/api/products/vendor/:vendorId", async (req, res) => {
  try {
    const products = await Product.find({ vendorId: req.params.vendorId });
    if (!products || products.length === 0) {
      return res.status(404).json({ error: "No products found for this vendor." });
    }
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products for vendor:", error);
    res.status(500).json({ error: "❌ Server error, try again." });
  }
});

// Unified Transaction Endpoint
app.post("/api/transaction", async (req, res) => {
  try {
    const { vendorId, productName, type, amount } = req.body;
    if (!vendorId || !productName || !type || amount == null) {
      return res.status(400).json({ error: "Vendor ID, product name, transaction type, and amount are required." });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: "Transaction amount must be greater than 0." });
    }
    const transaction = new Transaction({ vendorId, productName, type, amount });
    await transaction.save();
    res.status(201).json({ message: "Transaction recorded successfully!", transaction });
  } catch (error) {
    console.error("Transaction Error:", error);
    res.status(500).json({ error: "Server error while recording transaction." });
  }
});

// Get All Transactions for a Vendor
app.get("/api/transactions/vendor/:vendorId", async (req, res) => {
  try {
    const transactions = await Transaction.find({ vendorId: req.params.vendorId });
    res.status(200).json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Server error, try again." });
  }
});

// Delete All Transactions for a Vendor
app.delete("/api/transactions/vendor/:vendorId", async (req, res) => {
  try {
    const vendorIdObj = mongoose.Types.ObjectId(req.params.vendorId);
    await Transaction.deleteMany({ vendorId: vendorIdObj });
    res.status(200).json({ message: "All transactions deleted successfully." });
  } catch (error) {
    console.error("Error deleting transactions:", error);
    res.status(500).json({ error: "Server error, try again." });
  }
});

// Get Transaction Summary for a Vendor
app.get("/api/transactions/summary/:vendorId", async (req, res) => {
  try {
    const summary = await Transaction.aggregate([
      { $match: { vendorId: mongoose.Types.ObjectId(req.params.vendorId) } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]);
    const result = { sale: 0, expense: 0 };
    summary.forEach((item) => {
      result[item._id] = item.total;
    });
    const finalSummary = Object.keys(result).map((key) => ({ _id: key, total: result[key] }));
    res.status(200).json(finalSummary);
  } catch (error) {
    console.error("Error aggregating transactions:", error);
    res.status(500).json({ error: "Server error, try again." });
  }
});

// Route to Fetch Customers by Messages (for Chat)
app.get("/api/customers-by-messages/:vendorId", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const chats = await Chat.find({ receiverId: vendorId }).distinct("senderId");
    const customers = await Customer.find({ _id: { $in: chats } });
    res.status(200).json(customers);
  } catch (error) {
    console.error("Error fetching customers by messages:", error);
    res.status(500).json({ error: "Failed to fetch customers by messages." });
  }
});

// Rating Endpoints
app.get("/api/ratings/:vendorId", async (req, res) => {
  try {
    const ratings = await Rating.find({ vendorId: req.params.vendorId });
    res.json(ratings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/ratings", async (req, res) => {
  const rating = new Rating({
    vendorId: req.body.vendorId,
    customerId: req.body.customerId,
    rating: req.body.rating,
    review: req.body.review,
  });
  try {
    const newRating = await rating.save();
    res.status(201).json(newRating);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get Customer by ID
app.get("/api/customers/:customerId", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ============================
   WebSocket Setup with Socket.IO
============================ */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Register user with their user ID
  socket.on("registerUser", (userId) => {
    Object.keys(userSocketMap).forEach((key) => {
      if (key === userId) {
        delete userSocketMap[key];
      }
    });
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  // Listen for new messages
  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, message } = data;
      const newChat = new Chat({ senderId, receiverId, message });
      await newChat.save();
      const receiverSocketId = userSocketMap[receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receiveMessage", newChat);
      } else {
        console.log(`User ${receiverId} is not connected.`);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    Object.keys(userSocketMap).forEach((userId) => {
      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        console.log(`User ${userId} disconnected`);
      }
    });
  });
});

/* ============================
   Start the Server
============================ */
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});
