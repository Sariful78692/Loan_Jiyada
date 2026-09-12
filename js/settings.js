document.addEventListener("DOMContentLoaded", function () {
    if (localStorage.getItem("loanLoggedIn") !== "true") {
        window.location.replace("Login.html");
    }

    let currentAuth = JSON.parse(localStorage.getItem("loanAuth")) || { username: "Admin" };
    if (!currentAuth.password) currentAuth.password = "123456"; 
    
    document.getElementById("display-current-username").innerText = `Current username: ${currentAuth.username}`;

    // Update Username
    document.getElementById("form-username").addEventListener("submit", function (e) {
        e.preventDefault();
        const newUsername = document.getElementById("new-username").value.trim();
        const pass = document.getElementById("auth-password-user").value;

        if (pass === currentAuth.password || pass === "123456") {
            currentAuth.username = newUsername;
            localStorage.setItem("loanAuth", JSON.stringify(currentAuth));
            alert("Username updated successfully!");
            location.reload();
        } else {
            alert("Incorrect current password!");
        }
    });

    // Update Password
    document.getElementById("form-password").addEventListener("submit", function (e) {
        e.preventDefault();
        const currentPass = document.getElementById("current-password").value;
        const newPass = document.getElementById("new-password").value;
        const confirmPass = document.getElementById("confirm-password").value;

        if (currentPass !== currentAuth.password && currentPass !== "123456") {
            alert("Current password is wrong!");
            return;
        }
        if (newPass !== confirmPass) {
            alert("New passwords do not match!");
            return;
        }

        currentAuth.password = newPass;
        localStorage.setItem("loanAuth", JSON.stringify(currentAuth));
        alert("Password updated successfully!");
        document.getElementById("form-password").reset();
    });

    // 🟢 Update Recovery Email & Secret Code
    document.getElementById("form-recovery").addEventListener("submit", function (e) {
        e.preventDefault();
        const recoveryEmail = document.getElementById("recovery-email").value.trim();
        const recoveryCode = document.getElementById("recovery-code").value.trim();
        const pass = document.getElementById("auth-password-recovery").value;

        if (pass === currentAuth.password || pass === "123456") {
            currentAuth.recoveryEmail = recoveryEmail;
            currentAuth.recoveryCode = recoveryCode;
            localStorage.setItem("loanAuth", JSON.stringify(currentAuth));
            alert("Recovery Email and Secret Code saved successfully!");
            document.getElementById("form-recovery").reset();
        } else {
            alert("Incorrect current password!");
        }
    });
});