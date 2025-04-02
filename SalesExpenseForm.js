// SalesExpenseForm.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const SalesExpenseForm = ({ vendorId, onTransactionRecorded }) => {
  const [transaction, setTransaction] = useState({
    type: "sale",
    productName: "",
    amount: "",
  });
  const [message, setMessage] = useState("");
  const [vendorProducts, setVendorProducts] = useState([]);

  // Fetch vendor products from the backend
  useEffect(() => {
    const fetchProducts = async () => {
      if (!vendorId) return;
      try {
        const response = await axios.get(`http://localhost:5000/api/products/vendor/${vendorId}`);
        setVendorProducts(response.data);
      } catch (error) {
        console.error("Error fetching vendor products:", error);
      }
    };
    fetchProducts();
  }, [vendorId]);

  const handleChange = (e) => {
    setTransaction({ ...transaction, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(transaction.amount);
    // Validate that the amount is greater than 0
    if (amt <= 0) {
      setMessage("Error: Amount must be greater than 0.");
      return;
    }
    if (!transaction.productName) {
      setMessage("Error: Please select a product.");
      return;
    }
    try {
      const response = await axios.post("http://localhost:5000/api/transaction", {
        vendorId,
        productName: transaction.productName,
        type: transaction.type,
        amount: amt,
      });
      setMessage(response.data.message);
      setTransaction({ type: "sale", productName: "", amount: "" });
      if (onTransactionRecorded) onTransactionRecorded();
    } catch (error) {
      setMessage("Error recording transaction.");
      console.error("Transaction error:", error);
    }
  };

  // New function: Delete All Transactions for this vendor
  const deleteAllTransactions = async () => {
    try {
      await axios.delete(`http://localhost:5000/api/transactions/vendor/${vendorId}`);
      setMessage("All transactions deleted successfully!");
      // Optionally, refresh the transaction list
      if (onTransactionRecorded) onTransactionRecorded();
    } catch (error) {
      console.error("Error deleting transactions:", error);
      setMessage("Error deleting transactions.");
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Add Sale / Expense</h3>
      {message && <p style={styles.message}>{message}</p>}
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Type:
          <select
            name="type"
            value={transaction.type}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="sale">Sale</option>
            <option value="expense">Expense</option>
          </select>
        </label>
        <label style={styles.label}>
          Product:
          <select
            name="productName"
            value={transaction.productName}
            onChange={handleChange}
            required
            style={styles.select}
          >
            <option value="">-- Select Product --</option>
            {vendorProducts.map((prod) => (
              <option key={prod._id} value={prod.name}>
                {prod.name}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Amount:
          <input
            type="number"
            name="amount"
            value={transaction.amount}
            onChange={handleChange}
            placeholder="Enter amount"
            required
            style={styles.input}
          />
        </label>
        <button type="submit" style={styles.button}>
          Record Transaction
        </button>
      </form>
      {/* New Delete All Transactions Button */}
      <button type="button" onClick={deleteAllTransactions} style={{...styles.button, backgroundColor: "#555"}}>
        Delete All Transactions
      </button>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    maxWidth: "400px",
    margin: "0 auto",
    marginBottom: "30px",
  },
  title: {
    textAlign: "center",
    color: "#333",
    marginBottom: "15px",
  },
  message: {
    textAlign: "center",
    color: "red",
    marginBottom: "15px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    marginBottom: "10px",
    color: "#555",
    fontWeight: "bold",
  },
  select: {
    padding: "10px",
    marginTop: "5px",
    marginBottom: "15px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    fontSize: "14px",
    backgroundColor: "#f9f9f9",
  },
  input: {
    padding: "10px",
    marginTop: "5px",
    marginBottom: "15px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    fontSize: "14px",
  },
  button: {
    padding: "10px 15px",
    backgroundColor: "#e91e63",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
    marginBottom: "10px",
  },
};

export default SalesExpenseForm;
