
let printerDevice = null;
let printerCharacteristic = null;
let items = [];
let selectedItems = [];
let billNo = parseInt(localStorage.getItem("billNo")) || 1;
let sales = JSON.parse(localStorage.getItem("sales") || "[]");
let chart;
let newImageBase64 = "";
// let selectedItems = [];
// let billNo = parseInt(localStorage.getItem("billNo")) || 1;
// let sales = JSON.parse(localStorage.getItem("sales")) || [];
// let printerDevice = null;
// let printerCharacteristic = null;

function loadMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  items.forEach((item, index) => {
    const existing = selectedItems.find(i => i.name === item.name);
    const quantity = existing ? existing.qty : 0;

    const div = document.createElement("div");
    div.className = "menu-item";

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;
    img.className = "menu-image";

    const label = document.createElement("div");
    label.innerHTML = `${item.name}<br>₹${item.price}`;

    const controls = document.createElement("div");
    controls.className = "menu-controls";
    controls.innerHTML = `
      <button onclick="changeQty(${index}, -1)">−</button>
      <span id="qty-${index}">${quantity}</span>
      <button onclick="changeQty(${index}, 1)">+</button>
    `;

    div.appendChild(img);
    div.appendChild(label);
    div.appendChild(controls);
    menuDiv.appendChild(div);
  });
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

  // let printWindow = window.open("", "_blank"); // earlier this print method was used,
  let printWindow = window.open('', '', 'width=400,height=600');// this prints bill in chrome tab of given size
  let billHTML = `
    <html>
    <head><title>Print Bill</title></head>
    <body onload="window.print(); window.close();">
    <pre style="font-family: monospace;">
-------------------------------
        ABHI TIFFIN CENTER
    Shop no.4,Patil Complex,
             Bidar
-------------------------------
Bill No:ATC-${current.billNo}
Date,Time:${current.date},${current.time}
-------------------------------
Item       Qty  Rate  Total
${current.items.map(i =>
  `${i.name.padEnd(10)} ${i.qty.toString().padEnd(4)} ₹${i.price.toString().padEnd(5)} ₹${(i.price * i.qty)}`
).join('\n')}
-------------------------------
Total Items: ${current.items.length},Total Qty:${current.items.reduce((sum, i) => sum + i.qty, 0)}
-------------------------------
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

// === ESC/POS builder ===
function buildEscPosCommands(current) {
  const { billNo, date, time, items, total } = current;
  let cmds = "";
  cmds += "\x1B\x40";                // Init
  cmds += "\x1B\x61\x01";            // Center
  cmds += "ABHI TIFFIN CENTER\n";
  cmds += "\x1B\x61\x00";            // Left
  cmds += `Bill No: ATC-${billNo}\n`;
  cmds += `Date:${date},Time:${time}\n`;
  cmds += "-----------------------------\n";
  cmds += "Item      Qty  Rate  Total\n";
  items.forEach(i => {
    cmds += `${i.name.padEnd(10)} ${i.qty.toString().padEnd(3)} x${i.price}     ${i.price*i.qty} \n`;
  });
  cmds += "--------------\n";
  cmds += `Total items:${current.items.length}\n`;
  cmds += "-----------------------------\n";
  cmds += `GRAND TOTAL:|${total}|\n`;
  cmds += "-----------------------------\n";
  cmds += "Thank You! Visit Again.\n";
  cmds += "Software by Tech Innovators.\n\n\n";
  cmds += "\x1D\x56\x41";            // Full cut
  return cmds;
}

//=== Direct‑print: QZ Tray (desktop) or Web Bluetooth (mobile) ===
async function printBillRaw(current) {
  const raw = buildEscPosCommands(current);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(raw);

  // 1) QZ Tray (desktop)
  if (window.qz) {
    try {
      await qz.api.connect();
      const cfg = qz.configs.create(); // default printer or pass name
      await qz.print(cfg, [{ type: 'raw', format: 'command', data: raw }]);
      await qz.api.disconnect();
      return;
    } catch (err) {
      console.warn("QZ Tray failed:", err);
    }
  }

  // 2) Web Bluetooth (mobile)
 // 2) Web Bluetooth (mobile)
if (navigator.bluetooth) {
  try {
    // Connect only once
    if (!printerDevice || !printerCharacteristic) {
      printerDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      const server = await printerDevice.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      printerCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      console.log("🔗 Printer connected:", printerDevice.name);
    }

    // Send chunks
    const chunkSize = 512;
    for (let i = 0; i < encoded.length; i += chunkSize) {
      const chunk = encoded.slice(i, i + chunkSize);
      await printerCharacteristic.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 50)); // small delay
    }

    return;
  } catch (err) {
    console.warn("Web Bluetooth failed:", err);
    printerDevice = null;
    printerCharacteristic = null;
  }
}


  // 3) Fallback
  alert("Direct print unavailable—opening browser print dialog.");
  printBill();
}




// === Wrapper to prepare data & call direct‑print ===
function prepareAndPrint() {
  const date = new Date();
  const current = {
    billNo,
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
    items: [...selectedItems],
    total: selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0)
  };

  // Save just like printBill()
  sales.push(current);
  localStorage.setItem("sales", JSON.stringify(sales));
  localStorage.setItem("billNo", ++billNo);
  // printBillRaw(current).catch(err => {
  //   console.error("Print failed:", err);
  //   alert("Print failed. Please try again.");
  // }).finally(() => {
  //   selectedItems = [];
  //   loadMenu();          // <== reset all quantities
  //   renderBill();
  //   renderChart();
  //   updateDashboard();
  // });
   printBillRaw(current).then(() => {
    
    selectedItems = [];
    loadMenu();
    renderBill();
    renderChart();
    updateDashboard();});
  //   .catch(err => {
  //   console.error("Print failed:", err);
  //   alert("Print failed. Please try again.");
  //  });
   
}
  
  
  // // Try raw‑print, fallback to printBill()
  // printBillRaw(current);

  
  // Try raw‑print, fallback to printBill()
 
// }
// const DEFAULT_MENU = [
//   { name: "Milk", price: 15, image: "images/milk.jpeg" },
//   { name: "Tea", price: 10, image: "images/tea.jpg" },
//   // ... all your original menu items
// ];

// let items = [];

// const items = [
//   { name: "Milk", price: 15, image: "images/milk.jpeg" },
//   { name: "Tea", price: 10, image: "images/tea.jpg" },
//   { name: "Coffee", price: 15, image: "images/coffee.jpg" },
//   { name: "Boost", price: 20, image: "images/boost.jpg" },
//   { name: "BlackTea", price: 15, image: "images/blacktea.jpg" },
//   { name: "Idli", price: 15, image: "images/idli.jpg" },
//   { name: "Dosa", price: 20, image: "images/dosa.jpg" },
//   { name: "Wada", price: 10, image: "images/wada.jpg" },
//   { name: "Uttapa", price: 15, image: "images/uttapam.jpg" },
//   { name: "Alubhat", price: 20, image: "images/alubhat.jpg" },
//   { name: "Samosa", price: 15, image: "images/samosa.jpg" },
//   { name: "Vada Pav", price: 20, image: "images/vada_pav.jpg" },
//   { name: "Mirchi", price: 10, image: "images/mirchi-bajji.jpg" },
//   { name: "Bhonda", price: 15, image: "images/mysore-bonda.jpg" },
//   { name: "Colddrinks", price: 10, image: "images/cold-drink.jpg" },
//   { name: "Waterbottle", price: 15, image: "images/waterbottles.jpg" },
//   { name: "Ice-cream", price: 15, image: "images/icecream.jpg" },
//   { name: "Roti", price: 15, image: "images/others.jpg" },
//   { name: "Rice", price: 15, image: "images/others.jpg" },
//   { name: "Sambar", price: 15, image: "images/others.jpg" }
// ];




// function login() {
//   const user = document.getElementById("username").value;
//   if (user) {
//     sessionStorage.setItem("user", user);
//     document.getElementById("login-section").style.display = "none";
//     document.getElementById("app-section").style.display = "block";
//     document.getElementById("user-display").innerText = `Welcome, ${user}`;
//     loadMenu();
//     renderChart();
//   }
// }

function logout() {
  sessionStorage.clear();
  location.reload();
}
function filterMenu() {
  const query = document.getElementById("search-bar").value.toLowerCase();
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach(item => {
    const name = item.querySelector("div").innerText.toLowerCase();
    item.style.display = name.includes(query) ? "block" : "none";
  });
}
function addToBill(item) {
  const existing = selectedItems.find(i => i.name === item.name);
  if (existing) existing.qty++;
  else selectedItems.push({ ...item, qty: 1 });
  renderBill();
}
function changeQty(index, delta) {
  const item = items[index];
  const existing = selectedItems.find(i => i.name === item.name);

  if (existing) {
    existing.qty += delta;
    if (existing.qty <= 0) {
      selectedItems = selectedItems.filter(i => i.name !== item.name);
    }
  } else if (delta > 0) {
    selectedItems.push({ ...item, qty: 1 });
  }

  renderBill();
  document.getElementById(`qty-${index}`).innerText =
    selectedItems.find(i => i.name === item.name)?.qty || 0;
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
function clearAllBills() {
  if (confirm("Are you sure you want to clear all bills and reset data?")) {
    localStorage.removeItem("sales");
    localStorage.setItem("billNo", 1);
    selectedItems = [];
    renderBill();
    updateDashboard();
    alert("All bills cleared. Starting fresh!");
  }
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
async function exportSalesToPDFRange() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const option = document.getElementById("report-range").value;
  let start, end;
  const today = new Date();

  if (option === "today") {
    start = new Date(today.setHours(0, 0, 0, 0));
    end = new Date(today.setHours(23, 59, 59, 999));
  } else if (option === "last7") {
    start = new Date(today);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end = new Date(); // now
  } else {
    start = new Date(document.getElementById("start-date").value);
    end = new Date(document.getElementById("end-date").value);
    if (isNaN(start) || isNaN(end)) {
      alert("Please select both start and end dates.");
      return;
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  const salesData = JSON.parse(localStorage.getItem("sales") || "[]");

  const filteredSales = salesData.filter(sale => {
    const saleDate = new Date(sale.date).getTime();
    return saleDate >= start.getTime() && saleDate <= end.getTime();
  });

  if (filteredSales.length === 0) {
    alert("No sales found in the selected range.");
    return;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ABHI TIFFIN CENTER", 105, 15, null, null, 'center');

  const rangeText = option === "today" ? "Today" :
                    option === "last7" ? "Last 7 Days" :
                    `From ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Sales Report (${rangeText})`, 105, 25, null, null, 'center');

  let y = 35;
  let grandTotal = 0;
  const itemSummary = {};

  filteredSales.forEach(sale => {
    doc.setFont("helvetica", "bold");
    doc.text(`Bill No: ATC-${sale.billNo}`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${sale.date}`, 100, y);
    doc.text(`Time: ${sale.time}`, 150, y);
    y += 6;

    doc.text("Item", 20, y);
    doc.text("Qty", 80, y);
    doc.text("Rate", 110, y);
    doc.text("Total", 150, y);
    y += 6;

    sale.items.forEach(item => {
      const total = item.qty * item.price;
      doc.text(item.name, 20, y);
      doc.text(`${item.qty}`, 85, y);
      doc.text(`₹${item.price}`, 110, y);
      doc.text(`₹${total}`, 150, y);
      y += 6;

      if (!itemSummary[item.name]) itemSummary[item.name] = { qty: 0, total: 0 };
      itemSummary[item.name].qty += item.qty;
      itemSummary[item.name].total += total;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.setFont("helvetica", "bold");
    doc.text(`Subtotal: ₹${sale.total}`, 150, y);
    y += 10;
    grandTotal += sale.total;
  });

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 105, y, null, null, 'center');
  y += 10;

  doc.setFontSize(12);
  doc.text("Item", 20, y);
  doc.text("Total Qty", 80, y);
  doc.text("Total Amt", 130, y);
  y += 6;

  for (const [name, { qty, total }] of Object.entries(itemSummary)) {
    doc.text(name, 20, y);
    doc.text(`${qty}`, 85, y);
    doc.text(`₹${total}`, 130, y);
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }
document.getElementById("report-range").addEventListener("change", function () {
  const custom = this.value === "custom";
  document.getElementById("start-date").style.display = custom ? "inline" : "none";
  document.getElementById("end-date").style.display = custom ? "inline" : "none";
});

  const totalQty = Object.values(itemSummary).reduce((sum, item) => sum + item.qty, 0);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Quantity Sold: ${totalQty}`, 105, y, null, null, 'center');
  y += 10;
  doc.setFontSize(14);
  doc.text(`Grand Total: ₹${grandTotal}`, 105, y, null, null, 'center');

  const filename = `Sales_Report_${option}_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}
