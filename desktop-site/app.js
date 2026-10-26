"use strict";

(() => {
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".primary-nav");

  if (menuButton && navigation) {
    const closeMenu = () => {
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation menu");
      navigation.classList.remove("is-open");
    };

    menuButton.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
      navigation.classList.toggle("is-open", !isOpen);
    });

    navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 801px)").matches) closeMenu();
    });
  }

  const profileContent = {
    "extreme-lite": {
      status: "TEXT-FIRST PRESET",
      name: "Extreme Lite",
      description: "Blocks image requests and recognized visual media, while reducing optional UI clutter and animation work.",
      details: [
        "Blocks all image requests in the main Discord window",
        "Filters recognized video and animated resources",
        "Keeps microphone-only capture available"
      ],
      note: "Avatars, server icons, emoji, stickers, and image previews may be missing."
    },
    balanced: {
      status: "EVERYDAY BALANCE",
      name: "Balanced",
      description: "Keeps still images available while filtering recognizable animation and video resources.",
      details: [
        "Allows still images such as PNG and JPEG",
        "Filters recognizable GIF, APNG, and video resources",
        "Keeps microphone-only capture available"
      ],
      note: "Some visual media with unknown URLs or content types may not be filtered."
    },
    custom: {
      status: "TUNE YOUR EXPERIENCE",
      name: "Custom",
      description: "Choose individual interface and resource-filtering settings instead of using one fixed preset.",
      details: [
        "Adjust image filtering and visual UI options",
        "Tune motion, profile decorations, and promotions",
        "See the trade-offs before changing your setup"
      ],
      note: "Custom settings can allow more visual resources. Performance depends on your device and activity."
    }
  };

  const tabs = Array.from(document.querySelectorAll("[data-profile]"));
  const status = document.getElementById("profile-status");
  const name = document.getElementById("profile-name");
  const description = document.getElementById("profile-description");
  const detailContainer = document.getElementById("profile-details");
  const note = document.getElementById("profile-note");
  const symbol = document.getElementById("profile-symbol");

  function selectProfile(key) {
    const profile = profileContent[key];
    if (!profile) return;

    tabs.forEach((tab) => {
      const selected = tab.dataset.profile === key;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });

    if (status) status.textContent = profile.status;
    if (name) name.textContent = profile.name;
    if (description) description.textContent = profile.description;
    if (note) note.textContent = profile.note;
    if (detailContainer) {
      detailContainer.replaceChildren();
      profile.details.forEach((detail) => {
        const row = document.createElement("div");
        const marker = document.createElement("span");
        const copy = document.createElement("span");
        marker.className = "detail-check";
        marker.textContent = "✓";
        copy.textContent = detail;
        row.append(marker, copy);
        detailContainer.append(row);
      });
    }
    if (symbol) {
      symbol.style.color = key === "balanced" ? "#9de7c0" : key === "custom" ? "#a9c9ff" : "#c0b2ff";
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectProfile(tab.dataset.profile));
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Keep keyboard users oriented when using the mobile navigation.
  if (menuButton && navigation) {
    menuButton.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && navigation.classList.contains("is-open")) {
        const firstLink = navigation.querySelector("a");
        if (firstLink) firstLink.focus();
      }
    });
  }
})();
