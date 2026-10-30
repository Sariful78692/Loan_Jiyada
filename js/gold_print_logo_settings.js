document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("gold-print-logo-file");
  const preview = document.getElementById("gold-print-logo-preview");
  const defaultLabel = document.getElementById("gold-print-logo-default");
  const saveButton = document.getElementById("save-gold-print-logo");
  const resetButton = document.getElementById("reset-gold-print-logo");
  const showLogo = url => {
    preview.src = url || "";
    preview.hidden = !url;
    defaultLabel.hidden = Boolean(url);
  };

  showLogo(localStorage.getItem("goldPrintLogoDataUrl"));
  fetchAppData("app_settings").then(data => {
    if (data.storage === "database") showLogo(data.logos?.gold || "");
  }).catch(error => console.warn("Could not load the saved Gold Print logo.", error));

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) {
      input.value = "";
      showToast(file.type.startsWith("image/") ? "Logo image must be 1 MB or smaller." : "Choose an image file for the logo.", "error");
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    defaultLabel.hidden = true;
  });

  saveButton.addEventListener("click", async () => {
    const file = input.files?.[0];
    if (!file) return showToast("Choose a logo image before saving.", "warning");
    const originalLabel = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
    saveButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Saving...';
    try {
      const url = await saveAppLogoToDatabase("gold", file);
      showLogo(url);
      input.value = "";
      showToast("Gold Print logo saved to the database.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save the logo.", "error");
    } finally {
      saveButton.disabled = false;
      saveButton.removeAttribute("aria-busy");
      saveButton.innerHTML = originalLabel;
    }
  });

  resetButton.addEventListener("click", async () => {
    resetButton.disabled = true;
    try {
      await deleteAppLogoFromDatabase("gold");
      input.value = "";
      showLogo("");
      showToast("Gold Print logo removed.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not remove the saved logo.", "error");
    } finally {
      resetButton.disabled = false;
    }
  });
});
