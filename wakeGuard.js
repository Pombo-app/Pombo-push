// pombo-relay/wakeGuard.js
// ============================================
// Replay protection and per-tag rate limiting for wake signals
// ============================================

/**
 * @param {object} [options]
 * @param {number} [options.replayTtlMs] - How long a PoW hash is remembered; must outlast the ±1 epoch window
 * @param {number} [options.ratePerMinute] - Sustained wakes per tag; also the burst size
 * @param {() => number} [options.now]
 */
export function createWakeGuard({ replayTtlMs = 40000, ratePerMinute = 20, now = Date.now } = {}) {
    const seenPows = new Map();
    const buckets = new Map();
    const refillPerMs = ratePerMinute / 60000;

    function isReplay(pow) {
        const t = now();
        const expiresAt = seenPows.get(pow);
        if (expiresAt !== undefined && expiresAt > t) {
            return true;
        }
        seenPows.set(pow, t + replayTtlMs);
        return false;
    }

    /**
     * Takes one token from the tag's bucket.
     * @returns {number} 0 if the wake may go now, otherwise ms until a token is available
     */
    function take(tag) {
        const t = now();
        let bucket = buckets.get(tag);
        if (!bucket) {
            bucket = { tokens: ratePerMinute, at: t };
            buckets.set(tag, bucket);
        }
        bucket.tokens = Math.min(ratePerMinute, bucket.tokens + (t - bucket.at) * refillPerMs);
        bucket.at = t;
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return 0;
        }
        return Math.ceil((1 - bucket.tokens) / refillPerMs);
    }

    function sweep() {
        const t = now();
        for (const [pow, expiresAt] of seenPows) {
            if (expiresAt <= t) seenPows.delete(pow);
        }
        for (const [tag, bucket] of buckets) {
            if (bucket.tokens + (t - bucket.at) * refillPerMs >= ratePerMinute) buckets.delete(tag);
        }
    }

    return { isReplay, take, sweep, sizes: () => ({ pows: seenPows.size, buckets: buckets.size }) };
}
