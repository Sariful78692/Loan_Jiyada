const GOLD_PRINT_LOGO_KEY = "goldPrintLogoDataUrl";

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("gold-print-logo-file");
  const preview = document.getElementById("gold-print-logo-preview");
  const defaultLabel = document.getElementById("gold-print-logo-default");
  const showLogo = dataUrl => {
    preview.src = dataUrl || "";
    preview.hidden = !dataUrl;
    defaultLabel.hidden = Boolean(dataUrl);
  };

  showLogo(localStorage.getItem(GOLD_PRINT_LOGO_KEY));
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

  document.getElementById("save-gold-print-logo").addEventListener("click", () => {
    const file = input.files?.[0];
    if (!file) return showToast("Choose a logo image before saving.", "warning");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(GOLD_PRINT_LOGO_KEY, String(reader.result));
        showLogo(String(reader.result));
        input.value = "";
        showToast("Gold print logo saved.", "success");
      } catch (error) {
        console.error(error);
        showToast("Could not save the logo. Choose a smaller image.", "error");
      }
    };
    reader.onerror = () => showToast("Could not read the selected logo image.", "error");
    reader.readAsDataURL(file);
  });

  document.getElementById("reset-gold-print-logo").addEventListener("click", () => {
    localStorage.removeItem(GOLD_PRINT_LOGO_KEY);
    input.value = "";
    showLogo("");
    showToast("Gold print logo removed.", "success");
  });
});
