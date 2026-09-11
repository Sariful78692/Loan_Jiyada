document.addEventListener("DOMContentLoaded", function () {
  // ১. Photo Preview Logic
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");

  if(photoInput) {
    photoInput.addEventListener("change", function () {
      const file = this.files[0];
      if (file) {
        if (file.size > 100 * 1024) {
          alert("Photo size must be 50 KB or less!");
          this.value = "";
          photoPreview.classList.add("hidden-preview");
          photoPreview.src = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          photoPreview.src = e.target.result;
          photoPreview.classList.remove("hidden-preview");
        };
        reader.readAsDataURL(file);
      } else {
        photoPreview.classList.add("hidden-preview");
        photoPreview.src = "";
      }
    });
  }

  // ২. Main Form Submit Logic
  const form = document.getElementById("customer-form");
  if(form) form.addEventListener("submit", handleCustomerFormSubmit);

  // ৩. Loan Type Select Logic
  const loanTypeSelect = document.getElementById("loanTypeSelect");
  const rdLoanSection = document.getElementById("rd-loan-details"); // RD লোনের সেকশন
  const interestRateInput = document.getElementById("interestRate"); // 🟢 Interest % এর ফিল্ড

  if (loanTypeSelect) {
    loanTypeSelect.addEventListener("change", function (e) {
      // প্রথমে RD Loan সেকশন হাইড করে রাখা
      if (rdLoanSection) rdLoanSection.classList.add("hidden");

      if (e.target.value === "Gold Loan") {
        window.location.href = "GoldLoanEntry.html"; // Gold Loan পেজে যাবে
      } else if (e.target.value === "RD Loan") {
        // RD Loan সিলেক্ট করলে ফিল্ডগুলো শো করবে
        if (rdLoanSection) rdLoanSection.classList.remove("hidden");
        
        // ডিফল্টভাবে আজকের তারিখ সেট করা
        document.getElementById("startDate").value = new Date().toISOString().substring(0, 10);

        // 🟢 Interest % অটোমেটিক বসানোর লজিক
        if (interestRateInput) {
          // আগে সেভ করা কোনো রেট থাকলে সেটা নেবে, না থাকলে 1.6439 বসাবে
          const savedInterest = localStorage.getItem("savedRdInterest") || "1.6439";
          interestRateInput.value = savedInterest;
        }
      } else {
        // অন্য লোন সিলেক্ট করলে ইন্টারেস্ট ঘর ফাঁকা করে দেবে
        if (interestRateInput) interestRateInput.value = "";
      }
    });
  }

  // 🟢 Interest % এডিট করলে ব্রাউজারে সেভ করে রাখার লজিক
  if (interestRateInput) {
    interestRateInput.addEventListener("input", function () {
      if (loanTypeSelect && loanTypeSelect.value === "RD Loan") {
        localStorage.setItem("savedRdInterest", this.value);
      }
    });
  }
  
  // Gold Loan-এর Application Date আজ ডিফল্টভাবে সেট করা
  const goldDate = document.getElementById("goldAppDate");
  if(goldDate) {
    goldDate.value = new Date().toISOString().substring(0, 10);
  }
});

// ==========================================
// Gold Loan Modal Functions
// ==========================================
function closeGoldLoanModal() {
  document.getElementById("gold-loan-modal").classList.add("hidden");
}

async function saveGoldLoanDetails() {
  const officerName = document.getElementById("goldOfficerName").value;
  
  if (!officerName) {
    alert("Please enter Loan Officer Name.");
    return;
  }

  // ইমেজ Base64 করার লজিক (প্রয়োজনে)
  const nomineeImgFile = document.getElementById("goldNomineeImage").files[0];
  const goldItemImgFile = document.getElementById("goldItemImage").files[0];
  
  let nomineeImgBase64 = "";
  let goldItemImgBase64 = "";

  if (nomineeImgFile) nomineeImgBase64 = await convertFileToBase64(nomineeImgFile);
  if (goldItemImgFile) goldItemImgBase64 = await convertFileToBase64(goldItemImgFile);
  
  alert("Gold Loan details temporarily saved. Please submit the main Customer Form to save entirely.");
  closeGoldLoanModal();
}

// ==========================================
// Add New Options (+) Functions
// ==========================================

function promptAddNewOccupation() {
  const newOcc = prompt("Enter new Occupation:");
  if (newOcc && newOcc.trim() !== "") {
    const cleanOcc = newOcc.trim();
    const select = document.getElementById("occupationSelect");
    const option = document.createElement("option");
    option.value = cleanOcc;
    option.textContent = cleanOcc;
    select.appendChild(option);
    select.value = cleanOcc;
  }
}

