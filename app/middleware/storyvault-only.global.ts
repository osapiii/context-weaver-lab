const allowedAdminPaths = new Set([
  "/admin/signin",
  "/admin/storyvault",
  "/admin/storyvault/github-callback",
  "/admin/storyvault/jira-callback",
  "/admin/storyvault/slack-callback",
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
  return navigateTo("/admin/storyvault", { replace: true });
});
