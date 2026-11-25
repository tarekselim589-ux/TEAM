/* TEAM — كاش علشان التطبيق يفتح بسرعة حتى مع نت ضعيف.
   يترفع في نفس الفولدر اللي فيه index.html. */
const PREFIX = "team";
const V = PREFIX + "-v1";
const CORE = ["./", "./index.html"];
const FBV = "https://www.gstatic.com/firebasejs/10.12.2/";
const FBMODS = [FBV + "firebase-app.js", FBV + "firebase-auth.js", FBV + "firebase-firestore.js"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(
        CORE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))
          .concat(FBMODS.map(u => c.add(u).catch(() => {})))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      // يمسح بس كاشات التطبيق ده — باقي التطبيقات على نفس الدومين ماتتلمسش
      .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX + "-") && k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// الدخول وفايرستور لازم يروحوا للنت على طول — مالهمش كاش
const LIVE = /identitytoolkit|securetoken|firestore\.googleapis|firebaseinstallations|google-analytics|googleapis\.com\/(?!css)/;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (LIVE.test(req.url)) return;

  // صفحة التطبيق: يفتح من الكاش على طول، ويجيب آخر نسخة من النت في الخلفية (تظهر المرة الجاية)
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(V);
      const cached = await cache.match("./index.html");
      const net = fetch(req.url, { cache: "no-cache" }).then(r => {
        if (r && r.ok && !r.redirected) cache.put("./index.html", r.clone()).catch(() => {});
        return r;
      });
      e.waitUntil(net.catch(() => {}));
      if (!cached) return fetch(req);
      return cached;
    })());
    return;
  }

  // باقي الملفات (فايربيز، الأيقونات...): الكاش الأول وبعدين النت
  e.respondWith(
    caches.open(V).then(c => c.match(req, { ignoreVary: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(r => {
        if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()).catch(() => {});
        return r;
      });
    }))
  );
});