function promptAddNewNomineeOccupation() {
  const newOcc = prompt("Enter new Nominee Occupation:");
  if (newOcc && newOcc.trim() !== "") {
    const cleanOcc = newOcc.trim();
    const select = document.getElementById("nomineeOccupationSelect");
    const option = document.createElement("option");
    option.value = cleanOcc;
    option.textContent = cleanOcc;
    select.appendChild(option);
    select.value = cleanOcc;
  }
}
function promptAddNewLoanType() {
  const newLoan = prompt("Enter new Loan Type (e.g. Personal Loan):");
  if (newLoan && newLoan.trim() !== "") {
    const cleanLoan = newLoan.trim();
    const select = document.getElementById("loanTypeSelect");
    const option = document.createElement("option");
    option.value = cleanLoan;
    option.textContent = cleanLoan;
    select.appendChild(option);
    select.value = cleanLoan;

    const sidebarList = document.getElementById("sidebar-loan-list");
    if (sidebarList) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="CustomerDetails.html?loan=${encodeURIComponent(cleanLoan)}">${cleanLoan}</a>`;
      sidebarList.appendChild(li);
    }

    let customLoans = JSON.parse(localStorage.getItem('customLoans')) || [];
    if(!customLoans.includes(cleanLoan)) {
      customLoans.push(cleanLoan);
      localStorage.setItem('customLoans', JSON.stringify(customLoans));
    }
  }
}

// ==========================================
// Form Submit & Utility Functions
// ==========================================

async function handleCustomerFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Saving...";

  const photoFileInput = document.getElementById("photoInput");
  let photoBase64 = "";
  let photoName = "";
  let photoMimeType = "";

  if (photoFileInput.files && photoFileInput.files[0]) {
    const file = photoFileInput.files[0];
    photoName = file.name;
    photoMimeType = file.type;
    photoBase64 = await convertFileToBase64(file);
  }

  const payload = {
    action: "create",
    customerName: document.getElementById("customerName").value.trim(),
    guardianType: document.getElementById("guardianType").value,
    guardianName: document.getElementById("guardianName").value.trim(),
    gender: document.getElementById("gender").value,
    dob: document.getElementById("dob").value,
    religion: document.getElementById("religion").value.trim(),
    aadhaarNo: document.getElementById("aadhaarNo").value.trim(),
    mobileNo: document.getElementById("mobileNo").value.trim(),
    address: document.getElementById("address").value.trim(),
    occupation: document.getElementById("occupationSelect").value,
    loanType: document.getElementById("loanTypeSelect").value,
    
    // RD Loan এর ফিল্ডগুলো যুক্ত করা হলো
    loanAmount: document.getElementById("loanAmount") ? document.getElementById("loanAmount").value : "",
    startDate: document.getElementById("startDate") ? document.getElementById("startDate").value : "",
    durationDays: document.getElementById("durationDays") ? document.getElementById("durationDays").value : "",
    interestRate: document.getElementById("interestRate") ? document.getElementById("interestRate").value : "",
    
    photoBase64: photoBase64,
    photoName: photoName,
    photoMimeType: photoMimeType,
    nomineeName: document.getElementById("nomineeName").value.trim(),
    nomineeGuardianType: document.getElementById("nomineeGuardianType").value,
    nomineeGuardianName: document.getElementById("nomineeGuardianName").value.trim(),
    nomineeGender: document.getElementById("nomineeGender").value,
    nomineeOccupation: document.getElementById("nomineeOccupationSelect").value,
    nomineeDob: document.getElementById("nomineeDob").value,
    nomineeAadhaar: document.getElementById("nomineeAadhaar").value.trim(),
    relationWithApplicant: document.getElementById("relationWithApplicant").value.trim()
  };

  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();

    if (result.status === "success") {
      alert("Customer saved successfully!");
      resetForm();
    } else {
      alert("Error: " + result.message);
    }
  } catch (err) {
    alert("Submission failed. Check network or script URL.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Save Customer";
  }
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve(reader.result.split(",")[1]); };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function resetForm() {
  document.getElementById("customer-form").reset();
  const photoPreview = document.getElementById("photoPreview");
  if(photoPreview) {
    photoPreview.src = "";
    photoPreview.classList.add("hidden-preview");
  }
}