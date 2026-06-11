const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

module.exports = async function handler(req, res) {
  const date = String(req.query?.date || "").replace(/[^0-9]/g, "");

  if (!/^\d{8}$/.test(date)) {
    res.status(400).json({ error: "Expected date=YYYYMMDD" });
    return;
  }

  try {
    const response = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${date}`, {
      headers: {
        accept: "application/json",
        "user-agent": "world-cup-pool-calculator/1.0",
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `ESPN returned ${response.status}` });
      return;
    }

    res.setHeader("cache-control", "no-store");
    res.status(200).json(await response.json());
  } catch (error) {
    res.status(502).json({ error: error.message || "ESPN request failed" });
  }
};
