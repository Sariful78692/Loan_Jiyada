const INDUSIND_LOGO_STORAGE_KEY = "indusindBankLogoDataUrl";

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("indusind-logo-file");
  const preview = document.getElementById("indusind-logo-preview");
  const defaultLabel = document.getElementById("indusind-logo-default");
  const saveButton = document.getElementById("save-indusind-logo");
  const resetButton = document.getElementById("reset-indusind-logo");

  const showLogo = dataUrl => {
    if (dataUrl) {
      preview.src = dataUrl;
      preview.hidden = false;
      defaultLabel.hidden = true;
    } else {
      preview.removeAttribute("src");
      preview.hidden = true;
      defaultLabel.hidden = false;
    }
  };

  showLogo(localStorage.getItem(INDUSIND_LOGO_STORAGE_KEY));

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      input.value = "";
      showToast("Choose an image file for the logo.", "error");
      return;
    }
    if (file.size > 1024 * 1024) {
      input.value = "";
      showToast("Logo image must be 1 MB or smaller.", "error");
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    defaultLabel.hidden = true;
  });

  saveButton.addEventListener("click", () => {
    const file = input.files?.[0];
    if (!file) {
      showToast("Choose a logo image before saving.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(INDUSIND_LOGO_STORAGE_KEY, String(reader.result));
        showLogo(String(reader.result));
        input.value = "";
        showToast("IndusInd logo saved. It will appear on the account print form.", "success");
      } catch (error) {
        console.error(error);
        showToast("Could not save the logo. Choose a smaller image.", "error");
      }
    };
    reader.onerror = () => showToast("Could not read the selected logo image.", "error");
    reader.readAsDataURL(file);
  });

  resetButton.addEventListener("click", () => {
    localStorage.removeItem(INDUSIND_LOGO_STORAGE_KEY);
    input.value = "";
    showLogo("");
    showToast("Default IndusInd logo restored.", "success");
  });
});
