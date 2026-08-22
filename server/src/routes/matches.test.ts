import { describe, expect, it, vi } from "vitest";

vi.mock("../controllers/matches.js", () => ({
  listMatchesController: vi.fn(),
  createMatchController: vi.fn(),
  updateScoreController: vi.fn(),
}));

import {
  createMatchController,
  listMatchesController,
  updateScoreController,
} from "../controllers/matches.js";
import { matchRouter } from "./matches.js";

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown }[];
  };
};

function findLayer(method: string, path: string) {
  const stack = (matchRouter as unknown as { stack: RouteLayer[] }).stack;
  return stack.find(
    (layer) => layer.route?.path === path && layer.route?.methods[method],
  );
}

describe("matchRouter", () => {
  it("registers GET / wired to listMatchesController", () => {
    const layer = findLayer("get", "/");

    expect(layer).toBeDefined();
    expect(layer!.route!.stack[0].handle).toBe(listMatchesController);
  });

  it("registers POST / wired to createMatchController", () => {
    const layer = findLayer("post", "/");

    expect(layer).toBeDefined();
    expect(layer!.route!.stack[0].handle).toBe(createMatchController);
  });

  it("registers PATCH /:id/score wired to updateScoreController", () => {
    const layer = findLayer("patch", "/:id/score");

    expect(layer).toBeDefined();
    expect(layer!.route!.stack[0].handle).toBe(updateScoreController);
  });

  it("does not register any other routes", () => {
    const stack = (matchRouter as unknown as { stack: RouteLayer[] }).stack;
    const routes = stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route!.path,
        methods: Object.keys(layer.route!.methods),
      }));

    expect(routes).toEqual([
      { path: "/", methods: ["get"] },
      { path: "/", methods: ["post"] },
      { path: "/:id/score", methods: ["patch"] },
    ]);
  });
});