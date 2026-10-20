/**
 * AFROSKANKIN - Contentful integration
 * Loads published content and updates selected page sections.
 * Shopping/cart/payment scripts are intentionally left untouched.
 */
(function () {
  "use strict";

  const config = window.CONTENTFUL_CONFIG;
  if (!config || !config.spaceId || !config.deliveryToken) {
    console.error("Contentful configuration is missing. Check contentful-config.js.");
    return;
  }

  const environment = config.environment || "master";
  const API_URL =
    `https://cdn.contentful.com/spaces/${encodeURIComponent(config.spaceId)}` +
    `/environments/${encodeURIComponent(environment)}/entries`;
  const headers = { Authorization: `Bearer ${config.deliveryToken}` };

  const contentTypes = {
    siteSettings: "siteSettings",
    music: "musicRelease",
    videos: "video",
    gallery: "galleryImage",
    merch: "merchProduct",
    events: "event"
  };

  async function getEntries(contentType, options = {}) {
    const params = new URLSearchParams({
      content_type: contentType,
      limit: String(options.limit || 100),
      include: "2"
    });
    if (options.order) params.set("order", options.order);
    if (options.featured === true) params.set("fields.featured", "true");

    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      throw new Error(`Contentful request failed for "${contentType}": ${response.status}`);
    }

    const data = await response.json();
    const assets = data.includes?.Asset || [];
    return {
      items: (data.items || []).map(entry => ({
        id: entry.sys.id,
        contentType: entry.sys.contentType.sys.id,
        fields: entry.fields || {},
        assets
      })),
      assets
    };
  }

  function assetFromReference(reference, assets = []) {
    if (!reference) return null;
    if (reference.fields?.file) return reference;
    const id = reference.sys?.id || reference.id;
    return id ? assets.find(asset => asset.sys?.id === id) || null : null;
  }

  function getAssetUrl(assetOrReference, assets = []) {
    const asset = assetFromReference(assetOrReference, assets);
    const file = asset?.fields?.file;
    if (!file?.url) return "";
    const url = file.url.startsWith("//") ? `https:${file.url}` : file.url;
    return url.startsWith("http://") ? url.replace("http://", "https://") : url;
  }

  function getImageUrl(entry, fieldName) {
    return getAssetUrl(entry?.fields?.[fieldName], entry?.assets || []);
  }

  function getFields(entry) {
    return entry?.fields || {};
  }

  async function getSiteSettings() {
    const result = await getEntries(contentTypes.siteSettings, { limit: 1 });
    return result.items[0] || null;
  }

  async function loadAllContent() {
    const requests = [
      ["siteSettings", () => getEntries(contentTypes.siteSettings, { limit: 1 })],
      ["music", () => getEntries(contentTypes.music, { order: "-fields.releaseDate" })],
      ["videos", () => getEntries(contentTypes.videos, { order: "fields.displayOrder" })],
      ["gallery", () => getEntries(contentTypes.gallery, { order: "fields.displayOrder" })],
      ["merch", () => getEntries(contentTypes.merch, { order: "fields.displayOrder" })],
      ["events", () => getEntries(contentTypes.events, { order: "fields.eventDate" })]
    ];
    const results = await Promise.allSettled(requests.map(([, request]) => request()));
    const content = {};
    results.forEach((result, index) => {
      const name = requests[index][0];
      if (result.status === "fulfilled") {
        content[name] = result.value.items;
      } else {
        console.error(`Unable to load Contentful content "${name}":`, result.reason);
        content[name] = [];
      }
    });
    return content;
  }

  function firstValue(fields, names) {
    for (const name of names) {
      const value = fields?.[name];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function renderSiteSettings(entries) {
    const entry = entries?.[0];
    if (!entry) return;
    const fields = getFields(entry);

    const bio = firstValue(fields, ["artistBio", "bio"]);
    const bioParagraph = document.querySelector("#bio p");
    if (bio && bioParagraph) bioParagraph.textContent = bio;

    const heroUrl = getImageUrl(entry, "heroImage");
    const heroImage = document.querySelector(".artist-portrait img");
    if (heroUrl && heroImage) {
      heroImage.src = heroUrl;
      heroImage.alt = firstValue(fields, ["siteTitle"]) || heroImage.alt;
    }

    const siteTitle = firstValue(fields, ["siteTitle"]);
    if (siteTitle) document.title = siteTitle;

    const email = firstValue(fields, ["contactEmail"]);
    const emailLink = document.querySelector(".footer-contact a[href^='mailto:']");
    if (email && emailLink) {
      emailLink.href = `mailto:${email}`;
      const label = emailLink.querySelector("span:last-child");
      if (label) label.textContent = email;
    }

    const socials = [
      ["instagramUrl", ".footer-socials a[aria-label='Instagram']"],
      ["youtubeUrl", ".footer-socials a[aria-label='YouTube']"],
      ["spotifyUrl", ".footer-socials a[aria-label='Spotify']"]
    ];
    socials.forEach(([field, selector]) => {
      const value = fields[field];
      const link = document.querySelector(selector);
      if (value && link) link.href = value;
    });
  }

  function toEmbedUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
      const url = new URL(rawUrl, window.location.href);
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0];
        return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : "";
      }
      if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
        const id = url.searchParams.get("v") ||
          url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
        return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : rawUrl;
      }
      if (host.endsWith("vimeo.com")) {
        const id = url.pathname.split("/").filter(Boolean).pop();
        return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : rawUrl;
      }
      return rawUrl;
    } catch (_) {
      return "";
    }
  }

  function renderVideos(entries) {
    const grid = document.querySelector("#videos .videos-grid");
    if (!grid || !entries?.length) return; // Keep current videos as fallback.
    const cards = entries
      .filter(entry => firstValue(entry.fields, ["videoUrl", "url"]))
      .map(entry => {
        const fields = entry.fields;
        const title = firstValue(fields, ["title", "videoTitle"]) || "PayBac Iboro video";
        const url = toEmbedUrl(firstValue(fields, ["videoUrl", "url"]));
        if (!url) return "";
        const card = document.createElement("div");
        card.className = "video-card";
        const frame = document.createElement("div");
        frame.className = "video-frame";
        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.title = title;
        iframe.loading = "lazy";
        iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
        iframe.setAttribute("allowfullscreen", "");
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        frame.appendChild(iframe);
        card.appendChild(frame);
        return card;
      }).filter(Boolean);
    if (cards.length) grid.replaceChildren(...cards);
  }

  function renderGallery(entries) {
    const grid = document.querySelector("#gallery .photos-grid");
    if (!grid || !entries?.length) return; // Keep current gallery as fallback.
    const figures = entries.map((entry, index) => {
      const fields = entry.fields;
      const imageUrl = getImageUrl(entry, "image");
      if (!imageUrl) return null;
      const figure = document.createElement("figure");
      figure.className = "photo-tile" + (index % 5 === 0 ? " photo-tall" : index % 4 === 2 ? " photo-wide" : "");
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = firstValue(fields, ["altText", "caption"]) || "PayBac Iboro photo";
      img.loading = "lazy";
      img.decoding = "async";
      figure.appendChild(img);
      return figure;
    }).filter(Boolean);
    if (figures.length) grid.replaceChildren(...figures);
  }

  async function init() {
    try {
      const content = await loadAllContent();
      renderSiteSettings(content.siteSettings);
      renderVideos(content.videos);
      renderGallery(content.gallery);
      console.info("AFROSKANKIN: Contentful content loaded.", {
        siteSettings: content.siteSettings.length,
        music: content.music.length,
        videos: content.videos.length,
        gallery: content.gallery.length,
        merch: content.merch.length,
        events: content.events.length
      });
    } catch (error) {
      console.error("AFROSKANKIN Contentful initialisation failed:", error);
    }
  }

  window.afroskankinContentful = {
    getEntries,
    getSiteSettings,
    getAssetUrl,
    getImageUrl,
    getFields,
    loadAllContent,
    contentTypes,
    renderSiteSettings,
    renderVideos,
    renderGallery
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
  console.info("AFROSKANKIN Contentful client initialized.");
})();
