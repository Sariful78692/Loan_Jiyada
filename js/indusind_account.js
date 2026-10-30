document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("indusind-account-form");
  const photoInput = document.getElementById("customerPhoto");
  const photoPreview = document.getElementById("customerPhotoPreview");
  const photoPlaceholder = document.getElementById("photoPlaceholder");
  const accountIdInput = document.getElementById("indusind-account-id");
  const saveButton = document.getElementById("save-account-form");
  const printButton = document.getElementById("print-account-form");
  const photoUrlInput = document.getElementById("existing-photo-url");
  const cameraModal = document.getElementById("camera-modal");
  const cameraVideo = document.getElementById("camera-video");
  let cameraStream = null;
  const editId = new URLSearchParams(window.location.search).get("id");

  if (editId) loadIndusindAccountForEdit(editId);

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      photoInput.value = "";
      alert("Please choose an image file.");
      return;
    }
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
  });

  document.getElementById("open-camera").addEventListener("click", openLiveCamera);
  document.getElementById("capture-photo").addEventListener("click", captureLivePhoto);
  ["close-camera", "cancel-camera"].forEach(id => document.getElementById(id).addEventListener("click", closeLiveCamera));
  cameraModal.addEventListener("click", event => { if (event.target === cameraModal) closeLiveCamera(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !cameraModal.hidden) closeLiveCamera(); });

  form.addEventListener("submit", saveIndusindAccount);
  document.getElementById("clear-account-form").addEventListener("click", () => {
    form.reset();
    accountIdInput.value = "";
    photoUrlInput.value = "";
    printButton.hidden = true;
    document.querySelector(".indusind-header h1").textContent = "New Account Entry";
    saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Account';
    photoPreview.removeAttribute("src");
    photoPreview.hidden = true;
    photoPlaceholder.hidden = false;
  });
  document.getElementById("print-account-form").addEventListener("click", () => {
    renderIndusindPrintSheet();
    window.print();
  });

  async function openLiveCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Live camera needs a supported browser and a secure page (HTTPS or localhost).", "error");
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      cameraVideo.srcObject = cameraStream;
      cameraModal.hidden = false;
      await cameraVideo.play();
      document.getElementById("capture-photo").focus();
    } catch (error) {
      console.error(error);
      closeLiveCamera();
      showToast(error.name === "NotAllowedError" ? "Allow camera access in your browser to take a live photo." : "Could not open the camera. Check that it is connected and not in use.", "error");
    }
  }

  function closeLiveCamera() {
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    cameraVideo.srcObject = null;
    cameraModal.hidden = true;
    document.getElementById("open-camera").focus();
  }

  function captureLivePhoto() {
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      showToast("Camera is not ready yet. Please wait a moment and try again.", "warning");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    canvas.getContext("2d").drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        showToast("Could not capture the photo. Please try again.", "error");
        return;
      }
      const photoFile = new File([blob], `indusind-customer-${Date.now()}.jpg`, { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(photoFile);
      photoInput.files = transfer.files;
      photoInput.dispatchEvent(new Event("change", { bubbles: true }));
      closeLiveCamera();
    }, "image/jpeg", 0.9);
  }

  async function loadIndusindAccountForEdit(id) {
    try {
      const data = await fetchAppData("indusind_accounts", true);
      const account = (data.indusind_accounts || []).find(item => String(item.ID) === String(id));
      if (!account) throw new Error("Account record not found.");
      accountIdInput.value = account.ID;
      Array.from(form.elements).forEach(field => {
        if (field.name && field.name !== "id" && field.name !== "customerPhoto" && account[field.name] !== undefined) {
          field.value = account[field.name] ?? "";
        }
      });
      photoUrlInput.value = account["Photo URL"] || "";
      if (photoUrlInput.value) {
        photoPreview.src = photoUrlInput.value;
        photoPreview.hidden = false;
        photoPlaceholder.hidden = true;
      }
      printButton.hidden = false;
      document.querySelector(".indusind-header h1").textContent = "Edit Account Details";
      saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Account';
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not load account details.", "error");
    }
  }

  async function saveIndusindAccount(event) {
    event.preventDefault();
    saveButton.disabled = true;
    const originalLabel = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
    try {
      const account = Object.fromEntries(Array.from(form.elements)
        .filter(field => field.name && field.name !== "id" && field.name !== "customerPhoto")
        .map(field => [field.name, field.value]));
      const photoFile = photoInput.files?.[0];
      const photoBase64 = photoFile ? await readIndusindPhoto(photoFile) : "";
      const id = accountIdInput.value;
      const response = await postAppData({
        action: id ? "update_indusind_account" : "create_indusind_account",
        id,
        account,
        photoBase64,
        photoMimeType: photoFile?.type || "",
        photoName: photoFile?.name || "",
        existingPhotoUrl: photoUrlInput.value
      });
      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(result.message || "Could not save this account.");
      accountIdInput.value = result.id || id;
      if (result.photoUrl) photoUrlInput.value = result.photoUrl;
      printButton.hidden = false;
      document.querySelector(".indusind-header h1").textContent = "Edit Account Details";
      saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Account';
      showToast(id ? "Account details updated successfully." : "Account details saved successfully.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save this account.", "error");
    } finally {
      saveButton.disabled = false;
      if (!accountIdInput.value) saveButton.innerHTML = originalLabel;
    }
  }
});

window.addEventListener("beforeprint", renderIndusindPrintSheet);

function renderIndusindPrintSheet() {
  const ids = ["branchName", "branchIfsc", "branchAddress", "accountType", "accountNumber", "openedOn", "issueDate", "holderName", "customerId", "guardianName", "dateOfBirth", "aadhaarNumber", "panNumber", "mobileNumber", "emailId", "operatedBy"];
  ids.forEach(id => {
    const field = document.getElementById(id);
    document.querySelectorAll(`[data-print-value="${id}"]`).forEach(target => {
      target.textContent = ["openedOn", "issueDate", "dateOfBirth"].includes(id) ? formatPrintDate(field?.value) : (field?.value || "");
    });
  });

  const addressParts = {
    locality: ["village", "postOffice"],
    region: ["policeStation", "district"],
    statePin: ["state", "pinCode"]
  };
  Object.entries(addressParts).forEach(([key, ids]) => {
    const value = ids.map(id => document.getElementById(id)?.value.trim()).filter(Boolean).join(", ");
    const target = document.querySelector(`[data-print-address="${key}"]`);
    if (target) target.textContent = value;
  });

  const preview = document.getElementById("customerPhotoPreview");
  const savedPhotoUrl = document.getElementById("existing-photo-url")?.value || "";
  const photo = preview && !preview.hidden ? preview.src : savedPhotoUrl;
  const printPhoto = document.getElementById("print-customer-photo");
  const placeholder = document.getElementById("print-photo-placeholder");
  if (photo) {
    printPhoto.src = photo;
    placeholder.hidden = true;
  } else {
    printPhoto.removeAttribute("src");
    placeholder.hidden = false;
  }
}

function formatPrintDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : (value || "");
}

function readIndusindPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.readAsDataURL(file);
  });
}
