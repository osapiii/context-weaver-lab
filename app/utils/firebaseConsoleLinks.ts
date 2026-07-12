/**
 * Firebase Console / Cloud Firestore のデバッグ用リンク生成.
 */

const FIREBASE_CONSOLE_BASE_URL = "https://console.firebase.google.com";

const encodeFirestorePathSegments = (pathSegments: readonly string[]): string => {
  const cleanedSegments = pathSegments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return cleanedSegments.map((segment) => encodeURIComponent(segment)).join("~2F");
};

export const firebaseFirestoreDocumentConsoleUrl = (params: {
  projectId: string;
  pathSegments: readonly string[];
}): string | null => {
  const projectId = params.projectId.trim();
  if (!projectId) return null;

  const encodedPath = encodeFirestorePathSegments(params.pathSegments);
  if (!encodedPath) return null;

  return `${FIREBASE_CONSOLE_BASE_URL}/project/${encodeURIComponent(projectId)}/firestore/data/~2F${encodedPath}`;
};
