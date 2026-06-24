export function buildAuthRedirect(
  appUrl: string,
  status: "error" | "success",
  message: string,
  email = "",
): string {
  const redirect = new URL("/", appUrl);
  redirect.searchParams.set("auth", status);

  if (email) {
    redirect.searchParams.set("email", email);
  }

  if (message) {
    redirect.searchParams.set("message", message);
  }

  return redirect.toString();
}
