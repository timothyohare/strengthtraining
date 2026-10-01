import { describe, expect, it } from "vitest";
import { publicUrl, redirectTo } from "../redirect";

// Behind Amplify's proxy, request.url reports the internal host
// (localhost:3000), so redirects must not be built from it.
describe("redirectTo", () => {
  it("sends a relative Location so the browser keeps its own host", () => {
    const response = redirectTo("/today", 303);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/today");
  });

  it("defaults to a 307 temporary redirect", () => {
    expect(redirectTo("/login").status).toBe(307);
  });

  it("lets callers set cookies on the redirect", () => {
    const response = redirectTo("/today", 303);
    response.cookies.set("session", "abc");
    expect(response.headers.get("set-cookie")).toContain("session=abc");
  });
});

describe("publicUrl", () => {
  it("uses the forwarded host and proto, not the internal request.url", () => {
    const request = new Request("http://localhost:3000/today", {
      headers: {
        "x-forwarded-host": "main.example.amplifyapp.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicUrl(request, "/login").href).toBe(
      "https://main.example.amplifyapp.com/login",
    );
  });

  it("falls back to the Host header and request protocol", () => {
    const request = new Request("http://localhost:3000/today", {
      headers: { host: "localhost:3000" },
    });
    expect(publicUrl(request, "/login").href).toBe(
      "http://localhost:3000/login",
    );
  });
});
