const STORAGE_KEY = "tempCustomerEntryData";
const FORM_ID = "customer-form"; 

document.addEventListener("DOMContentLoaded", function () {
  // ১. পেজ লোড হওয়ার পর সেভ করা ডেটা ফর্মে বসিয়ে দেওয়া
  restoreFormData();

  // ২. Main Form & Auto Save Logic
  const form = document.getElementById(FORM_ID);
  if (form) {
    // ফর্মে কিছু লিখলে বা পরিবর্তন করলেই সেভ হবে
    form.addEventListener("input", saveFormData);
    form.addEventListener("change", saveFormData);
    form.addEventListener("submit", handleCustomerFormSubmit);
  }

  // ৩. Photo Preview Logic
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");

  if (photoInput) {
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

  // ৪. Loan Type Select Logic
  const loanTypeSelect = document.getElementById("loanTypeSelect");
  const rdLoanSection = document.getElementById("rd-loan-details");
  const interestRateInput = document.getElementById("interestRate");

  if (loanTypeSelect) {
    loanTypeSelect.addEventListener("change", function (e) {
      // অন্য পেজে যাওয়ার ঠিক আগে ফর্মের ডেটা জোর করে সেভ করা
      saveFormData();

      if (rdLoanSection) rdLoanSection.classList.add("hidden");

      if (e.target.value === "Gold Loan") {
        window.location.href = "GoldLoanEntry.html"; // Gold Loan পেজে যাবে
      } else if (e.target.value === "RD Loan") {
        if (rdLoanSection) rdLoanSection.classList.remove("hidden");
        document.getElementById("startDate").value = new Date().toISOString().substring(0, 10);
        
        if (interestRateInput) {
          const savedInterest = localStorage.getItem("savedRdInterest") || "1.6439";
          interestRateInput.value = savedInterest;
        }
      } else {
        if (interestRateInput) interestRateInput.value = "";
      }
    });

    // ==========================================
  // Auto Capitalize First Letter Logic (ম্যাজিক কোড)
  // ==========================================
  const textInputs = document.querySelectorAll('input[type="text"]');
  textInputs.forEach(input => {
    input.addEventListener('input', function() {
      const start = this.selectionStart;
      const end = this.selectionEnd;
      
      const originalValue = this.value;
      // প্রতিটি শব্দের প্রথম অক্ষর ক্যাপিটাল করবে
      const capitalizedValue = originalValue.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
      
      if (originalValue !== capitalizedValue) {
        this.value = capitalizedValue;
        // টাইপ করার সময় কার্সর যাতে লাফিয়ে শেষে না চলে যায়, তার জন্য এই লাইন
        this.setSelectionRange(start, end); 
      }
    });
  });
  }

  if (interestRateInput) {
    interestRateInput.addEventListener("input", function () {
      if (loanTypeSelect && loanTypeSelect.value === "RD Loan") {
        localStorage.setItem("savedRdInterest", this.value);
      }
    });
  }
  
  const goldDate = document.getElementById("goldAppDate");
  if(goldDate) {
    goldDate.value = new Date().toISOString().substring(0, 10);
  }
});


// ==========================================
// Auto Save & Restore Functions
// ==========================================

function saveFormData() {
  const form = document.getElementById(FORM_ID);
  if(!form) return;
  
  const formData = {};
  const inputs = form.querySelectorAll("input, select, textarea");
  
  inputs.forEach(input => {
    const key = input.id || input.name;
    if (key) {
      if (input.type === "checkbox" || input.type === "radio") {
        formData[key] = input.checked;
      } else {
        formData[key] = input.value;
      }
    }
  });
  
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
}

function restoreFormData() {
  const savedData = sessionStorage.getItem(STORAGE_KEY);
  if (savedData) {
    const formData = JSON.parse(savedData);
    const form = document.getElementById(FORM_ID);
    if(!form) return;
    
    const inputs = form.querySelectorAll("input, select, textarea");
    
    inputs.forEach(input => {
      const key = input.id || input.name;
      if (key && formData[key] !== undefined) {
        if (input.type === "checkbox" || input.type === "radio") {
          input.checked = formData[key];
        } else {
          input.value = formData[key];
        }
      }
    });
  }
}

// ==========================================
// Gold Loan Modal Functions
// ==========================================
function closeGoldLoanModal() {
  const modal = document.getElementById("gold-loan-modal");
  if(modal) modal.classList.add("hidden");
}

async function saveGoldLoanDetails() {
  const officerName = document.getElementById("goldOfficerName").value;
  if (!officerName) {
    alert("Please enter Loan Officer Name.");
    return;
  }
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
    saveFormData(); // নতুন আইটেম অ্যাড হলেও সেভ হবে
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
    saveFormData();
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
    saveFormData();
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

  if (photoFileInput && photoFileInput.files && photoFileInput.files[0]) {
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
  const form = document.getElementById(FORM_ID);
  if(form) form.reset();
  
  const photoPreview = document.getElementById("photoPreview");
  if(photoPreview) {
    photoPreview.src = "";
    photoPreview.classList.add("hidden-preview");
  }

  // ফর্ম সফলভাবে সাবমিট বা রিসেট হলে টেম্পোরারি ডেটা ডিলিট করে দেওয়া হবে
  sessionStorage.removeItem(STORAGE_KEY);
}