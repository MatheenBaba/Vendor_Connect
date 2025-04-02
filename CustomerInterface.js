import React, { useState, useEffect } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./CustomerInterface.css";
import Chat from "./Chat"; // Import the Chat component

const customIcon = new L.Icon({
  iconUrl: "/marker.png",
  iconSize: [52, 52],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Component to dynamically update the map center
const UpdateCenter = ({ center }) => {
  const map = useMap();
  map.setView(center, 15);
  return null;
};

const CustomerInterface = ({ socket }) => {
  const [vendors, setVendors] = useState([]);
  const [mapCenter, setMapCenter] = useState([17.385, 78.4867]); // Default: Hyderabad, India
  const [zoom, setZoom] = useState(15);
  const [listSearchTerm, setListSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [mapSearchTerm, setMapSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [showProductsPopup, setShowProductsPopup] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedVendorIdForChat, setSelectedVendorIdForChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const customerId = localStorage.getItem("customerId") || "guestCustomerId";
  const [vendorRatings, setVendorRatings] = useState([]);
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState("");
  const [customerNames, setCustomerNames] = useState({});

  // Register the customer with the WebSocket server
  useEffect(() => {
    if (socket && customerId) {
      socket.emit("registerUser", customerId);
      console.log(`Registered userId: ${customerId}`);
    }
  }, [socket, customerId]);

  // Get current location using geolocation
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
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);

  // Fetch vendors and all products from the backend
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

  // Listen for incoming chat messages via WebSocket
  useEffect(() => {
    if (socket) {
      socket.on("receiveMessage", (newMessage) => {
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      });
      return () => {
        socket.off("receiveMessage");
      };
    }
  }, [socket]);

  // Fetch products and vendor ratings for a selected vendor
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
      const response = await axios.get(
        `http://localhost:5000/api/ratings/${vendorId}`
      );
      setVendorRatings(response.data);
      const customerNameMap = {};
      for (const rating of response.data) {
        try {
          const customer = await axios.get(
            `http://localhost:5000/api/customers/${rating.customerId}`
          );
          customerNameMap[rating.customerId] = customer.data.name;
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

  const handleRatingSubmit = async (vendorId) => {
    try {
      await axios.post(`http://localhost:5000/api/ratings`, {
        vendorId: vendorId,
        customerId: customerId,
        rating: newRating,
        review: newReview,
      });
      fetchVendorRatings(vendorId);
      setNewRating(0);
      setNewReview("");
    } catch (error) {
      console.error("Error submitting rating:", error);
    }
  };

  // Filter vendors based on search terms
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
      {/* Left Panel: Vendor List */}
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
              <strong>Business Name:</strong> {vendor.businessName} <br />
              <strong>Owner:</strong> {vendor.name} <br />
              <strong>Email:</strong> {vendor.email} <br />
              <strong>Phone:</strong> {vendor.phone} <br />
              <strong>Location:</strong> Latitude {vendor.location.coordinates[1]}, Longitude{" "}
              {vendor.location.coordinates[0]}
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

      {/* Right Panel: Map Section */}
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {mapFilteredVendors.map((vendor) => (
            <Marker
              key={vendor._id}
              position={[
                vendor.location.coordinates[1],
                vendor.location.coordinates[0],
              ]}
              icon={customIcon}
            >
              <Popup>
                <strong>{vendor.businessName}</strong> <br />
                Owner: {vendor.name} <br />
                Email: {vendor.email} <br />
                Phone: {vendor.phone} <br />
                <button
                  onClick={() => {
                    setSelectedVendor(vendor);
                    fetchVendorProducts(vendor._id);
                  }}
                  className="view-products-button"
                >
                  View Products
                </button>
                <button
                  onClick={() => setSelectedVendorIdForChat(vendor._id)}
                  className="chat-button"
                >
                  Chat with Vendor
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Products Popup Modal */}
      {showProductsPopup && (
        <div className="products-popup">
          <h2 className="popup-header">
            Menu for {selectedVendor?.businessName}
          </h2>
          <div className="products-grid">
            {vendorProducts.map((product) => (
              <React.Fragment key={product._id}>
                <div className="product-grid-item-left">{product.name}</div>
                <div className="product-grid-item-right">₹{product.price}</div>
              </React.Fragment>
            ))}
          </div>
          <div>
            <h4>Ratings & Reviews</h4>
            {vendorRatings.map((rating) => (
              <div key={rating._id}>
                <p>
                  <strong>{customerNames[rating.customerId]}:</strong> Rating: {rating.rating}
                </p>
                <p>Review: {rating.review}</p>
              </div>
            ))}
            <div>
              <input
                type="number"
                value={newRating}
                onChange={(e) => setNewRating(e.target.value)}
                placeholder="Rating (1-5)"
              />
              <textarea
                value={newReview}
                onChange={(e) => setNewReview(e.target.value)}
                placeholder="Review"
              />
              <button onClick={() => handleRatingSubmit(selectedVendor._id)}>
                Submit Rating
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              setShowProductsPopup(false);
              setVendorRatings([]);
            }}
            className="close-button"
          >
            Close
          </button>
        </div>
      )}

      {/* Chat Modal */}
      {selectedVendorIdForChat && (
        <div className="chat-modal">
          <Chat
            socket={socket}
            senderId={customerId}
            receiverId={selectedVendorIdForChat}
          />
          <button
            className="close-button"
            onClick={() => setSelectedVendorIdForChat(null)}
          >
            Close Chat
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerInterface;
