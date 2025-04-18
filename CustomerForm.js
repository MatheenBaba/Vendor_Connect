import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import background from "./bg1.jpg"; // Adjust path if necessary

const CustomerForm = () => {
  // State for customer data
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomer((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!customer.name || !customer.email || !customer.phone) {
      setMessage("❌ Please fill all fields.");
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/customers", customer);
      setMessage("✅ Customer registered successfully!");
      setCustomer({ name: "", email: "", phone: "" });
      setTimeout(() => navigate("/customer-login"), 1500);
    } catch (error) {
      if (error.response?.data?.error) {
        setMessage("❌ " + error.response.data.error);
      } else {
        setMessage("❌ Failed to register customer.");
      }
    }
  };

  return (
    <div
      style={{
        backgroundImage: `url(${background})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",

        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Card Container */}
      <div
        style={{
          width: "90%",
          maxWidth: "450px",
          backgroundColor: "#fff",
          padding: "30px",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#333" }}>
          Customer Registration
        </h2>

        {/* Success/Error Message */}
        {message && (
          <p
            style={{
              textAlign: "center",
              color: message.startsWith("✅") ? "green" : "red",
              marginBottom: "15px",
            }}
          >
            {message}
          </p>
        )}

        {/* Registration Form */}
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column" }}>
          <input
            type="text"
            name="name"
            placeholder="Name"
            value={customer.name}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={customer.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="phone"
            placeholder="Phone"
            value={customer.phone}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          {/* Register Button */}
          <button
            type="submit"
            style={{ ...buttonStyle, backgroundColor: "crimson", color: "#fff" }}
          >
            Register
          </button>
        </form>

        {/* Login Button */}
        <button
          onClick={() => navigate("/customer-login")}
          style={{
            ...buttonStyle,
            backgroundColor: "#6c757d",
            color: "#fff",
            marginTop: "10px",
          }}
        >
          Already a Customer? Login Here
        </button>
      </div>
    </div>
  );
};

/* Reusable styling for inputs and buttons */
const inputStyle = {
  marginBottom: "10px",
  padding: "12px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  fontSize: "14px",
  width: "100%",
};

const buttonStyle = {
  padding: "12px 15px",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px",
  marginBottom: "10px",
  width: "100%",
};

export default CustomerForm;
