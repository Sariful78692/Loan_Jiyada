document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("gold-camera-modal");
  const video = document.getElementById("gold-camera-video");
  const captureButton = document.getElementById("gold-camera-capture");
  let stream = null;
  let targetInput = null;
  let opener = null;

  document.querySelectorAll("[data-camera-target]").forEach(button => {
    button.addEventListener("click", () => openCamera(button));
  });
  document.querySelectorAll("[data-camera-close]").forEach(button => button.addEventListener("click", closeCamera));
  captureButton.addEventListener("click", capturePhoto);
  modal.addEventListener("click", event => { if (event.target === modal) closeCamera(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeCamera(); });

  async function openCamera(button) {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Live camera needs a supported browser and a secure page (HTTPS or localhost).", "error");
      return;
    }
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

  function capturePhoto() {
    if (!targetInput || !video.videoWidth || !video.videoHeight) {
      showToast("Camera is not ready yet. Please wait a moment and try again.", "warning");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      showToast("Could not capture the photo. Please try again.", "error");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        showToast("Could not capture the photo. Please try again.", "error");
        return;
      }
      const file = new File([blob], `${targetInput.id}-${Date.now()}.jpg`, { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      targetInput.files = transfer.files;
      targetInput.dispatchEvent(new Event("change", { bubbles: true }));
      closeCamera();
    }, "image/jpeg", 0.9);
  }
});
