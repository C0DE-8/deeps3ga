const crypto = require("crypto");

const tokenTtlMs = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.AUTH_TOKEN_SECRET || process.env.API_KEY;
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function createToken(player) {
  const secret = getSecret();

  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET or API_KEY is required");
  }

  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub: player.player_id,
    email: player.email,
    exp: Date.now() + tokenTtlMs
  });

  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`;
}

function verifyToken(token) {
  const secret = getSecret();
  const [header, payload, signature] = String(token || "").split(".");

  if (!secret || !header || !payload || !signature) {
    return null;
  }

  const expected = sign(`${header}.${payload}`, secret);
  const provided = Buffer.from(signature);
  const actual = Buffer.from(expected);

  if (provided.length !== actual.length || !crypto.timingSafeEqual(provided, actual)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (!data.exp || data.exp < Date.now()) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

module.exports = {
  createToken,
  verifyToken
};
