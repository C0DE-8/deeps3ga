function normalizeBaseUrl(dbmsUrl) {
  if (!dbmsUrl) {
    throw new Error("DBMS_URL is required");
  }

  return dbmsUrl.replace(/\/+$/, "");
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`DBMS Gateway returned invalid JSON: ${error.message}`);
  }
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(timeoutMs));

  return { signal: controller.signal, timeout };
}

function connectProject(siteId, options = {}) {
  const apiKey = options.apiKey;
  const dbmsUrl = normalizeBaseUrl(options.dbmsUrl);
  const timeoutMs = Number(options.timeoutMs || 15000);

  if (!siteId) {
    throw new Error("SITE_ID is required");
  }

  if (!apiKey) {
    throw new Error("API_KEY is required");
  }

  async function request(path, init = {}) {
    const { signal, timeout } = createTimeoutSignal(timeoutMs);

    try {
      const response = await fetch(`${dbmsUrl}${path}`, {
        ...init,
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-site-id": siteId,
          "x-api-key": apiKey,
          ...(init.headers || {})
        }
      });

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload.error || payload.message || `DBMS Gateway request failed with status ${response.status}`);
      }

      return payload;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`DBMS Gateway request timed out after ${timeoutMs}ms`);
      }

      if (error.cause?.code) {
        throw new Error(`DBMS Gateway request failed: ${error.cause.code}`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function query(sql, params = []) {
    const payload = await request("/gateway/query", {
      method: "POST",
      body: JSON.stringify({ sql, params })
    });

    return payload.rows || [];
  }

  return {
    query,
    execute: query,
    status() {
      return request("/gateway/status", {
        method: "GET"
      });
    }
  };
}

module.exports = {
  connectProject
};
