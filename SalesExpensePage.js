// SalesExpensePage.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import SalesExpenseForm from "./SalesExpenseForm";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SalesExpensePage = () => {
  const [transactions, setTransactions] = useState([]);
  const [profit, setProfit] = useState(0);
  const [heroProduct, setHeroProduct] = useState(null);
  const [lossProduct, setLossProduct] = useState(null);
  const vendorId = localStorage.getItem("vendorId");

  // Fetch all transactions for the vendor
  const fetchTransactions = async () => {
    if (!vendorId) {
      console.error("Vendor ID not found in localStorage.");
      return;
    }
    try {
      const response = await axios.get(
        `http://localhost:5000/api/transactions/vendor/${vendorId}`
      );
      setTransactions(response.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  useEffect(() => {
    if (vendorId) {
      fetchTransactions();
    }
  }, [vendorId]);

  // Process transactions to compute summary per product
  const productSummary = {};
  transactions.forEach((txn) => {
    const product = txn.productName;
    if (!productSummary[product]) {
      productSummary[product] = { sale: 0, expense: 0 };
    }
    if (txn.type === "sale") {
      productSummary[product].sale += txn.amount;
    } else if (txn.type === "expense") {
      productSummary[product].expense += txn.amount;
    }
  });

  const productLabels = Object.keys(productSummary);
  const salesData = productLabels.map((product) => productSummary[product].sale);
  const expenseData = productLabels.map((product) => productSummary[product].expense);

  // Compute overall totals and profit
  let totalSale = 0, totalExpense = 0;
  productLabels.forEach((product) => {
    totalSale += productSummary[product].sale;
    totalExpense += productSummary[product].expense;
  });
  const overallProfit = totalSale - totalExpense;

  // Identify hero product (max sale) and loss product (largest loss where expenses exceed sales)
  useEffect(() => {
    let hero = null;
    let maxSale = 0;
    let loss = null;
    let maxLoss = 0;
    productLabels.forEach((product) => {
      const saleVal = productSummary[product].sale;
      const expenseVal = productSummary[product].expense;
      if (saleVal > maxSale) {
        maxSale = saleVal;
        hero = product;
      }
      if (expenseVal > saleVal) {
        const currentLoss = expenseVal - saleVal;
        if (currentLoss > maxLoss) {
          maxLoss = currentLoss;
          loss = product;
        }
      }
    });
    setProfit(overallProfit);
    setHeroProduct(hero);
    setLossProduct(loss);
  }, [transactions]);

  // Prepare bar chart data for sales and expenses
  const salesChartData = {
    labels: productLabels,
    datasets: [
      {
        label: "Sales",
        data: salesData,
        backgroundColor: "#4caf50",
        borderColor: "#388e3c",
        borderWidth: 1,
      },
    ],
  };

  const expenseChartData = {
    labels: productLabels,
    datasets: [
      {
        label: "Expenses",
        data: expenseData,
        backgroundColor: "#f44336",
        borderColor: "#d32f2f",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true },
    },
  };

  const refreshData = () => {
    fetchTransactions();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Sales & Expense Dashboard</h2>
      <SalesExpenseForm vendorId={vendorId} onTransactionRecorded={fetchTransactions} />
      <button style={styles.refreshButton} onClick={refreshData}>
        Refresh Data
      </button>
      <div style={styles.chartsContainer}>
        <div style={styles.chartItem}>
          <h3>Sales by Product</h3>
          <Bar
            data={salesChartData}
            options={{ ...chartOptions, title: { display: true, text: "Sales by Product" } }}
          />
        </div>
        <div style={styles.chartItem}>
          <h3>Expenses by Product</h3>
          <Bar
            data={expenseChartData}
            options={{ ...chartOptions, title: { display: true, text: "Expenses by Product" } }}
          />
        </div>
      </div>
      <div style={styles.info}>
        <p>
          <strong>Total Sales:</strong> ₹{totalSale.toFixed(2)}
        </p>
        <p>
          <strong>Total Expenses:</strong> ₹{totalExpense.toFixed(2)}
        </p>
        <p>
          <strong>Profit:</strong> ₹{overallProfit.toFixed(2)}
        </p>
        {heroProduct && (
          <p>
            <strong>Hero Product:</strong> {heroProduct} (Sales: ₹{productSummary[heroProduct].sale.toFixed(2)})
          </p>
        )}
        {lossProduct && (
          <p>
            <strong>Product in Loss:</strong> {lossProduct} (Loss: ₹
            {(productSummary[lossProduct].expense - productSummary[lossProduct].sale).toFixed(2)})
          </p>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "30px",
    backgroundColor: "#f0f4f8",
    minHeight: "100vh",
    fontFamily: "'Arial', sans-serif",
  },
  heading: {
    textAlign: "center",
    color: "#333",
    marginBottom: "20px",
  },
  refreshButton: {
    display: "block",
    margin: "0 auto 20px auto",
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  chartsContainer: {
    display: "flex",
    flexDirection: "row", // Force row layout
    gap: "20px",
    // Remove flexWrap to ensure they stay side by side on larger screens.
  },
  chartItem: {
    flex: "1",
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  info: {
    textAlign: "center",
    marginTop: "20px",
    fontSize: "18px",
    color: "#333",
  },
};

export default SalesExpensePage;
