import { test } from "node:test";
import assert from "node:assert/strict";
import { recordingRange } from "../../src/lib/drive/range.ts";
test("recording ranges are bounded and malformed or multiple ranges fail", () => {
  assert.deepEqual(recordingRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(recordingRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(recordingRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.equal(recordingRange(null, 100000000).end, 8 * 1024 * 1024 - 1);
  for (const h of [
    "bytes=100-",
    "bytes=20-10",
    "bytes=0-1,3-4",
    "bytes=-0",
    "bytes=-",
    "other",
  ])
    assert.throws(() => recordingRange(h, 100));
});
