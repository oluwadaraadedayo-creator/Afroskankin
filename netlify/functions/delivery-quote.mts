const ORIGIN_ADDRESS = "31 Alhaji Mosobolaje Street off Ago Palace Way Okota Isolo, Lagos, Nigeria";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

function calculateDeliveryFee(distanceKm) {
  if (distanceKm <= 5) return 4000;
  if (distanceKm <= 10) return 8000;
  if (distanceKm <= 15) return 12000;
  if (distanceKm <= 20) return 18000;

  const additionalHalfKm = Math.ceil((distanceKm - 20) / 0.5);
  return 18000 + additionalHalfKm * 1000;
}

async function geocode(address, token) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", address);
  url.searchParams.set("limit", "1");
  url.searchParams.set("country", "NG");
  url.searchParams.set("access_token", token);

  const response = await fetch(url);
  if (!response.ok) throw new Error("Geocoding request failed");

  const data = await response.json();
  const coordinates = data?.features?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("Address could not be located");
  }

  return coordinates;
}

async function drivingDistance(origin, destination, token) {
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`);
  url.searchParams.set("overview", "false");
  url.searchParams.set("access_token", token);

  const response = await fetch(url);
  if (!response.ok) throw new Error("Routing request failed");

  const data = await response.json();
  const meters = data?.routes?.[0]?.distance;

  if (typeof meters !== "number") {
    throw new Error("Driving route could not be calculated");
  }

  return meters / 1000;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type"
      }
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const token = Netlify.env.get("MAPBOX_ACCESS_TOKEN");

    if (!token) {
      return json({ error: "Delivery service is not configured" }, 503);
    }

    const body = await req.json();
    const address = typeof body?.address === "string" ? body.address.trim() : "";

    if (!address) {
      return json({ error: "Delivery address is required" }, 400);
    }

    const destination = await geocode(address, token);
    const origin = await geocode(ORIGIN_ADDRESS, token);
    const distanceKm = await drivingDistance(origin, destination, token);
    const deliveryFee = calculateDeliveryFee(distanceKm);

    return json({
      origin: ORIGIN_ADDRESS,
      destination: address,
      distanceKm: Number(distanceKm.toFixed(2)),
      deliveryFee,
      currency: "NGN"
    });
  } catch (error) {
    console.error("Delivery quote error:", error);
    return json({ error: "Unable to calculate delivery for this address" }, 422);
  }
};

export const config = {
  path: "/api/delivery-quote"
};
