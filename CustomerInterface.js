import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./CustomerInterface.css";
import Chat from "./Chat"; // Chat component

// Custom icon for map markers (and fallback for vendor images)
const customIcon = new L.Icon({
  iconUrl: "/marker.png", // Make sure marker.png is in your public/ folder
  iconSize: [52, 52],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Component to update the map center dynamically (zoom=15)
const UpdateCenter = ({ center }) => {
  const map = useMap();
  map.setView(center, 15);
  return null;
};

const CustomerInterface = ({ socket }) => {
  // State variables
  const [vendors, setVendors] = useState([]);
  const [mapCenter, setMapCenter] = useState([17.385, 78.4867]); // Default: Hyderabad
  const [zoom] = useState(15);
  const [listSearchTerm, setListSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [mapSearchTerm, setMapSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [showProductsPopup, setShowProductsPopup] = useState(false);
  const [allProducts, setAllProducts] = useState([]);

  // Chat & Rating States
  const [selectedVendorIdForChat, setSelectedVendorIdForChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const customerId = localStorage.getItem("customerId") || "guestCustomerId";
  const [vendorRatings, setVendorRatings] = useState([]);
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState("");
  const [customerNames, setCustomerNames] = useState({});

  // Customer profile photo state (for logged‑in customers only)
  const [customerProfile, setCustomerProfile] = useState(null);
  const customerInputRef = useRef(null);

  // Render star rating
  const renderStars = (rating) => {
    const fullStars = "★".repeat(rating);
    const emptyStars = "☆".repeat(5 - rating);
    return fullStars + emptyStars;
  };

  // Overall average rating
  const overallRating =
    vendorRatings.length > 0
      ? vendorRatings.reduce((acc, curr) => acc + parseInt(curr.rating, 10), 0) /
        vendorRatings.length
      : 0;

  // Sorted reviews (by descending rating)
  const sortedReviews = [...vendorRatings].sort((a, b) => b.rating - a.rating);

  // Register WebSocket user
  useEffect(() => {
    if (socket && customerId) {
      socket.emit("registerUser", customerId);
      console.log(`Registered userId: ${customerId}`);
    }
  }, [socket, customerId]);

  // Get user location to center the map
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
        },
        (error) => console.error("Error getting location:", error),
        { enableHighAccuracy: true }
      );
    } else {
      console.error("Geolocation not supported by this browser.");
    }
  }, []);

  // Fetch vendors and all products on component mount
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/vendors");
        setVendors(response.data);
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    };
    const fetchAllProducts = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/products");
        setAllProducts(response.data);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchVendors();
    fetchAllProducts();
  }, []);

  // Fetch customer profile photo for logged-in customer (if not a guest)
  useEffect(() => {
    if (customerId !== "guestCustomerId") {
      axios
        .get(`http://localhost:5000/api/customers/${customerId}`)
        .then((res) => setCustomerProfile(res.data))
        .catch((err) => console.error("Error fetching customer profile:", err));
    }
  }, [customerId]);

  // Listen for incoming chat messages
  useEffect(() => {
    if (socket) {
      socket.on("receiveMessage", (newMessage) => {
        setMessages((prev) => [...prev, newMessage]);
      });
      return () => {
        socket.off("receiveMessage");
      };
    }
  }, [socket]);

  // Fetch vendor products & ratings for popup display
  const fetchVendorProducts = async (vendorId) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/products/vendor/${vendorId}`
      );
      setVendorProducts(response.data);
      setShowProductsPopup(true);
      fetchVendorRatings(vendorId);
    } catch (error) {
      console.error("Error fetching products:", error);
      setVendorProducts([]);
      setShowProductsPopup(false);
      setVendorRatings([]);
    }
  };

  const fetchVendorRatings = async (vendorId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/ratings/${vendorId}`);
      setVendorRatings(response.data);
      const customerNameMap = {};
      for (const rating of response.data) {
        try {
          const customerResp = await axios.get(
            `http://localhost:5000/api/customers/${rating.customerId}`
          );
          customerNameMap[rating.customerId] = customerResp.data.name;
        } catch (customerError) {
          console.error("Error fetching customer name:", customerError);
          customerNameMap[rating.customerId] = "Unknown Customer";
        }
      }
      setCustomerNames(customerNameMap);
    } catch (error) {
      console.error("Error fetching ratings:", error);
      setVendorRatings([]);
    }
  };

  // Submit rating for a vendor
  const handleRatingSubmit = async (vendorId) => {
    const ratingValue = parseInt(newRating, 10);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      alert("Rating must be between 1 and 5.");
      return;
    }
    try {
      await axios.post("http://localhost:5000/api/ratings", {
        vendorId,
        customerId,
        rating: ratingValue,
        review: newReview,
      });
      fetchVendorRatings(vendorId);
      setNewRating(0);
      setNewReview("");
    } catch (error) {
      if (
        error.response &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.includes("only write review for this vendor twice")
      ) {
        alert("Maximum review submitted.");
      } else {
        alert(error.response?.data?.error || "Error submitting rating.");
      }
    }
  };

  // Handle customer profile photo upload
  const handleCustomerPhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) =>
        setCustomerProfile((prev) => ({ ...prev, profilePhotoUrl: event.target.result }));
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append("customerId", customerId);
      formData.append("profilePhoto", file);
      axios
        .post("http://localhost:5000/api/customer/profile-photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((res) => {
          console.log("Customer photo uploaded:", res.data);
        })
        .catch((err) => {
          console.error("Error uploading customer photo:", err);
        });
    }
  };

  // Handle remove customer profile photo
  const handleRemoveCustomerPhoto = () => {
    axios
      .delete(`http://localhost:5000/api/customer/profile-photo/${customerId}`)
      .then((res) => {
        console.log("Customer photo removed:", res.data);
        setCustomerProfile((prev) => ({ ...prev, profilePhotoUrl: null }));
      })
      .catch((err) => console.error("Error removing customer photo:", err));
  };

  // Vendor filtering based on search terms
  const filteredVendors = productSearchTerm
    ? vendors.filter((vendor) =>
        allProducts.some(
          (product) =>
            product.vendorId === vendor._id &&
            product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
        )
      )
    : vendors.filter(
        (vendor) =>
          vendor.businessName.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
          vendor.name.toLowerCase().includes(listSearchTerm.toLowerCase())
      );

  const mapFilteredVendors = filteredVendors.filter(
    (vendor) =>
      vendor.businessName.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
      vendor.name.toLowerCase().includes(mapSearchTerm.toLowerCase())
  );

  return (
    <div className="main-container">
      {/* --- Customer Profile Photo Section --- */}
      <div className="customer-profile-section" style={{ marginBottom: "20px", textAlign: "center" }}>
        {customerId !== "guestCustomerId" && customerProfile && customerProfile.profilePhotoUrl ? (
          <div style={{ display: "inline-block", position: "relative" }}>
            <img
              src={customerProfile.profilePhotoUrl}
              alt="Customer Profile"
              style={{
                width: "80px", // Increased image dimensions
                height: "80px",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
            <button
              onClick={handleRemoveCustomerPhoto}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                backgroundColor: "red",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "25px",
                height: "25px",
                cursor: "pointer",
              }}
            >
              &times;
            </button>
          </div>
        ) : customerId !== "guestCustomerId" ? (
          <button onClick={() => customerInputRef.current && customerInputRef.current.click()}>
            Upload Your Photo
          </button>
        ) : null}
        <input
          type="file"
          accept="image/*"
          ref={customerInputRef}
          style={{ display: "none" }}
          onChange={handleCustomerPhotoChange}
        />
      </div>

      {/* --- Vendor List Section --- */}
      <div className="vendor-list-section">
        <h2>Vendor Dashboard</h2>
        <input
          type="text"
          placeholder="Search by business or owner name"
          value={listSearchTerm}
          onChange={(e) => setListSearchTerm(e.target.value)}
          className="input-field"
        />
        <input
          type="text"
          placeholder="Search by product name"
          value={productSearchTerm}
          onChange={(e) => setProductSearchTerm(e.target.value)}
          className="input-field"
        />
        <h3>Vendors Selling Products</h3>
        <ul className="vendor-list">
          {filteredVendors.map((vendor) => (
            <li
              key={vendor._id}
              className="vendor-item"
              onClick={() => {
                setSelectedVendor(vendor);
                fetchVendorProducts(vendor._id);
              }}
            >
              <div className="vendor-photo">
                {vendor.profilePhotoUrl ? (
                  <img src={vendor.profilePhotoUrl} alt={vendor.businessName} />
                ) : (
                  <img src="/defaultVendor.png" alt="No profile" />
                )}
              </div>
              <div className="vendor-details">
                <p><strong>Business Name:</strong> {vendor.businessName}</p>
                <p><strong>Owner:</strong> {vendor.name}</p>
                <p><strong>Email:</strong> {vendor.email}</p>
                <p><strong>Phone:</strong> {vendor.phone}</p>
                <p>
                  <strong>Location:</strong> Lat {vendor.location.coordinates[1]}, Lng {vendor.location.coordinates[0]}
                </p>
              </div>
              <button
                className="chat-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedVendorIdForChat(vendor._id);
                }}
              >
                Chat with Vendor
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* --- Map Section --- */}
      <div className="map-section">
        <div className="map-search">
          <input
            type="text"
            placeholder="Search vendors on map"
            value={mapSearchTerm}
            onChange={(e) => setMapSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>
        <MapContainer center={mapCenter} zoom={zoom} className="map-container">
          <UpdateCenter center={mapCenter} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {mapFilteredVendors.map((vendor) => (
            <Marker
              key={vendor._id}
              position={[vendor.location.coordinates[1], vendor.location.coordinates[0]]}
              icon={customIcon}
            >
              <Popup>
                <strong>{vendor.businessName}</strong> <br />
                Owner: {vendor.name} <br />
                Email: {vendor.email} <br />
                Phone: {vendor.phone} <br />
                <button
                  className="view-products-button"
                  onClick={() => {
                    setSelectedVendor(vendor);
                    fetchVendorProducts(vendor._id);
                  }}
                >
                  View Products
                </button>
                <button
                  className="chat-button"
                  onClick={() => setSelectedVendorIdForChat(vendor._id)}
                >
                  Chat with Vendor
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* --- Products Popup --- */}
      {showProductsPopup && (
        <div className="products-popup">
          <h2 className="popup-header">Products Listed by {selectedVendor?.businessName}</h2>
          <div className="products-table-container" style={{ overflowX: "auto" }}>
            <table
              className="products-table"
              style={{
                width: "100%",
                tableLayout: "fixed",
                borderCollapse: "collapse",
                border: "1px solid #ccc",
              }}
            >
              <thead>
                <tr>
                  <th style={thTdStyle}>Image</th>
                  <th style={thTdStyle}>Product Name</th>
                  <th style={thTdStyle}>Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {vendorProducts.map((product) => (
                  <tr key={product._id}>
                    <td style={thTdStyle}>
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          style={{ width: "60px", height: "60px", objectFit: "cover" }}
                        />
                      ) : (
                        <img
                          src="/marker.png"
                          alt={product.name}
                          style={{ width: "60px", height: "60px", objectFit: "cover" }}
                        />
                      )}
                    </td>
                    <td style={thTdStyle}>{product.name}</td>
                    <td style={thTdStyle}>₹{product.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- Ratings & Reviews Section --- */}
          <div className="ratings-section" style={{ marginTop: "20px" }}>
            {vendorRatings.length > 0 && (
              <div style={{ marginBottom: "15px", textAlign: "center" }}>
                <strong>Overall Rating: {overallRating.toFixed(1)}</strong>{" "}
                <span style={{ fontSize: "20px", color: "#FFD700", marginLeft: "5px" }}>
                  {renderStars(Math.round(overallRating))}
                </span>
              </div>
            )}
            <h4 style={{ textAlign: "center" }}>Ratings & Reviews</h4>
            {sortedReviews.map((rating) => (
              <div
                key={rating._id}
                className="rating-item"
                style={{
                  border: "1px solid #ddd",
                  padding: "10px",
                  borderRadius: "5px",
                  marginBottom: "10px",
                }}
              >
                <p>
                  <strong>{customerNames[rating.customerId]}: </strong>
                  <span style={{ fontSize: "18px", color: "#FFD700", marginLeft: "5px" }}>
                    {renderStars(rating.rating)}
                  </span>
                </p>
                <p style={{ marginLeft: "5px", marginTop: "5px", fontStyle: "italic" }}>
                  {rating.review}
                </p>
              </div>
            ))}

            {/* --- Rating Form --- */}
            <div
              className="rating-form"
              style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "15px" }}
            >
              <label style={{ fontWeight: "bold" }}>Add Your Rating & Review:</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="number"
                  value={newRating}
                  onChange={(e) => setNewRating(e.target.value)}
                  placeholder="1-5"
                  min="1"
                  max="5"
                  style={{ width: "60px", textAlign: "center" }}
                />
                <textarea
                  value={newReview}
                  onChange={(e) => setNewReview(e.target.value)}
                  placeholder="Write a brief review..."
                  style={{ flex: 1 }}
                ></textarea>
                <button onClick={() => handleRatingSubmit(selectedVendor._id)}>Submit</button>
              </div>
            </div>
          </div>

          <button
            className="close-button"
            style={{ marginTop: "20px" }}
            onClick={() => {
              setShowProductsPopup(false);
              setVendorRatings([]);
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* --- Chat Modal --- */}
      {selectedVendorIdForChat && (
        <div className="chat-modal">
          <Chat socket={socket} senderId={customerId} receiverId={selectedVendorIdForChat} />
          <button className="close-button" onClick={() => setSelectedVendorIdForChat(null)}>
            Close Chat
          </button>
        </div>
      )}
    </div>
  );
};

const thTdStyle = {
  border: "1px solid #ccc",
  padding: "8px",
  textAlign: "center",
};

export default CustomerInterface;
