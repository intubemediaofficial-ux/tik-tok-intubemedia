export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("@/lib/bootstrap");
  await bootstrap().catch((error) => console.error("bootstrap failed", error));
}
