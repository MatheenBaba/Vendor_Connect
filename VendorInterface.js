import React, { useState, useEffect } from "react";
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
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const vendorId = localStorage.getItem("vendorId");
    if (!vendorId) {
      navigate("/vendor-register");
      return;
    }

    // Register vendor with WebSocket
    if (socket && vendorId) {
      socket.emit("registerUser", vendorId);
      console.log(`Registered vendorId: ${vendorId}`);
    }

    // Fetch vendor details
    axios
      .get(`http://localhost:5000/api/vendor/${vendorId}`)
      .then((res) => setVendor(res.data))
      .catch((err) => console.error("Error fetching vendor:", err));

    // Fetch vendor's products
    axios
      .get(`http://localhost:5000/api/products/${vendorId}`)
      .then((res) => setProducts(res.data))
      .catch((err) => console.error("Error fetching products:", err));

    // Fetch customers for chat
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

  // Handle file input and image preview
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewProduct({ ...newProduct, image: e.target.files[0] });
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target.result);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Add product with image upload
  const addProduct = async () => {
    setErrorMessage("");
    const vendorId = localStorage.getItem("vendorId");
    const priceNumber = parseFloat(newProduct.price);
    if (isNaN(priceNumber) || priceNumber < 0) {
      setErrorMessage("Error: Price must not be less than zero.");
      return;
    }
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
      // NOTE: Ensure your server sets the full image URL (e.g., http://localhost:5000/uploads/filename)
      setProducts((prev) => [...prev, response.data.product]);
      setNewProduct({ name: "", price: "", image: null });
      setPreviewImage(null);
    } catch (error) {
      console.error("Error adding product:", error);
      setErrorMessage("Error adding product. Please try again.");
    }
  };

  const deleteProduct = async (productId) => {
    try {
      await axios.delete(`http://localhost:5000/api/products/${productId}`);
      setProducts(products.filter((p) => p._id !== productId));
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  return (
    <div className="vendor-container">
      <h1>Welcome, {vendor?.name || "Vendor"}!</h1>
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
          <img src={previewImage} alt="Preview" style={{ width: "100px", marginTop: "10px" }} />
        )}
        <button onClick={addProduct}>Add Product</button>
      </div>
      {errorMessage && <p style={{ color: "red", textAlign: "center" }}>{errorMessage}</p>}
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
                      <img src={product.imageUrl} alt={product.name} style={{ width: "80px" }} />
                    ) : (
                      "No Image"
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>₹{product.price}</td>
                  <td>
                    <button className="delete-btn" onClick={() => deleteProduct(product._id)}>
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
      <h2>Chat with Customers</h2>
      <ul className="customer-list">
        {customers.length > 0 ? (
          customers.map((customer) => (
            <li key={customer._id} className="customer-item">
              <span>
                {customer.name} ({customer.email})
              </span>
              <button onClick={() => setSelectedCustomerId(customer._id)}>Chat</button>
            </li>
          ))
        ) : (
          <li>No customers available.</li>
        )}
      </ul>
      {selectedCustomerId && (
        <div className="chat-modal">
          <Chat
            socket={socket}
            senderId={localStorage.getItem("vendorId")}
            receiverId={selectedCustomerId}
          />
          <button onClick={() => setSelectedCustomerId(null)}>Close Chat</button>
        </div>
      )}
      {/* Button to navigate to Sales & Expense Form */}
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
    </div>
  );
};

export default VendorInterface;
