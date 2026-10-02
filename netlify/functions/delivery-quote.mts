const ORIGIN_ADDRESS = "31 Alhaji Mosobolaje Street off Ago Palace Way Okota Isolo, Lagos, Nigeria";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function calculateDeliveryFee(distanceKm) {
  if (distanceKm <= 5) return 4000;
  if (distanceKm <= 10) return 8000;
  if (distanceKm <= 15) return 12000;
  if (distanceKm <= 20) return 18000;
  return 18000 + Math.ceil((distanceKm - 20) / 0.5) * 1000;
}

async function geocode(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ng");

  const response = await fetch(url, {
    headers: { "User-Agent": "Afroskankin-Store/1.0" }
  });

  if (!response.ok) throw new Error("Geocoding request failed");

  const data = await response.json();
  if (!data?.[0]?.lat || !data?.[0]?.lon) {
    throw new Error("Address could not be located");
  }

  return [Number(data[0].lon), Number(data[0].lat)];
}

async function drivingDistance(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const response = await fetch(url + "?overview=false");

  if (!response.ok) throw new Error("Routing request failed");

  const data = await response.json();
  const meters = data?.routes?.[0]?.distance;

  if (typeof meters !== "number") {
    throw new Error("Driving route could not be calculated");
  }

  return meters / 1000;
}

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const address = typeof body?.address === "string" ? body.address.trim() : "";

    if (!address) {
      return json({ error: "Delivery address is required" }, 400);
    }

    const [origin, destination] = await Promise.all([
      geocode(ORIGIN_ADDRESS),
      geocode(address)
    ]);

    const distanceKm = await drivingDistance(origin, destination);
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
