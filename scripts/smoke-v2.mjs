const base = (process.env.SMOKE_API_URL || "http://localhost:3000").replace(/\/$/, "");
async function check(path, options) {
  const response = await fetch(base + path, options);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}
await check("/api/v2/health");
const vehicles = await (await check("/api/v2/vehicles?limit=1")).json();
if (!vehicles.data?.[0]?.id) throw new Error("El catálogo no devolvió vehículos");
await check(`/api/v2/vehicles/${vehicles.data[0].id}`);
await check("/swagger");
if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) await check("/api/v2/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD }) });
console.log("Smoke V2 OK");
