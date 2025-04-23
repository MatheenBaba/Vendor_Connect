import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./VendorInterface.css";
import Chat from "./Chat";

const VendorInterface = ({ socket }) => {
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", image: null });
  const [errorMessage, setErrorMessage] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [localVendorId, setLocalVendorId] = useState(null);

  // Advanced Chat States for individual customer chats
  const [openChats, setOpenChats] = useState({});
  const [chatHistories, setChatHistories] = useState({});

  // Gemini AI Chatbot States
  const [chatbotMessages, setChatbotMessages] = useState([]);
  const [chatbotUserInput, setChatbotUserInput] = useState("");

  // States for vendor profile and UPI scanner images
  const [profilePhoto, setProfilePhoto] = useState(null); // holds preview URL or uploaded URL
  const profileInputRef = useRef(null);
  const [upiScannerImage, setUpiScannerImage] = useState(null);
  const upiInputRef = useRef(null);
  const [showUPIScanner, setShowUPIScanner] = useState(false);

  const navigate = useNavigate();

  // On mount: fetch vendor details, products, and customer list
  useEffect(() => {
    const vendorId = localStorage.getItem("vendorId");
    if (!vendorId) {
      navigate("/vendor-register");
      return;
    }
    setLocalVendorId(vendorId);

    if (socket) {
      socket.emit("registerUser", vendorId);
      console.log(`🔗 Registered vendor socket for ID: ${vendorId}`);
    }

    // Fetch vendor info
    axios
      .get(`http://localhost:5000/api/vendor/${vendorId}`)
      .then((res) => {
        setVendor(res.data);
        if (res.data.profilePhotoUrl) {
          setProfilePhoto(res.data.profilePhotoUrl);
        }
        if (res.data.upiScannerUrl) {
          setUpiScannerImage(res.data.upiScannerUrl);
        }
      })
      .catch((err) => console.error("Error fetching vendor:", err));

    // Fetch products
    axios
      .get(`http://localhost:5000/api/products/${vendorId}`)
      .then((res) => setProducts(res.data))
      .catch((err) => console.error("Error fetching products:", err));

    // Fetch customers who have messaged (for chat)
    axios
      .get(`http://localhost:5000/api/customers-by-messages/${vendorId}`)
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Error fetching customers:", err));
  }, [socket, navigate]);

  // Update vendor location periodically
  useEffect(() => {
    if (vendor) {
      const updateLocation = () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              axios
                .put(`http://localhost:5000/api/vendor-location/${vendor._id}`, {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                })
                .then((res) => console.log("Location updated:", res.data))
                .catch((err) => console.error("Error updating location:", err));
            },
            (error) => console.error("Error getting current position:", error)
          );
        }
      };
      updateLocation();
      const interval = setInterval(updateLocation, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [vendor]);

  // Handle product file input and preview
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewProduct({ ...newProduct, image: e.target.files[0] });
      const reader = new FileReader();
      reader.onload = (event) => setPreviewImage(event.target.result);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Handle vendor profile photo change and upload
  const handleProfilePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => setProfilePhoto(event.target.result);
      reader.readAsDataURL(file);

      const vendorId = localStorage.getItem("vendorId");
      const formData = new FormData();
      formData.append("vendorId", vendorId);
      formData.append("profilePhoto", file);
      axios
        .post("http://localhost:5000/api/vendor/profile-photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((res) => {
          console.log("Profile photo uploaded:", res.data);
        })
        .catch((err) => {
          console.error("Error uploading profile photo:", err);
        });
    }
  };

  // Remove vendor profile photo
  const handleRemoveProfilePhoto = () => {
    const vendorId = localStorage.getItem("vendorId");
    axios
      .delete(`http://localhost:5000/api/vendor/profile-photo/${vendorId}`)
      .then((res) => {
        console.log("Profile photo removed:", res.data);
        setProfilePhoto(null);
      })
      .catch((err) => console.error("Error removing profile photo:", err));
  };

  // Show UPI scanner modal
  const handleUPIScan = () => {
    setShowUPIScanner(true);
  };

  // Handle UPI scanner image change and upload
  const handleUPIScannerChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => setUpiScannerImage(event.target.result);
      reader.readAsDataURL(file);

      const vendorId = localStorage.getItem("vendorId");
      const formData = new FormData();
      formData.append("vendorId", vendorId);
      formData.append("upiScanner", file);
      axios
        .post("http://localhost:5000/api/vendor/upi-scanner", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((res) => {
          console.log("UPI scanner image uploaded:", res.data);
        })
        .catch((err) => {
          console.error("Error uploading UPI scanner image:", err);
        });
    }
  };

  // Remove UPI scanner image
  const handleRemoveUPIScanner = () => {
    const vendorId = localStorage.getItem("vendorId");
    axios
      .delete(`http://localhost:5000/api/vendor/upi-scanner/${vendorId}`)
      .then((res) => {
        console.log("UPI scanner image removed:", res.data);
        setUpiScannerImage(null);
      })
      .catch((err) => console.error("Error removing UPI scanner image:", err));
  };

  // Add a new product
  const addProduct = async () => {
    setErrorMessage("");
    const vendorId = localStorage.getItem("vendorId");
    const priceNumber = parseFloat(newProduct.price);
    if (isNaN(priceNumber) || priceNumber < 0) {
      setErrorMessage("Error: Price must not be less than zero.");
      return;
    }
    // Check if duplicate product name
    const duplicate = products.find(
      (p) => p.name.trim().toLowerCase() === newProduct.name.trim().toLowerCase()
    );
    if (duplicate) {
      setErrorMessage("Error: A product with this name already exists.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("vendorId", vendorId);
      formData.append("name", newProduct.name);
      formData.append("price", priceNumber);
      if (newProduct.image) {
        formData.append("image", newProduct.image);
      }
      const response = await axios.post("http://localhost:5000/api/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProducts((prev) => [...prev, response.data.product]);
      setNewProduct({ name: "", price: "", image: null });
      setPreviewImage(null);
    } catch (err) {
      console.error("Error adding product:", err);
      setErrorMessage("Error adding product. Please try again.");
    }
  };

  // Delete a product
  const deleteProduct = async (productId) => {
    try {
      await axios.delete(`http://localhost:5000/api/products/${productId}`);
      setProducts((prev) => prev.filter((p) => p._id !== productId));
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  // ----- Advanced Chat Functions -----
  const fetchChatHistory = async (customerId) => {
    const vendorId = localStorage.getItem("vendorId");
    try {
      const response = await fetch(
        `http://localhost:5000/api/chats?senderId=${vendorId}&receiverId=${customerId}`
      );
      const data = await response.json();
      setChatHistories((prev) => ({ ...prev, [customerId]: data }));
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
    }
  };

  const handleOpenChat = (customerId) => {
    setOpenChats((prev) => ({ ...prev, [customerId]: true }));
    if (!chatHistories[customerId]) {
      fetchChatHistory(customerId);
    }
  };

  const handleCloseChat = (customerId) => {
    setOpenChats((prev) => {
      const newState = { ...prev };
      delete newState[customerId];
      return newState;
    });
  };

  const handleSendMessage = (customerId, newMsgContent) => {
    const vendorId = localStorage.getItem("vendorId");
    const newMessage = {
      senderId: vendorId,
      receiverId: customerId,
      message: newMsgContent,
    };
    setChatHistories((prev) => ({
      ...prev,
      [customerId]: [...(prev[customerId] || []), newMessage],
    }));
    if (socket) {
      socket.emit("sendMessage", newMessage);
    }
  };

  const handleReceiveMessage = (newMessage) => {
    const vendorId = localStorage.getItem("vendorId");
    if (newMessage.receiverId === vendorId && newMessage.senderId) {
      setChatHistories((prev) => ({
        ...prev,
        [newMessage.senderId]: [...(prev[newMessage.senderId] || []), newMessage],
      }));
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on("receiveMessage", handleReceiveMessage);
      return () => {
        socket.off("receiveMessage", handleReceiveMessage);
      };
    }
  }, [socket]);

  // ----- Gemini AI Chatbot Functions -----
  // inside VendorInterface.js (or wherever your chatbot lives)

const handleChatbotInputChange = (e) => {
  setChatbotUserInput(e.target.value);
};

const handleChatbotSubmit = async (e) => {
  e.preventDefault();
  const question = chatbotUserInput.trim();
  if (!question) return;

  // show the user’s own question in the chat UI
  setChatbotMessages((prev) => [
    ...prev,
    { text: question, sender: "user" },
  ]);
  setChatbotUserInput("");

  try {
    // grab the current vendor’s ID from localStorage (set at login)
    const vendorId = localStorage.getItem("vendorId");
    if (!vendorId) throw new Error("Vendor not logged in");

    // send only the prompt + vendorId
    const { data } = await axios.post(
      "http://localhost:5000/api/gemini",
      { prompt: question, vendorId }
    );

    setChatbotMessages((prev) => [
      ...prev,
      { text: data.response, sender: "bot" },
    ]);
  } catch (err) {
    console.error("Gemini error:", err);
    setChatbotMessages((prev) => [
      ...prev,
      { text: "Error getting AI response", sender: "bot" },
    ]);
  }
};

  return (
    <div className="vendor-container">
      {/* Profile & UPI Scanner Section */}
      <div
        className="vendor-profile-section"
        style={{ marginBottom: "20px", display: "flex", justifyContent: "space-around", alignItems: "center" }}
      >
        {/* Profile Photo Upload / Remove */}
        <div className="profile-photo-upload" style={{ textAlign: "center" }}>
          {profilePhoto ? (
            <div style={{ position: "relative" }}>
              <img
                src={profilePhoto}
                alt="Vendor Profile"
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
              <button
                onClick={handleRemoveProfilePhoto}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  backgroundColor: "red",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>
          ) : (
            <button
              onClick={() => profileInputRef.current && profileInputRef.current.click()}
              style={{ padding: "5px 10px", fontSize: "14px", cursor: "pointer" }}
            >
              Upload Photo
            </button>
          )}
          <input
            type="file"
            accept="image/*"
            ref={profileInputRef}
            style={{ display: "none" }}
            onChange={handleProfilePhotoChange}
          />
        </div>

        {/* UPI Scanner Upload / Remove */}
        <div className="upi-scanner" style={{ textAlign: "center" }}>
          {upiScannerImage ? (
            <div style={{ position: "relative" }}>
              <img
                src={upiScannerImage}
                alt="UPI Scanner"
                style={{ width: "100px", height: "100px", borderRadius: "8px", objectFit: "cover" }}
              />
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={() => setShowUPIScanner(true)}
                  style={{ padding: "5px 10px", marginRight: "5px", cursor: "pointer" }}
                >
                  View UPI
                </button>
                <button
                  onClick={handleRemoveUPIScanner}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: "red",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => upiInputRef.current && upiInputRef.current.click()}
              style={{ padding: "10px 20px", fontSize: "14px", cursor: "pointer" }}
            >
              Add UPI Scanner
            </button>
          )}
          <input
            type="file"
            accept="image/*"
            ref={upiInputRef}
            style={{ display: "none" }}
            onChange={handleUPIScannerChange}
          />
        </div>
      </div>

      <h1>Welcome, {vendor?.name || "Vendor"}!</h1>

      {/* Product Management Section */}
      <h2>Manage Your Products</h2>
      <div className="product-form">
        <input
          type="text"
          placeholder="Product Name"
          value={newProduct.name}
          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={newProduct.price}
          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
        />
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {previewImage && (
          <img
            src={previewImage}
            alt="Preview"
            style={{ width: "100px", marginTop: "10px" }}
          />
        )}
        <button onClick={addProduct}>Add Product</button>
      </div>
      {errorMessage && <p style={{ color: "red", textAlign: "center" }}>{errorMessage}</p>}

      {/* Products Table */}
      <div className="table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Price (₹)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((product) => (
                <tr key={product._id}>
                  <td>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        style={{ width: "80px" }}
                      />
                    ) : (
                      "No Image"
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>₹{product.price}</td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => deleteProduct(product._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>
                  No products available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Chat Section */}
      <h2>Chat with Customers</h2>
      <ul className="customer-list">
        {customers.length > 0 ? (
          customers.map((customer) => (
            <li key={customer._id} className="customer-item">
              <span>
                {customer.name} ({customer.email})
              </span>
              <button onClick={() => handleOpenChat(customer._id)}>Chat</button>
            </li>
          ))
        ) : (
          <li>No customers available.</li>
        )}
      </ul>

      <div className="chat-modals-container">
        {Object.keys(openChats).map((customerId) => (
          <div key={customerId} className="chat-modal">
            <Chat
              socket={socket}
              senderId={localVendorId}
              receiverId={customerId}
              messages={chatHistories[customerId] || []}
              onSendMessage={(msg) => handleSendMessage(customerId, msg)}
            />
            <button onClick={() => handleCloseChat(customerId)}>Close Chat</button>
          </div>
        ))}
      </div>

      {/* Gemini AI Chatbot Section */}
      <h2>🤖 AI Chatbot</h2>
      <form onSubmit={handleChatbotSubmit}>
        <input
          value={chatbotUserInput}
          onChange={handleChatbotInputChange}
          placeholder="Ask business insights..."
        />
        <button type="submit">Send</button>
      </form>
      <div className="chatbot-messages">
        {chatbotMessages.map((m, i) => (
          <div key={i} className={`message ${m.sender}`}>
            {m.text}
          </div>
        ))}
      </div>

      {/* Sales & Expenses Button */}
      <button
        onClick={() => navigate("/sales-expense")}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "crimson",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        View Sales & Expenses
      </button>

      {/* UPI Scanner Modal for enlarged image view */}
      {showUPIScanner && (
        <div
          className="upi-scanner-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "300px",
              background: "#fff",
              padding: "20px",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            <h3>UPI Scanner</h3>
            {upiScannerImage ? (
              <img
                src={upiScannerImage}
                alt="Enlarged UPI Scanner"
                style={{ width: "100%", maxWidth: "300px" }}
              />
            ) : (
              <p>No UPI scanner image uploaded.</p>
            )}
            <button
              onClick={() => setShowUPIScanner(false)}
              style={{ padding: "10px", marginTop: "10px", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorInterface;
