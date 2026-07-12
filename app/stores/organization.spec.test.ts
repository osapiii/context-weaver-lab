// stores/counter.spec.ts
import { setActivePinia, createPinia } from "pinia";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import setup from "../vitest.setup";

describe("organizationのユニットテスト", () => {
  beforeAll(() => {
    setActivePinia(createPinia());
    setup();
  });
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("id検索で適切に現在の組織を更新できること", async () => {
    const organization = useOrganizationStore();
    await organization.updateLoggedInOrganizationInfo({
      filterKey: "YuiNd6IW8QSv9fOKYqZq",
      searchType: "id",
    });
    const loggedInOrganizationInfo = organization.loggedInOrganizationInfo;
    expect(loggedInOrganizationInfo.id == "YuiNd6IW8QSv9fOKYqZq").toBe(true);
  });

  test("値が存在する場合、適切に現在ログイン中組織のIDを取得できること", async () => {
    const organization = useOrganizationStore();

    await organization.updateLoggedInOrganizationInfo({
      filterKey: "YuiNd6IW8QSv9fOKYqZq",
      searchType: "id",
    });
    expect(
      organization.loggedInOrganizationInfo.id == "YuiNd6IW8QSv9fOKYqZq"
    ).toBe(true);
  });

  test("値が存在しない場合、適切に現在ログイン中組織のIDが空文字で返却されること", async () => {
    const organization = useOrganizationStore();
    organization.$reset();
    expect(organization.loggedInOrganizationInfo.id == "").toBe(true);
  });

  test("code検索で適切に現在の組織を更新できること", async () => {
    const organization = useOrganizationStore();
    await organization.updateLoggedInOrganizationInfo({
      filterKey: "ENOSTECH",
      searchType: "code",
    });
    const loggedInOrganizationInfo = organization.loggedInOrganizationInfo;
    expect(loggedInOrganizationInfo.code == "ENOSTECH").toBe(true);
  });
});
