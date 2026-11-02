const API = process.env.API || "http://localhost: 3000";
const KEY = process.env.KEY;
const N = Number(process.env.N || 60);

const mix = [
  { method: "GET", path: "/tasks", key: true },
  { method: "GET", path: "/tasks", key: true },
  { method: "GET", path: "/tasks/1", key: true },
  { method: "GET", path: "/tasks/99", key: true },
  { method: "GET", path: "/tasks", key: false },
  { method: "GET", path: "/not-a-route", key: true },
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const counts = {};
  for (let i = 0; i < N; i++) {
    const r = mix[Math.floor(Math.random() * mix.length)];
    try {
      const res = await fetch(API + r.path, {
        method: r.method,
        headers: r.key ? { "X-API-Key": KEY } : {},
      });
      counts[res.status] = (counts[res.status] || 0) + 1;
    } catch (err) {
      counts.failed = (counts.failed || 0) + 1;
    }
    await pause(50);
  }
  console.log("Status codes received:", counts);
})();
