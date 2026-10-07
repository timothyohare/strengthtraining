// Push services of the browsers Lift5 runs in (Safari/iOS, Chrome, Firefox,
// Edge). Subscription endpoints come from the browser, but the server is what
// stores them and the rest-push Lambda POSTs to them, so anything else is
// refused rather than letting a crafted "subscription" aim it at any URL.
const PUSH_HOST_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
];
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com"];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return (
    PUSH_HOSTS.includes(url.hostname) ||
    PUSH_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
  );
}
