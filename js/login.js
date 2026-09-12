document.getElementById("login-form").addEventListener("submit", async e => { 
    e.preventDefault(); 
    
    const enteredUser = document.getElementById("login-username").value.trim();
    const enteredPass = document.getElementById("login-password").value;
    const messageEl = document.getElementById("login-message");
    const submitBtn = e.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    messageEl.style.color = "#64748b";
    messageEl.innerText = "Checking...";

    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "login",
                username: enteredUser,
                password: enteredPass
            })
        });
        const result = await res.json();

        if (result.status === "success") {
            localStorage.setItem("loanLoggedIn", "true");
            
            // Settings এর রিকভারি ডেটা যেন মুছে না যায়, তাই আপডেট করা হচ্ছে
            let currentAuth = JSON.parse(localStorage.getItem("loanAuth")) || {};
            currentAuth.username = result.username || enteredUser;
            currentAuth.password = enteredPass;
            localStorage.setItem("loanAuth", JSON.stringify(currentAuth));

            messageEl.style.color = "green";
            messageEl.innerText = "Login Successful! Redirecting...";

            setTimeout(() => {
                window.location.href = "Dashboard.html"; 
            }, 800);
        } else {
            messageEl.style.color = "#e74c3c";
            messageEl.innerText = result.message || "Invalid username or password!";
            submitBtn.disabled = false;
        }
    } catch (err) {
        messageEl.style.color = "#e74c3c";
        messageEl.innerText = "Network error. Please try again.";
        submitBtn.disabled = false;
        console.error(err);
    }
});

// 🟢 Forgot Username 
function forgotUsername() {
    let currentAuth = JSON.parse(localStorage.getItem("loanAuth"));
    
    if (!currentAuth || !currentAuth.recoveryEmail) {
        alert("No recovery data found! Please set it up from Settings first.");
        return;
    }

    const email = prompt("Enter your registered recovery email:");
    if (!email) return;

    // সেটিংসে দেওয়া ইমেইলের সাথে মেলাচ্ছে
    if (email.trim().toLowerCase() === currentAuth.recoveryEmail.toLowerCase()) {
        const code = prompt("Email matched! Now enter your Secret Recovery Code:");
        if (code === currentAuth.recoveryCode) {
            alert(`✅ Verification Successful!\n\nYour Username is: ${currentAuth.username}`);
        } else {
            alert("❌ Incorrect Secret Code!");
        }
    } else {
        alert("❌ Incorrect Email Address! This does not match your saved recovery email.");
    }
}

// 🟢 Forgot Password
function forgotPassword() {
    let currentAuth = JSON.parse(localStorage.getItem("loanAuth"));
    
    if (!currentAuth || !currentAuth.recoveryEmail) {
        alert("No recovery data found! Please set it up from Settings first.");
        return;
    }

    const email = prompt("Enter your registered recovery email:");
    if (!email) return;

    // সেটিংসে দেওয়া ইমেইলের সাথে মেলাচ্ছে
    if (email.trim().toLowerCase() === currentAuth.recoveryEmail.toLowerCase()) {
        const code = prompt("Email matched! Now enter your Secret Recovery Code:");
        if (code === currentAuth.recoveryCode) {
            alert(`✅ Verification Successful!\n\nYour Password is: ${currentAuth.password}\n\nPlease login and change it from settings if needed.`);
        } else {
            alert("❌ Incorrect Secret Code!");
        }
    } else {
        alert("❌ Incorrect Email Address! This does not match your saved recovery email.");
    }
}

function requireLogin() {
    const isLoginPage = window.location.pathname.toLowerCase().includes("login.html");
    if (localStorage.getItem("loanLoggedIn") !== "true" && !isLoginPage) {
        window.location.replace("Login.html");
    }
}