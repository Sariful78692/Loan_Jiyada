document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("personal-loan-camera-modal");
  const video = document.getElementById("personal-loan-camera-video");
  const captureButton = document.getElementById("personal-loan-camera-capture");
  let stream = null, targetInput = null, opener = null;
  document.querySelectorAll("[data-camera-target]").forEach(button => button.addEventListener("click", () => openCamera(button)));
  document.querySelectorAll("[data-camera-close]").forEach(button => button.addEventListener("click", closeCamera));
  captureButton.addEventListener("click", capturePhoto);
  modal.addEventListener("click", event => { if (event.target === modal) closeCamera(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeCamera(); });

  async function openCamera(button) {
    if (!navigator.mediaDevices?.getUserMedia) { showToast("Live camera needs a supported browser and a secure page (HTTPS or localhost).", "error"); return; }
    targetInput = document.getElementById(button.dataset.cameraTarget);
    opener = button;
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
    opener?.focus();
    opener = null;
  }

  async function capturePhoto() {
    if (!targetInput || !video.videoWidth || !video.videoHeight) { showToast("Camera is not ready yet. Please wait a moment and try again.", "warning"); return; }
    const scale = Math.min(1, 1200 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) { showToast("Could not capture the photo. Please try again.", "error"); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.68, 0.54]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) continue;
      if (blob.size > 1024 * 1024) continue;
      const file = new File([blob], `${targetInput.id}-${Date.now()}.jpg`, { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      targetInput.files = transfer.files;
      targetInput.dispatchEvent(new Event("change", { bubbles: true }));
      closeCamera();
      return;
    }
    showToast("Could not compress the photo below 1 MB. Please try again.", "error");
  }
});
