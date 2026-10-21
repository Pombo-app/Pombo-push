import test from 'node:test';
import assert from 'node:assert/strict';
import { createWakeGuard } from '../wakeGuard.js';

function clock(start = 1_000_000) {
    let t = start;
    return { now: () => t, advance: (ms) => { t += ms; } };
}

test('a PoW is rejected when seen again within the TTL', () => {
    const c = clock();
    const guard = createWakeGuard({ now: c.now });
    assert.equal(guard.isReplay('0xabc'), false);
    c.advance(39_000);
    assert.equal(guard.isReplay('0xabc'), true);
});

test('a PoW is accepted again once the TTL has passed', () => {
    const c = clock();
    const guard = createWakeGuard({ now: c.now });
    guard.isReplay('0xabc');
    c.advance(40_000);
    assert.equal(guard.isReplay('0xabc'), false);
});

test('a replay does not extend the remembered window', () => {
    const c = clock();
    const guard = createWakeGuard({ now: c.now });
    guard.isReplay('0xabc');
    c.advance(30_000);
    guard.isReplay('0xabc');
    c.advance(10_000);
    assert.equal(guard.isReplay('0xabc'), false);
});

test('a tag may burst up to the rate, then waits for one token', () => {
    const c = clock();
    const guard = createWakeGuard({ ratePerMinute: 20, now: c.now });
    for (let i = 0; i < 20; i++) assert.equal(guard.take('t1'), 0);
    assert.equal(guard.take('t1'), 3000);
});

test('tokens refill over time', () => {
    const c = clock();
    const guard = createWakeGuard({ ratePerMinute: 20, now: c.now });
    for (let i = 0; i < 20; i++) guard.take('t1');
    c.advance(3000);
    assert.equal(guard.take('t1'), 0);
    assert.ok(guard.take('t1') > 0);
});

test('a throttled tag does not affect other tags', () => {
    const c = clock();
    const guard = createWakeGuard({ ratePerMinute: 2, now: c.now });
    guard.take('t1');
    guard.take('t1');
    assert.ok(guard.take('t1') > 0);
    assert.equal(guard.take('t2'), 0);
});

test('sweep drops expired PoWs and refilled buckets only', () => {
    const c = clock();
    const guard = createWakeGuard({ ratePerMinute: 20, now: c.now });
    guard.isReplay('0xold');
    guard.take('idle');
    c.advance(30_000);
    guard.isReplay('0xnew');
    for (let i = 0; i < 20; i++) guard.take('busy');
    c.advance(10_000);
    guard.sweep();
    assert.deepEqual(guard.sizes(), { pows: 1, buckets: 1 });
    assert.equal(guard.isReplay('0xnew'), true);
});
