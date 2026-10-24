export function invitationLinkError(url: string) {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  const code = fragment.get("error_code") || parsed.searchParams.get("error_code");
  const error = fragment.get("error") || parsed.searchParams.get("error");
  if (!code && !error) return null;
  return code === "otp_expired"
    ? "Dieser Anmeldelink ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen Link an."
    : "Der Anmeldelink konnte nicht bestätigt werden. Bitte fordere einen neuen Link an.";
}

export function clearInvitationLinkError() {
  const url = new URL(window.location.href);
  for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
  url.hash = "";
  window.history.replaceState(null, "", url.pathname + url.search);
}
