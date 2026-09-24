let currentEditId = null;
let existingPhotoUrl = "";
let isReopenMode = false;

document.addEventListener("DOMContentLoaded", function () {
  // ১. সেশন থেকে ডেটা নিয়ে ফর্মে বসানো
  const editDataStr = sessionStorage.getItem("editCustomerData");
  
  if (!editDataStr) {
    alert("No customer selected for editing.");
    window.location.href = "CustomerDetails.html";
    return;
  }

  const data = JSON.parse(editDataStr);
  isReopenMode = sessionStorage.getItem("reopenCustomerLoan") === "true";
  currentEditId = data["ID"];
  existingPhotoUrl = data["Photo URL"] || "";

  if (isReopenMode) {
    const formTitle = document.getElementById("form-title");
    if (formTitle) formTitle.innerText = "Re-open Customer Loan";
  }

  // ফিল্ডগুলোতে ডেটা বসানো
  document.getElementById("customerName").value = data["Customer Name"] || "";
  document.getElementById("guardianType").value = data["Guardian Type"] || "";
  document.getElementById("guardianName").value = data["Guardian Name"] || "";
  document.getElementById("gender").value = data["Gender"] || "";
  if(data["DOB"]) document.getElementById("dob").value = new Date(data["DOB"]).toISOString().substring(0, 10);
  document.getElementById("religion").value = data["Religion"] || "";
  document.getElementById("aadhaarNo").value = data["Aadhaar No"] || "";
  document.getElementById("mobileNo").value = data["Mobile No"] || "";
  document.getElementById("address").value = data["Address"] || "";
  document.getElementById("occupationSelect").value = data["Occupation"] || "";
  setSelectValue("bankName", data["Bank Name"] || "");
  document.getElementById("bankBranch").value = data["Bank Branch"] || "";
  document.getElementById("ifscCode").value = data["IFSC Code"] || "";
  document.getElementById("accountHolderName").value = data["Account Holder Name"] || "";
  document.getElementById("accountNumber").value = data["Account Number"] || "";
  toggleBankDetailFields();
  document.getElementById("loanTypeSelect").value = data["Loan Type"] || "";
  
  // Nominee ডেটা
  document.getElementById("nomineeName").value = data["Nominee Name"] || "";
  document.getElementById("nomineeGuardianType").value = data["Nominee Guardian Type"] || "";
  document.getElementById("nomineeGuardianName").value = data["Nominee Guardian Name"] || "";
  document.getElementById("nomineeGender").value = data["Nominee Gender"] || "";
  document.getElementById("nomineeOccupationSelect").value = data["Nominee Occupation"] || "";
  if(data["Nominee DOB"]) document.getElementById("nomineeDob").value = new Date(data["Nominee DOB"]).toISOString().substring(0, 10);
  document.getElementById("nomineeAadhaar").value = data["Nominee Aadhaar"] || "";
  document.getElementById("relationWithApplicant").value = data["Relation with Applicant"] || "";

  // RD Loan ফিল্ড
  const loanSelect = document.getElementById("loanTypeSelect");
  const rdLoanSection = document.getElementById("rd-loan-details");
  if (data["Loan Type"] === "RD Loan" && rdLoanSection) {
    rdLoanSection.classList.remove("hidden");
    document.getElementById("loanAmount").value = data["Loan Amount"] || "";
    if(data["Start Date"]) document.getElementById("startDate").value = new Date(data["Start Date"]).toISOString().substring(0, 10);
    document.getElementById("durationDays").value = data["Duration (Days)"] || "";
    document.getElementById("interestRate").value = data["Interest %"] || "";
  }

  // বাটন টেক্সট Update করা
  const submitBtn = document.getElementById("submit-btn");
  if (submitBtn) {
    submitBtn.innerText = isReopenMode ? "Re-open Loan" : "Update Customer";
    submitBtn.style.backgroundColor = "#eab308";
  }

  // ২. ফর্ম সাবমিট ইভেন্ট
  const form = document.getElementById("customer-edit-form");
if(form) form.addEventListener("submit", handleCustomerUpdateSubmit);
});

// ৩. আপডেট ডেটা সার্ভারে পাঠানো
async function handleCustomerUpdateSubmit(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = isReopenMode ? "Re-opening..." : "Updating...";

  const photoFileInput = document.getElementById("photoInput");
  let photoBase64 = "", photoName = "", photoMimeType = "";

  if (photoFileInput && photoFileInput.files && photoFileInput.files[0]) {
    const file = photoFileInput.files[0];
    photoName = file.name;
    photoMimeType = file.type;
    photoBase64 = await convertFileToBase64(file);
  }

  const payload = {
    action: "update",
    id: currentEditId,
    existingPhotoUrl: existingPhotoUrl, // আগের ছবির লিংক
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
    bankName: document.getElementById("bankName").value,
    bankBranch: document.getElementById("bankBranch").value.trim(),
    ifscCode: document.getElementById("ifscCode").value.trim().toUpperCase(),
    accountHolderName: document.getElementById("accountHolderName").value.trim(),
    accountNumber: document.getElementById("accountNumber").value.trim(),
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
      if (isReopenMode) {
        const reopenResponse = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({ action: "reopen_loan", customerId: currentEditId })
        });
        const reopenResult = await reopenResponse.json();
        if (reopenResult.status !== "success") {
          alert("Customer data was updated, but the loan could not be re-opened: " + (reopenResult.message || "Unknown error"));
          return;
        }
      }

      alert(isReopenMode ? "Loan re-opened successfully!" : "Customer updated successfully!");
      sessionStorage.removeItem("editCustomerData");
      const returnUrl = sessionStorage.getItem("reopenReturnUrl");
      sessionStorage.removeItem("reopenCustomerLoan");
      sessionStorage.removeItem("reopenReturnUrl");
      if (returnUrl) {
        window.location.href = returnUrl;
        return;
      }
      window.location.href = "CustomerDetails.html"; // আপডেট শেষে Details পেজে ফিরে যাবে
    } else {
      alert("Error: " + result.message);
    }
  } catch (err) {
    alert("Submission failed. Check network or script URL.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = isReopenMode ? "Re-open Loan" : "Update Customer";
  }
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function setSelectValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || !value) return;
  if (!Array.from(select.options).some(option => option.value === value)) {
    select.add(new Option(value, value));
  }
  select.value = value;
}

function toggleBankDetailFields() {
  const bankSelect = document.getElementById("bankName");
  const bankDetailFields = document.getElementById("bank-detail-fields");
  if (!bankSelect || !bankDetailFields) return;
  bankDetailFields.classList.toggle("hidden", !bankSelect.value);
}
