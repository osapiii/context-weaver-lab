const allowedAdminPaths = new Set([
  "/admin/signin",
  "/admin/vibe-control",
  "/admin/vibe-control/github-callback",
  "/admin/data-source",
  "/admin/request-logs",
  "/admin/workflow-executions",
  "/admin/preferences",
  "/admin/settings",
  "/admin/api-keys",
]);

export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith("/admin")) return;
  const normalizedPath =
    to.path.length > 1 ? to.path.replace(/\/+$/, "") : to.path;
  if (allowedAdminPaths.has(normalizedPath)) return;
  return navigateTo("/admin/vibe-control", { replace: true });
});
