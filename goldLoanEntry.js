document.addEventListener("DOMContentLoaded", function () {
  generateGoldApplicationId();
});

async function generateGoldApplicationId() {
  const appNoField = document.getElementById("applicationNo") || document.querySelector("input[placeholder*='Auto']");
  
  if (!appNoField) return;

  // ইনস্ট্যান্ট দেখানোর জন্য একটি ডিফল্ট সেট করে দেওয়া
  appNoField.value = "AppGold-1";
  appNoField.readOnly = true;

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?t=" + new Date().getTime());
    const data = await res.json();
    const goldLoans = data.gold_loans || [];
    
    if (goldLoans.length > 0) {
      const lastItem = goldLoans[goldLoans.length - 1];
      const lastId = lastItem["Application No"] || lastItem["applicationNo"] || "";
      
      if (lastId.includes("AppGold-")) {
        const numPart = parseInt(lastId.replace("AppGold-", "")) || 0;
        appNoField.value = `AppGold-${numPart + 1}`;
      } else {
        appNoField.value = `AppGold-${goldLoans.length + 1}`;
      }
    }
  } catch (err) {
    console.error("Could not fetch latest application number, using default.", err);
  }
}