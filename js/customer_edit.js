let currentEditId = null;
let existingPhotoUrl = "";

document.addEventListener("DOMContentLoaded", function () {
  // ১. সেশন থেকে ডেটা নিয়ে ফর্মে বসানো
  const editDataStr = sessionStorage.getItem("editCustomerData");
  
  if (!editDataStr) {
    alert("No customer selected for editing.");
    window.location.href = "CustomerDetails.html";
    return;
  }

  const data = JSON.parse(editDataStr);
  currentEditId = data["ID"];
  existingPhotoUrl = data["Photo URL"] || "";

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
    submitBtn.innerText = "Update Customer";
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
  submitBtn.innerText = "Updating...";

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
      alert("Customer updated successfully!");
      sessionStorage.removeItem("editCustomerData");
      window.location.href = "CustomerDetails.html"; // আপডেট শেষে Details পেজে ফিরে যাবে
    } else {
      alert("Error: " + result.message);
    }
  } catch (err) {
    alert("Submission failed. Check network or script URL.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Update Customer";
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