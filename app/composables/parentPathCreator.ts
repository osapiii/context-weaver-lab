import { COLLECTION_PRODUCTION_LINES } from "~/constants/firestorePaths";
import { useOrganizationStore } from "~/stores/organization";
import { useSpaceStore } from "~/stores/space";

export const useParentPathCreator = () => {
  const org = useOrganizationStore();
  const space = useSpaceStore();

  const returnParentOrgFirestorePath = (path: string): string => {
    const organizationId = org.loggedInOrganizationInfo?.id;

    if (!organizationId) {
      throw new Error("organizationId not found in store");
    }
    if (!path) {
      throw new Error("path cannot be empty");
    }

    return `organizations/${organizationId}/${path}`;
  };

  const returnParentOrgSpaceFirestorePath = (path: string): string => {
    const organizationId = org.loggedInOrganizationInfo?.id;
    const spaceId = space.selectedSpace?.id;

    if (!organizationId || !spaceId) {
      throw new Error("organizationId or spaceId not found in store");
    }
    if (!path) {
      throw new Error("path cannot be empty");
    }

    return `organizations/${organizationId}/spaces/${spaceId}/${path}`;
  };

  const returnParentOrgSpaceGcsPath = (
    bucketName: string,
    path: string
  ): string => {
    const organizationId = org.loggedInOrganizationInfo?.id;
    const spaceId = space.selectedSpace?.id;

    if (!organizationId || !spaceId) {
      throw new Error("organizationId or spaceId not found in store");
    }
    if (!bucketName) {
      throw new Error("bucketName cannot be empty");
    }
    if (!path) {
      throw new Error("path cannot be empty");
    }

    return `${bucketName}/organizations/${organizationId}/spaces/${spaceId}/${path}`;
  };

  const returnParentOrgGcsPath = (
    bucketName: string,
    path: string
  ): string => {
    const organizationId = org.loggedInOrganizationInfo?.id;

    if (!organizationId) {
      throw new Error("organizationId not found in store");
    }
    if (!bucketName) {
      throw new Error("bucketName cannot be empty");
    }
    if (!path) {
      throw new Error("path cannot be empty");
    }

    return `${bucketName}/organizations/${organizationId}/${path}`;
  };

  const returnLoggingFirestorePath = (loggingPath: string): string => {
    const organizationId = org.loggedInOrganizationInfo?.id;
    const spaceId = space.selectedSpace?.id;

    if (!organizationId || !spaceId) {
      throw new Error("organizationId or spaceId not found in store");
    }
    if (!loggingPath) {
      throw new Error("loggingPath cannot be empty");
    }

    return `organizations/${organizationId}/spaces/${spaceId}/logs/${loggingPath}`;
  };

  const returnProductionLinesCollectionPath = (): string =>
    returnParentOrgSpaceFirestorePath(COLLECTION_PRODUCTION_LINES);

  return {
    returnParentOrgFirestorePath,
    returnParentOrgSpaceFirestorePath,
    returnProductionLinesCollectionPath,
    returnParentOrgSpaceGcsPath,
    returnParentOrgGcsPath,
    returnLoggingFirestorePath,
  };
};
