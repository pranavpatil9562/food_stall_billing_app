// const items = [
//   { name: "Samosa", price: 15 },
//   { name: "Vada Pav", price: 20 },
//   { name: "Tea", price: 10 },
//   { name: "Coffee", price: 15 }
// ];
const items = [
  { name: "Samosa", price: 15, image: "images/samosa.jpg" },
  { name: "Vada Pav", price: 20, image: "images/vada_pav.jpg" },
  { name: "Tea", price: 10, image: "images/tea.jpg" },
  { name: "Coffee", price: 15, image: "images/coffee.jpg" }
];


let selectedItems = [];
let billNo = parseInt(localStorage.getItem("billNo")) || 1;
let sales = JSON.parse(localStorage.getItem("sales")) || [];

function login() {
  const user = document.getElementById("username").value;
  if (user) {
    sessionStorage.setItem("user", user);
    document.getElementById("login-section").style.display = "none";
    document.getElementById("app-section").style.display = "block";
    document.getElementById("user-display").innerText = `Welcome, ${user}`;
    loadMenu();
    renderChart();
  }
}

function logout() {
  sessionStorage.clear();
  location.reload();
}

function loadMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "menu-item";
    div.onclick = () => addToBill(item);

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;
    img.className = "menu-image"; // New class for styling

    const label = document.createElement("div");
    label.innerHTML = `${item.name}<br>₹${item.price}`;

    div.appendChild(img);
    div.appendChild(label);
    menuDiv.appendChild(div);
  });
}



function addToBill(item) {
  const existing = selectedItems.find(i => i.name === item.name);
  if (existing) existing.qty++;
  else selectedItems.push({ ...item, qty: 1 });
  renderBill();
}

function renderBill() {
  const tbody = document.querySelector("#bill-table tbody");
  tbody.innerHTML = "";

  let totalAmount = 0;
  let totalQty = 0;

  selectedItems.forEach(item => {
    const itemTotal = item.price * item.qty;
    totalAmount += itemTotal;
    totalQty += item.qty;
    tbody.innerHTML += `<tr>
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>₹${item.price}</td>
      <td>₹${itemTotal}</td>
    </tr>`;
  });

  const summary = `
    Total Items: ${selectedItems.length}  
    Total Quantity: ${totalQty}  
    Grand Total: ₹${totalAmount}
  `;

  document.getElementById("total-display").innerText = summary;
  
}



function printBill() {
  const date = new Date();
  const current = {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
    billNo,
    items: [...selectedItems],
    total: selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0)
  };

  sales.push(current);
  localStorage.setItem("sales", JSON.stringify(sales));
  localStorage.setItem("billNo", ++billNo);

  let printWindow = window.open("", "_blank");
  let billHTML = `
    <html>
    <head><title>Print Bill</title></head>
    <body onload="window.print(); window.close();">
    <pre style="font-family: monospace;">
------------------------------------
        ABHI TIFFIN CENTER
    Shop no.4,Patil Complex,Bidar
------------------------------------
Bill No:ATC-${current.billNo}
Date,Time:${current.date},${current.time}
-------------------------------
Item       Qty  Rate  Total
${current.items.map(i =>
  `${i.name.padEnd(10)} ${i.qty.toString().padEnd(4)} ₹${i.price.toString().padEnd(5)} ₹${(i.price * i.qty)}`
).join('\n')}
-------------------------------
Total Items: ${current.items.length},Total Qty:${current.items.reduce((sum, i) => sum + i.qty, 0)}
Grand Total: ₹${current.total}
-------------------------------
    THANK YOU! VISIT AGAIN
-------------------------------
    </pre>
    </body>
    </html>`;
  printWindow.document.write(billHTML);

  selectedItems = [];
  renderBill();
  renderChart();
  updateDashboard();

}



function renderChart() {
  const today = new Date().toLocaleDateString();
  const todaySales = sales.filter(s => s.date === today);

  const itemMap = {};
  todaySales.forEach(bill => {
    bill.items.forEach(item => {
      itemMap[item.name] = (itemMap[item.name] || 0) + item.qty;
    });
  });

  const ctx = document.getElementById("salesChart").getContext("2d");
  if (window.salesChart) window.salesChart.destroy();
  window.salesChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(itemMap),
      datasets: [{
        data: Object.values(itemMap),
        backgroundColor: ['#42a5f5', '#66bb6a', '#ffca28', '#ef5350']
      }]
    }
  });
}

function showDashboard() {
  const today = new Date().toLocaleDateString();
  const salesData = JSON.parse(localStorage.getItem("sales") || "[]");
  const todaySales = salesData.filter(s => s.date === today);

  let totalSales = 0;
  let totalQty = 0;
  let totalBills = todaySales.length;

  todaySales.forEach(bill => {
    totalSales += bill.total;
    bill.items.forEach(item => totalQty += item.qty);
  });

  document.getElementById("dash-total-sales").innerText = `Total Sales: ₹${totalSales}`;
  document.getElementById("dash-total-qty").innerText = `Total Quantity Sold: ${totalQty}`;
  document.getElementById("dash-total-bills").innerText = `Bills Generated: ${totalBills}`;
  document.getElementById("dash-total-amount").innerText = `Date: ${today}`;

  document.getElementById("dashboard").style.display = "block";
}

let chart; // store chart instance globally

function updateDashboard() {
  const today = new Date().toLocaleDateString();
  const salesData = JSON.parse(localStorage.getItem("sales") || "[]");
  const todaySales = salesData.filter(s => s.date === today);

  let totalSales = 0;
  let totalQty = 0;
  let totalBills = todaySales.length;
  const itemCounts = {};

  todaySales.forEach(bill => {
    totalSales += bill.total;
    bill.items.forEach(item => {
      totalQty += item.qty;
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.qty;
    });
  });

  document.getElementById("dash-total-sales").innerText = `Total Sales: ₹${totalSales}`;
  document.getElementById("dash-total-qty").innerText = `Total Quantity Sold: ${totalQty}`;
  document.getElementById("dash-total-bills").innerText = `Bills Generated: ${totalBills}`;

  // Create/update pie chart
  const ctx = document.getElementById("salesChart").getContext("2d");
  const labels = Object.keys(itemCounts);
  const data = Object.values(itemCounts);

  if (chart) chart.destroy(); // destroy old chart if exists

  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Item Sales Share',
        data: data,
        backgroundColor: [
          '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#f67019'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}
window.onload = updateDashboard;





if (sessionStorage.getItem("user")) login();
