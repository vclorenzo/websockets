import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApp = {
  use: vi.fn(),
  get: vi.fn(),
  listen: vi.fn((_port: unknown, cb?: () => void) => {
    cb?.();
    return { close: vi.fn() };
  }),
};

vi.mock("express", () => {
  const expressFactory: any = vi.fn(() => mockApp);
  expressFactory.json = vi.fn(() => "json-middleware");
  return { default: expressFactory };
});

vi.mock("./routes/matches.js", () => ({
  matchRouter: "mock-match-router",
}));

describe("index.ts", () => {
  const originalPort = process.env.PORT;

  beforeEach(() => {
    vi.resetModules();
    mockApp.use.mockClear();
    mockApp.get.mockClear();
    mockApp.listen.mockClear();
  });

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it("registers the JSON body-parsing middleware", async () => {
    await import("./index.js");

    expect(mockApp.use).toHaveBeenCalledWith("json-middleware");
  });

  it("mounts matchRouter at /matches", async () => {
    await import("./index.js");

    expect(mockApp.use).toHaveBeenCalledWith(
      "/matches",
      "mock-match-router",
    );
  });

  it("registers a root GET handler that responds with Hello World", async () => {
    await import("./index.js");

    const rootCall = mockApp.get.mock.calls.find(
      ([path]) => path === "/",
    );
    expect(rootCall).toBeDefined();

    const handler = rootCall![1] as (req: unknown, res: unknown) => void;
    const res = { send: vi.fn() };
    handler({}, res);

    expect(res.send).toHaveBeenCalledWith("Hello World");
  });

  it("listens on the port configured via the PORT env var", async () => {
    process.env.PORT = "1234";

    await import("./index.js");

    expect(mockApp.listen).toHaveBeenCalledWith(
      "1234",
      expect.any(Function),
    );
  });

  it("defaults to port 8000 when PORT is not set", async () => {
    delete process.env.PORT;

    await import("./index.js");

    expect(mockApp.listen).toHaveBeenCalledWith(
      8000,
      expect.any(Function),
    );
  });
});