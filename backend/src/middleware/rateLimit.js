const buckets = new Map()

function rateLimit({ windowMs = 60_000, limit = 60, key = (req) => req.ip, message = 'Too many requests. Try again shortly.' } = {}) {
  return (req, res, next) => {
    const now = Date.now()
    const bucketKey = key(req)
    const current = buckets.get(bucketKey)
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current
    bucket.count += 1
    buckets.set(bucketKey, bucket)
    res.setHeader('RateLimit-Limit', limit)
    res.setHeader('RateLimit-Remaining', Math.max(0, limit - bucket.count))
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000))
    if (bucket.count > limit) return res.status(429).json({ success: false, message })
    next()
  }
}

const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
}, 60_000)
cleanup.unref()

module.exports = { rateLimit }