// store chart instance globally
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
      data: data,
      backgroundColor: [
        '#ff6384', // red-pink
        '#36a2eb', // blue
        '#ffce56', // yellow
        '#4bc0c0', // teal
        '#9966ff', // purple
        '#f67019', // orange
        '#00c49f', // green-cyan
        '#ff9f40', // light orange
        '#c45850', // brownish
        '#8e5ea2'  // violet
      ],
      borderWidth: 0
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#ffffff' // matches bluish theme
        }
      }
    }
  }
});

}
function renderMenuTable() {
  const tbody = document.querySelector("#menu-item-table tbody");
  tbody.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${item.name}</td>
      <td><input type="number" value="${item.price}" onchange="updateItemPrice(${index}, this.value)" /></td>
      <td><img src="${item.image}" alt="${item.name}" width="40" height="30" /></td>
      <td>
        <button onclick="removeMenuItem(${index})" style="background-color:red;">❌ Remove</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}
// ========== MENU ITEMS AND STORAGE ==========


// REMOVE MENU MANAGEMENT AFTER LOGIN
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



window.onload = function () {
  loadMenuFromStorage();
  renderMenuTable();
  loadMenu(); // Assuming this is defined elsewhere for bill UI
};
function toggleClearButton() {
  const input = document.getElementById("search-bar");
  const clearBtn = document.getElementById("clear-search");
  clearBtn.style.display = input.value.length ? "inline" : "none";
}
// window.onload = updateDashboard;
window.onload = function () {
  loadMenuFromStorage();     // ← get menu
  renderMenuTable();         // ← show for editing
  loadMenu();                // ← show on main menu
  updateDashboard();
};
if (sessionStorage.getItem("user")) login();
async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
async function login() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  if (!user || !pass) {
    alert("Please enter both username and password.");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users") || "{}");

  if (!users[user]) {
    alert("User not found. Please register.");
    return;
  }

  const hash = await hashPassword(pass);
  if (users[user] !== hash) {
    alert("Incorrect password.");
    return;
  }

  sessionStorage.setItem("user", user);
  document.getElementById("login-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("user-display").innerText = `Welcome, ${user}`;
  loadMenu();
  renderChart();
}
async function register() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  if (!user || !pass) {
    alert("Enter username and password to register.");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users") || "{}");

  if (users[user]) {
    alert("Username already exists. Try logging in.");
    return;
  }

  const hash = await hashPassword(pass);
  users[user] = hash;
  localStorage.setItem("users", JSON.stringify(users));

  alert("User registered successfully. You can now log in.");
}


const DEFAULT_MENU = [
  { name: "Milk", price: 15, image: "images/milk.jpeg" },
  { name: "Tea", price: 10, image: "images/tea.jpg" },
  { name: "Coffee", price: 15, image: "images/coffee.jpg" },
  { name: "Boost", price: 20, image: "images/boost.jpg" },
  { name: "BlackTea", price: 15, image: "images/blacktea.jpg" },
  { name: "Idli", price: 15, image: "images/idli.jpg" },
  { name: "Dosa", price: 20, image: "images/dosa.jpg" },
  { name: "Wada", price: 10, image: "images/wada.jpg" },
  { name: "Uttapa", price: 15, image: "images/uttapam.jpg" },
  { name: "Alubhat", price: 20, image: "images/alubhat.jpg" },
  { name: "Samosa", price: 15, image: "images/samosa.jpg" },
  { name: "Vada Pav", price: 20, image: "images/vada_pav.jpg" },
  { name: "Mirchi", price: 10, image: "images/mirchi-bajji.jpg" },
  { name: "Bhonda", price: 15, image: "images/mysore-bonda.jpg" },
  { name: "Colddrinks", price: 10, image: "images/cold-drink.jpg" },
  { name: "Waterbottle", price: 15, image: "images/waterbottles.jpg" },
  { name: "Ice-cream", price: 15, image: "images/icecream.jpg" },
  { name: "Roti", price: 15, image: "images/others.jpg" },
  { name: "Rice", price: 15, image: "images/others.jpg" },
  { name: "Sambar", price: 15, image: "images/others.jpg" }
];

function saveMenuToStorage() {
  localStorage.setItem("menu", JSON.stringify(items));
}

function loadMenuFromStorage() {
  items = JSON.parse(localStorage.getItem("menu") || "[]");
  if (items.length === 0) {
    items = [...DEFAULT_MENU];
    saveMenuToStorage();
  }
}

function loadMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";
  items.forEach((item, index) => {
    const existing = selectedItems.find(i => i.name === item.name);
    const quantity = existing ? existing.qty : 0;
    const div = document.createElement("div");
    div.className = "menu-item";
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;
    img.className = "menu-image";
    const label = document.createElement("div");
    label.innerHTML = `${item.name}<br>₹${item.price}`;
    const controls = document.createElement("div");
    controls.className = "menu-controls";
    controls.innerHTML = `
      <button onclick="changeQty(${index}, -1)">−</button>
      <span id="qty-${index}">${quantity}</span>
      <button onclick="changeQty(${index}, 1)">+</button>
    `;
    div.appendChild(img);
    div.appendChild(label);
    div.appendChild(controls);
    menuDiv.appendChild(div);
  });
}

