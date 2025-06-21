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
if (sessionStorage.getItem("user")) login();
