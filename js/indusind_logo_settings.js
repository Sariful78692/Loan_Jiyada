document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("indusind-logo-file");
  const preview = document.getElementById("indusind-logo-preview");
  const defaultLabel = document.getElementById("indusind-logo-default");
  const saveButton = document.getElementById("save-indusind-logo");
  const resetButton = document.getElementById("reset-indusind-logo");
  const showLogo = url => {
    preview.src = url || "";
    preview.hidden = !url;
    defaultLabel.hidden = Boolean(url);
  };

  showLogo(localStorage.getItem("indusindBankLogoDataUrl"));
  fetchAppData("app_settings").then(data => {
    if (data.storage === "database") showLogo(data.logos?.indusind || "");
  }).catch(error => console.warn("Could not load the saved IndusInd logo.", error));

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
      const url = await saveAppLogoToDatabase("indusind", file);
      showLogo(url);
      input.value = "";
      showToast("IndusInd logo saved to the database.", "success");
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
      await deleteAppLogoFromDatabase("indusind");
      input.value = "";
      showLogo("");
      showToast("Default IndusInd logo restored.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not remove the saved logo.", "error");
    } finally {
      resetButton.disabled = false;
    }
  });
});
