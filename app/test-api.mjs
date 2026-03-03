import https from "https";

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

(async () => {
  // Yahoo Finance for Silver: SI=F
  console.log("Testing Yahoo Finance for SI=F (Silver Futures)...");
  const data = await httpsGet("https://query1.finance.yahoo.com/v8/finance/chart/SI=F");

  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  console.log("Yahoo Finance Silver Price (per oz):", price);
})();
