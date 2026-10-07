import { describe, expect, it } from "vitest";
import { isPushEndpoint } from "../push-endpoint";

describe("isPushEndpoint", () => {
  it("accepts the browsers' push services", () => {
    for (const url of [
      "https://web.push.apple.com/QGx1Y2t5",
      "https://api.push.apple.com/3/device/abc",
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushEndpoint(url), url).toBe(true);
    }
  });

  it("rejects anything else, so the Lambda can't be aimed at an arbitrary URL", () => {
    for (const url of [
      "http://web.push.apple.com/abc",
      "https://evil.example/web.push.apple.com",
      "https://push.apple.com.evil.example/abc",
      "https://notpush.apple.com/abc",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost:3100/x",
      "not a url",
      "",
    ]) {
      expect(isPushEndpoint(url), url).toBe(false);
    }
  });
});
