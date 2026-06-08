const dir = "C:/Users/mdhyu/Desktop/claude/k-saju";
Bun.serve({
  port: 8911,
  fetch(req) {
    let p = new URL(req.url).pathname;
    if (p === "/") p = "/demo.html";
    return new Response(Bun.file(dir + p));
  },
});
console.log("K-Saju demo serving on http://localhost:8799");
