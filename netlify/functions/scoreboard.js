const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

exports.handler = async (event) => {
  const date = String(event.queryStringParameters?.date || "").replace(/[^0-9]/g, "");

  if (!/^\d{8}$/.test(date)) {
    return jsonResponse(400, { error: "Expected date=YYYYMMDD" });
  }

  try {
    const response = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${date}`, {
      headers: {
        accept: "application/json",
        "user-agent": "world-cup-pool-calculator/1.0",
      },
    });

    if (!response.ok) {
      return jsonResponse(response.status, { error: `ESPN returned ${response.status}` });
    }

    return jsonResponse(200, await response.json());
  } catch (error) {
    return jsonResponse(502, { error: error.message || "ESPN request failed" });
  }
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
