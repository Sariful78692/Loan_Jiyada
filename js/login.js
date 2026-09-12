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
            localStorage.setItem("loanAuth", JSON.stringify({ username: result.username }));

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

function forgotUsername() {
    const email = prompt("Enter your recovery email:");
    if (!email) return;
    
    fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "forgot_username", recoveryEmail: email })
    })
    .then(res => res.json())
    .then(() => alert("If that email is registered, your username has been sent to it."))
    .catch(() => alert("Something went wrong. Please try again."));
}

function forgotPassword() {
    const username = prompt("Enter your username:");
    if (!username) return;
    const email = prompt("Enter your recovery email:");
    if (!email) return;

    fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "request_password_reset", username: username, recoveryEmail: email })
    })
    .then(res => res.json())
    .then(result => {
        if (result.status === "success") {
            alert("A verification code has been sent to your email.");
            const code = prompt("Enter the verification code:");
            const newPassword = prompt("Enter your new password (min 6 characters):");
            if (!code || !newPassword) return;

            return fetch(APPS_SCRIPT_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "reset_password",
                    username: username,
                    recoveryEmail: email,
                    code: code,
                    newPassword: newPassword
                })
            }).then(res => res.json());
        } else {
            alert(result.message || "Something went wrong.");
        }
    })
    .then(result => {
        if (result && result.status === "success") alert("Password reset successfully! Please login with your new password.");
        else if (result) alert(result.message || "Failed to reset password.");
    })
    .catch(() => alert("Network error. Please try again."));
}

function requireLogin() {
  const isLoginPage = window.location.pathname.toLowerCase().includes("login.html");
  if (localStorage.getItem("loanLoggedIn") !== "true" && !isLoginPage) {
    window.location.replace("Login.html");
  }
}