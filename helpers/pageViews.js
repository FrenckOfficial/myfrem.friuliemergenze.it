export const UNTRACKED_UIDS = ["J1eRe4W2edgovr1sgUw8fqJv76E2"];

export function shouldTrackPageView(uid) {
  return Boolean(uid) && !UNTRACKED_UIDS.includes(uid);
}
