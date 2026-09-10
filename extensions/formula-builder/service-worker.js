// Chrome handles toolbar toggling; formula generation stays in the panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => {
  console.error("Could not enable the Formula Builder side panel.", error);
});
