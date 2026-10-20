
/**
 * AFROSKANKIN - Contentful integration
 * Reads published content using the Content Delivery API.
 *
 * Requires contentful-config.js to load first.
 * Does not modify cart, shipping, or payment logic.
 */

(function () {
  "use strict";

  const config = window.CONTENTFUL_CONFIG;

  if (!config || !config.spaceId || !config.deliveryToken) {
    console.error(
      "Contentful configuration is missing. Check contentful-config.js."
    );
    return;
  }

  const environment = config.environment || "master";

  const API_URL =
    `https://cdn.contentful.com/spaces/${encodeURIComponent(config.spaceId)}` +
    `/environments/${encodeURIComponent(environment)}/entries`;

  const headers = {
    Authorization: `Bearer ${config.deliveryToken}`
  };

  const contentTypes = {
    siteSettings: "siteSettings",
    music: "musicRelease",
    videos: "video",
    gallery: "galleryImage",
    merch: "merchProduct",
    events: "event"
  };

  // Retrieve published entries from Contentful.
  async function getEntries(contentType, options = {}) {
    const params = new URLSearchParams({
      content_type: contentType,
      limit: String(options.limit || 100),
      include: "2"
    });

    if (options.order) {
      params.set("order", options.order);
    }

    if (options.featured === true) {
      params.set("fields.featured", "true");
    }

    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: "GET",
      headers
    });

    if (!response.ok) {
      throw new Error(
        `Contentful request failed for "${contentType}": ${response.status}`
      );
    }

    const data = await response.json();

    return {
      items: (data.items || []).map(entry => ({
        id: entry.sys.id,
        contentType: entry.sys.contentType.sys.id,
        fields: entry.fields || {}
      })),
      assets: data.includes?.Asset || []
    };
  }

  // Resolve Contentful asset references to usable image URLs.
  function getAssetUrl(asset) {
    if (!asset) return "";

    const file = asset.fields?.file;
    if (!file?.url) return "";

    return file.url.startsWith("//")
      ? `https:${file.url}`
      : file.url;
  }

  // Get an image URL from a field in a Contentful entry.
  function getImageUrl(entry, fieldName) {
    const image = entry?.fields?.[fieldName];

    if (!image) return "";

    return getAssetUrl(image);
  }

  // Convert an entry's fields into a plain JavaScript object.
  function getFields(entry) {
    return entry?.fields || {};
  }

  // Retrieve the first published Site Settings entry.
  async function getSiteSettings() {
    const result = await getEntries(contentTypes.siteSettings, {
      limit: 1
    });

    return result.items[0] || null;
  }

  // Load all content types in parallel.
  async function loadAllContent() {
    const results = await Promise.allSettled([
      getEntries(contentTypes.siteSettings, { limit: 1 }),
      getEntries(contentTypes.music, { order: "-fields.releaseDate" }),
      getEntries(contentTypes.videos, { order: "fields.displayOrder" }),
      getEntries(contentTypes.gallery, { order: "fields.displayOrder" }),
      getEntries(contentTypes.merch, { order: "fields.displayOrder" }),
      getEntries(contentTypes.events, { order: "fields.eventDate" })
    ]);

    const names = [
      "siteSettings",
      "music",
      "videos",
      "gallery",
      "merch",
      "events"
    ];

    const content = {};

    results.forEach((result, index) => {
      const name = names[index];

      if (result.status === "fulfilled") {
        content[name] = result.value.items;
      } else {
        console.error(
          `Unable to load Contentful content "${name}":`,
          result.reason
        );
        content[name] = [];
      }
    });

    return content;
  }

  // Expose the integration for index.html to use.
  window.afroskankinContentful = {
    getEntries,
    getSiteSettings,
    getAssetUrl,
    getImageUrl,
    getFields,
    loadAllContent,
    contentTypes
  };

  console.info("AFROSKANKIN Contentful client initialized.");
})();

