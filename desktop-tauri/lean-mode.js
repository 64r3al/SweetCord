(() => {
  "use strict";
  if (location.protocol !== "https:" || !/(^|\.)discord(?:\.com|\.gg|app\.com|app\.net)$/i.test(location.hostname)) return;

  const styleId = "sweetcord-tauri-lean-style";
  const css = [
    'html #app-mount a[href="/store"],',
    'html #app-mount a[href^="/store/"],',
    'html #app-mount a[href="/shop"],',
    'html #app-mount a[href^="/shop/"],',
    'html #app-mount a[href="/quests"],',
    'html #app-mount a[href^="/quests/"],',
    'html #app-mount a[href="/quest-home"],',
    'html #app-mount a[href^="/quest-home/"],',
    'html #app-mount a[href="/nitro"],',
    'html #app-mount a[href^="/nitro/"],',
    'html #app-mount a[href="/discovery"],',
    'html #app-mount a[href^="/discovery/"],',
    'html #app-mount a[href="/guild-discovery"],',
    'html #app-mount a[href^="/guild-discovery/"],',
    'html #app-mount [data-list-item-id^="shop" i],',
    'html #app-mount [data-list-item-id^="quests" i],',
    'html #app-mount [data-list-item-id^="nitro" i],',
    'html #app-mount [data-list-item-id^="store" i],',
    'html #app-mount [class*="promo" i],',
    'html #app-mount [class*="nitroUpsell" i],',
    'html #app-mount [class*="premiumPromo" i],',
    'html #app-mount [class*="questHome" i],',
    'html #app-mount [class*="questCard" i],',
    'html #app-mount [class*="shopUpsell" i],',
    'html #app-mount [class*="nitroBanner" i],',
    'html #app-mount [class*="profileBanner" i],',
    'html #app-mount [class*="profileEffect" i],',
    'html #app-mount [class*="profileEffects" i],',
    'html #app-mount [class*="avatarDecoration" i],',
    'html #app-mount [class*="profileDecoration" i],',
    'html #app-mount [class*="profilePremium" i] { display: none !important; }',
    'html #app-mount [class*="backdrop" i],',
    'html #app-mount [class*="blur" i] { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }',
    'html #app-mount *, html #app-mount *::before, html #app-mount *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }'
  ].join("\n");

  const root = document.documentElement;
  if (!root) return;
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    (document.head || root).appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;

  const selector = 'img[src*="/avatars/"], img[data-sweetcord-tauri-original-src]';
  const clearSaved = (image) => {
    image.removeAttribute("data-sweetcord-tauri-original-src");
    image.removeAttribute("data-sweetcord-tauri-original-srcset");
    image.removeAttribute("data-sweetcord-tauri-static-src");
  };
  const normalize = (image) => {
    if (!(image instanceof HTMLImageElement)) return;
    const src = image.getAttribute("src") || "";
    const original = image.getAttribute("data-sweetcord-tauri-original-src");
    const stillSrc = image.getAttribute("data-sweetcord-tauri-static-src");
    const pathOnly = src.split(/[?#]/, 1)[0].toLowerCase();
    const lastSegment = pathOnly.slice(pathOnly.lastIndexOf("/") + 1);
    const animated = pathOnly.includes("/avatars/") && lastSegment.startsWith("a_") && lastSegment.endsWith(".gif");
    if (animated) {
      if (!original || original !== src) {
        image.setAttribute("data-sweetcord-tauri-original-src", src);
        image.setAttribute("data-sweetcord-tauri-original-srcset", image.getAttribute("srcset") || "");
      }
      const queryStart = src.search(/[?#]/);
      const base = queryStart < 0 ? src : src.slice(0, queryStart);
      const suffix = queryStart < 0 ? "" : src.slice(queryStart);
      const target = base.slice(0, -4) + ".png" + suffix;
      image.setAttribute("data-sweetcord-tauri-static-src", target);
      image.removeAttribute("srcset");
      if (src !== target) {
        image.addEventListener("error", () => {
          if (image.getAttribute("src") !== target) return;
          const originalSrc = image.getAttribute("data-sweetcord-tauri-original-src");
          const originalSet = image.getAttribute("data-sweetcord-tauri-original-srcset") || "";
          if (originalSrc) image.setAttribute("src", originalSrc);
          if (originalSet) image.setAttribute("srcset", originalSet); else image.removeAttribute("srcset");
          clearSaved(image);
        }, { once: true });
        image.setAttribute("src", target);
      }
    } else if (original && stillSrc && src !== stillSrc) {
      clearSaved(image);
    }
  };
  const processTree = (node) => {
    if (!(node instanceof Element)) return;
    if (node.matches(selector)) normalize(node);
    node.querySelectorAll(selector).forEach(normalize);
  };

  if (!window.__sweetCordTauriObserver) {
    processTree(document.documentElement);
    const pendingNodes = new Set();
    const pendingImages = new Set();
    let queued = false;
    const flush = () => {
      queued = false;
      pendingImages.forEach(normalize);
      pendingNodes.forEach(processTree);
      pendingImages.clear();
      pendingNodes.clear();
    };
    const queue = () => {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(flush);
      }
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          if (record.target instanceof HTMLImageElement && record.target.matches(selector)) pendingImages.add(record.target);
        } else {
          record.addedNodes.forEach((node) => { if (node instanceof Element) pendingNodes.add(node); });
        }
      }
      if (pendingImages.size || pendingNodes.size) queue();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    window.__sweetCordTauriObserver = observer;
  }
})();
