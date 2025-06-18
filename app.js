// const items = [
//   { name: "Samosa", price: 15 },
//   { name: "Vada Pav", price: 20 },
//   { name: "Tea", price: 10 },
//   { name: "Coffee", price: 15 }
// ];
// async function connectAndPrint() {
//   const printer = new WebBluetoothReceiptPrinter();

//   try {
//     // Connect to the printer via BLE
//     await printer.connect();

//     // Start a new print job
//     printer.printText("ABHI TIFFIN CENTER\n", { bold: true, align: "center" });
//     printer.printText("------------------------\n");
//     printer.printText("Bill No: 101\n");
//     printer.printText("Date: 2025-06-18\nTime: 1:45 PM\n\n");
//     printer.printText("Vada Pav    x2    Rs. 40\n");
//     printer.printText("Tea         x1    Rs. 10\n");
//     printer.printText("------------------------\n");
//     printer.printText("Total             Rs. 50\n", { bold: true });
//     printer.printText("\nThank You!\n\n\n");

//     await printer.flush(); // Sends the data to printer
//   } catch (error) {
//     console.error("Error:", error);
//     alert("Printer connection failed.");
//   }
//   alert("Direct print unavailable—opening browser print dialog.");
//   printBill();
// }
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
  cmds += `Date: ${date},Time: ${time}\n`;
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
  console.log(raw)
  // 1) QZ Tray (desktop)
  if (window.qz) {
    try {
      await qz.api.connect();
      const cfg = qz.configs.create(); // default printer or pass name
      await qz.print(cfg, [{ type:'raw', format:'command', data:raw }]);
      await qz.api.disconnect();
      return;
    } catch (err) {
      console.warn("QZ Tray failed:", err);
    }
  }

  // 2) Web Bluetooth (mobile)
  if (navigator.bluetooth) {
    try {
      const device = await navigator.bluetooth.requestDevice({
         acceptAllDevices: true,
         optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });

      // const device = await navigator.bluetooth.requestDevice({
      //   filters: [{ namePrefix: 'Thermal' }],
      //   optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      // });
      console.log("Selected device:", device.name);
      const server  = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const char    = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      await char.writeValue(new TextEncoder().encode(raw));
      await server.disconnect();
      return;
    } catch (err) {
      console.warn("Web Bluetooth failed:", err);
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

const items = [
  { name: "Milk", price: 15, image: "images/milk.jpeg" },
  { name: "Tea", price: 10, image: "images/tea.jpg" },
  { name: "Coffee", price: 15, image: "images/coffee.jpg" },
  { name: "Boost", price: 20, image: "images/boost.jpg" },
  { name: "BlackTea", price: 15, image: "images/blacktea.jpg" },
  { name: "Idli", price: 15, image: "images/idli.jpg" },
  { name: "Dosa", price: 20, image: "images/dosa.jpg" },
  { name: "Wada", price: 10, image: "images/wada.jpg" },
  { name: "Uttapa", price: 15, image: "images/uttapam.jpg" },
  { name: "Alubhat", price: 20, image: "images/dosa.jpg" },
  { name: "Samosa", price: 15, image: "images/samosa.jpg" },
  { name: "Vada Pav", price: 20, image: "images/vada_pav.jpg" },
  { name: "Mirchi", price: 10, image: "images/mirchi-bajji.jpg" },
  { name: "Bhonda", price: 15, image: "images/mysore-bonda.jpg" },
  { name: "Colddrinks", price: 10, image: "images/wada.jpg" },
  { name: "Waterbottle", price: 15, image: "images/waterbottles.jpg" },
  { name: "Ice-cream", price: 15, image: "images/icecream.jpg" },
  { name: "Others", price: 15, image: "images/others.jpg" }
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
window.onload = updateDashboard;





if (sessionStorage.getItem("user")) login();
