import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonNumber, titleFromFile } from "../../src/lib/drive/names.ts";
test("lesson numbers support Arabic, Persian and Latin digits without guessing years", () => {
  for (const name of [
    "الدرس ٠١٢ - عنوان.mp3",
    "lesson 12.mp4",
    "درس ۱۲.wav",
    "12 - title.m4a",
  ])
    assert.equal(lessonNumber(name), 12);
  for (const name of ["2024-05-12.mp3", "عنوان بلا رقم.mp3"])
    assert.equal(lessonNumber(name), null);
  assert.equal(titleFromFile("عنوان.mp3"), "عنوان");
});
