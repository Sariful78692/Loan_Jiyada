window.validatePhotoSize = function (input) {
  const file = input.files?.[0];
  const error = document.getElementById("photo-error");
  if (file && file.size > 1024 * 1024) {
    if (error) error.style.display = "block";
    input.value = "";
  } else if (error) {
    error.style.display = "none";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("customer-camera-modal");
  const video = document.getElementById("customer-camera-video");
  const photoInput = document.getElementById("photoInput");
  const openButton = document.getElementById("customer-live-photo");
  const captureButton = document.getElementById("capture-customer-photo");
  let stream = null;

  openButton.addEventListener("click", openCamera);
  ["close-customer-camera", "cancel-customer-camera"].forEach(id => document.getElementById(id).addEventListener("click", closeCamera));
  captureButton.addEventListener("click", capturePhoto);
  modal.addEventListener("click", event => { if (event.target === modal) closeCamera(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeCamera(); });

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Live camera needs a supported browser and a secure page (HTTPS or localhost).", "error");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      video.srcObject = stream;
      modal.hidden = false;
      await video.play();
      captureButton.focus();
    } catch (error) {
      console.error(error);
      closeCamera();
      showToast(error.name === "NotAllowedError" ? "Allow camera access in your browser to take a live photo." : "Could not open the camera. Check that it is connected and not in use.", "error");
    }
  }

  function closeCamera() {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    modal.hidden = true;
    openButton.focus();
  }

  async function capturePhoto() {
    if (!video.videoWidth || !video.videoHeight) {
      showToast("Camera is not ready yet. Please wait a moment and try again.", "warning");
      return;
    }
    try {
      const file = await captureCompressedPhoto(video);
      if (file.size > 1024 * 1024) throw new Error("The captured photo is too large. Please try again.");
      const transfer = new DataTransfer();
      transfer.items.add(file);
      photoInput.files = transfer.files;
      photoInput.dispatchEvent(new Event("change", { bubbles: true }));
      closeCamera();
    } catch (error) {
      showToast(error.message || "Could not capture the photo. Please try again.", "error");
    }
  }
});

async function captureCompressedPhoto(video) {
  const scale = Math.min(1, 1200 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not capture the photo. Please try again.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.68, 0.54]) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Could not capture the photo. Please try again.");
    if (blob.size <= 1024 * 1024) return new File([blob], `customer-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
  }
  throw new Error("The captured photo is too large. Please try again.");
}