function renderMenuTable() {
  const tbody = document.querySelector("#menu-item-table tbody");
  tbody.innerHTML = "";
  items.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.name}</td>
      <td><input type="number" value="${item.price}" onchange="updateItemPrice(${index}, this.value)" /></td>
      <td><img src="${item.image}" alt="${item.name}" width="40" height="30" /></td>
      <td><button onclick="removeMenuItem(${index})" style="background-color:red;">❌ Remove</button></td>
    `;
    tbody.appendChild(row);
  });
}

function updateItemPrice(index, newPrice) {
  items[index].price = parseFloat(newPrice);
  saveMenuToStorage();
  loadMenu();
}

function removeMenuItem(index) {
  if (confirm(`Remove ${items[index].name}?`)) {
    items.splice(index, 1);
    saveMenuToStorage();
    renderMenuTable();
    loadMenu();
  }
}

function addNewMenuItem() {
  const name = document.getElementById("new-item-name").value.trim();
  const price = parseFloat(document.getElementById("new-item-price").value);
  if (!name || isNaN(price) || !newImageBase64) {
    alert("Please fill all fields and select an image.");
    return;
  }
  items.push({ name, price, image: newImageBase64 });
  saveMenuToStorage();
  renderMenuTable();
  loadMenu();
  document.getElementById("new-item-name").value = "";
  document.getElementById("new-item-price").value = "";
  document.getElementById("new-item-image").value = "";
  document.getElementById("image-preview").style.display = "none";
  newImageBase64 = "";
}

document.getElementById("new-item-image").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      newImageBase64 = e.target.result;
      const preview = document.getElementById("image-preview");
      preview.src = newImageBase64;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  }
});

window.onload = function () {
  loadMenuFromStorage();
  renderMenuTable();
  loadMenu();
  updateDashboard();
  if (sessionStorage.getItem("user")) login();
};
function toggleMenuManager() {
  const manager = document.getElementById("menu-manager");
  if (manager.style.display === "none") {
    manager.style.display = "block";
    renderMenuTable(); // optional: ensures the table is freshly rendered
  } else {
    manager.style.display = "none";
  }
}
function disconnectPrinter() {
  if (printerDevice && printerDevice.gatt.connected) {
    printerDevice.gatt.disconnect();
    alert("Printer disconnected successfully.");
  } else {
    alert("No printer connected.");
  }
}
function toggleSettings() {
  const panel = document.getElementById("settings-panel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

function handleEnter(event) {
  if (event.key === "Enter") {
    // Check if the active field is the username or password, and trigger login or register
    const usernameField = document.getElementById("username");
    const passwordField = document.getElementById("password");

    if (document.activeElement === usernameField) {
      // If username field is focused, trigger login
      document.getElementById("password").focus(); // Move focus to password
    } else if (document.activeElement === passwordField) {
      // If password field is focused, trigger login or register
      const loginButton = document.querySelector("button[onclick='login()']");
      const registerButton = document.querySelector("button[onclick='register()']");

      if (loginButton) {
        login();  // Trigger login
      } else if (registerButton) {
        register();  // Trigger register
      }
    }
  }
}

