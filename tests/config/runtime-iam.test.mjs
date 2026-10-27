import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? files(`${dir}/${d.name}`)
      : d.name.endsWith(".ts")
        ? [`${dir}/${d.name}`]
        : [],
  );
}
test("runtime IAM covers server SDK operations and reviewed deletion inventory", () => {
  const role = readFileSync("docs/staging-runtime-role.yaml", "utf8");
  const permissions = new Set(
    [...role.matchAll(/^\s+- ([\w.]+)$/gm)].map((m) => m[1]),
  );
  const inventory = JSON.parse(
    readFileSync("docs/runtime-delete-operations.json", "utf8"),
  );
  const deletions = new Set();
  const needed = new Set();
  const mapping = {
    get: ["datastore.entities.get"],
    getAll: ["datastore.entities.get"],
    collection: ["datastore.entities.list"],
    set: ["datastore.entities.create", "datastore.entities.update"],
    create: ["datastore.entities.create"],
    update: ["datastore.entities.update"],
    delete: ["datastore.entities.delete"],
    runTransaction: ["datastore.databases.get"],
    getUser: ["firebaseauth.users.get"],
    verifyIdToken: ["firebaseauth.users.get"],
  };
  for (const path of [...files("src/app/api"), ...files("src/lib/server")]) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function walk(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const method = node.expression.name.text;
        const receiver = node.expression.expression.getText(source);
        if (receiver.endsWith(".cookies")) return; // HTTP cookie mutation is not Firestore.
        assert.ok(
          ![
            "recursiveDelete",
            "bulkWriter",
            "batch",
            "deleteUser",
            "deleteUsers",
          ].includes(method),
          `Review new privileged SDK operation ${path}: ${method}`,
        );
        for (const p of Object.hasOwn(mapping, method) ? mapping[method] : []) needed.add(p);
        if (method === "delete") deletions.add(path);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  assert.deepEqual(
    [...deletions].sort(),
    Object.keys(inventory).sort(),
    "Update reviewed deletion inventory for every added/removed deletion path",
  );
  for (const description of Object.values(inventory))
    assert.ok(typeof description === "string" && description.length > 30);
  assert.deepEqual(
    [...permissions].sort(),
    [...needed].sort(),
    "Runtime role must match the reviewed operation set; no unused broad permissions",
  );
  assert.doesNotMatch(
    role,
    /roles\/(owner|editor)|datastore\.\*|firebaseauth\.users\.(delete|create|update)/,
  );
});
