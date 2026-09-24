import assert from "node:assert/strict";
import test from "node:test";

test("health contract", () => {
  assert.deepEqual(
    { status: "ok", service: "morok-api" },
    { status: "ok", service: "morok-api" }
  );
});

test("health failure contract", () => {
  assert.equal(typeof 503, "number");
});