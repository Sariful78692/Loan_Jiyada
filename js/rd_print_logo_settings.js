document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("rd-print-logo-file");
  const preview = document.getElementById("rd-print-logo-preview");
  const defaultLabel = document.getElementById("rd-print-logo-default");
  const saveButton = document.getElementById("save-rd-print-logo");
  const resetButton = document.getElementById("reset-rd-print-logo");
  const showLogo = url => {
    preview.src = url || "";
    preview.hidden = !url;
    defaultLabel.hidden = Boolean(url);
  };

  showLogo(localStorage.getItem("rdPrintLogoDataUrl"));
  fetchAppData("app_settings").then(data => {
    if (data.storage === "database") showLogo(data.logos?.rd || "");
  }).catch(error => console.warn("Could not load the saved RD Print logo.", error));

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
    saveButton.disabled = true;
    try {
      const url = await saveAppLogoToDatabase("rd", file);
      showLogo(url);
      input.value = "";
      showToast("RD Print logo saved to the database.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save the logo.", "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  resetButton.addEventListener("click", async () => {
    resetButton.disabled = true;
    try {
      await deleteAppLogoFromDatabase("rd");
      input.value = "";
      showLogo("");
      showToast("Default RD Print logo restored.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not remove the saved logo.", "error");
    } finally {
      resetButton.disabled = false;
    }
  });
});
