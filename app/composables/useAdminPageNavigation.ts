import type { RouteLocationRaw } from "vue-router";
import {
  useNavigationModeRegistry,
  type NavCard,
  type NavMode,
} from "@composables/useNavigationModeRegistry";

export type AdminPageNavLink = {
  label: string;
  icon?: string;
  to?: RouteLocationRaw;
};

export type UseAdminPageNavigationOptions = {
  /** 現在ページ名（パンくず末尾・戻る行のラベル） */
  currentPageLabel: MaybeRefOrGetter<string>;
  /** モード TOP と現在ページの間に挟む階層 */
  trail?: MaybeRefOrGetter<AdminPageNavLink[]>;
  /** 「○○に戻る」ボタンを隠す */
  hideBackButton?: boolean;
};

const findCardForRoute = (
  routeName: string,
  modes: NavMode[]
): NavCard | undefined => {
  for (const mode of modes) {
    for (const group of mode.groups) {
      const card = group.cards.find((c) => c.routeName === routeName);
      if (card) return card;
    }
  }
  return undefined;
};

/**
 * モード TOP へ戻る導線 + パンくずを組み立てる。
 * ProductionLineShell と同型の「○○に戻る /」を standalone ページでも使う。
 */
export function useAdminPageNavigation(
  options: UseAdminPageNavigationOptions
) {
  const route = useRoute();
  const router = useRouter();
  const { modes, findModeByRouteName, findGlobalRouteByName } =
    useNavigationModeRegistry();

  const routeName = computed(() =>
    typeof route.name === "string" ? route.name : ""
  );

  const mode = computed(() => findModeByRouteName(routeName.value));
  const globalRoute = computed(() =>
    findGlobalRouteByName(routeName.value)
  );
  const registryCard = computed(() =>
    findCardForRoute(routeName.value, modes)
  );

  const currentPageLabel = computed(() =>
    toValue(options.currentPageLabel)
  );

  const trailLinks = computed(() => toValue(options.trail) ?? []);

  /** モード TOP（homeRouteName と同一ルート）では階層ナビを出さない */
  const isModeHomePage = computed(
    () => !!mode.value && mode.value.homeRouteName === routeName.value
  );

  const backTargetLabel = computed(() => {
    if (mode.value) return mode.value.label;
    if (globalRoute.value) return "ホーム";
    return "";
  });

  const goBack = (): void => {
    if (mode.value) {
      void router.push({ name: mode.value.homeRouteName });
      return;
    }
    if (globalRoute.value) {
      void router.push({ name: "admin" });
      return;
    }
  };

  const breadcrumbLinks = computed<AdminPageNavLink[]>(() => {
    if (isModeHomePage.value) return [];

    const links: AdminPageNavLink[] = [];

    if (mode.value) {
      links.push({
        label: mode.value.label,
        icon: mode.value.icon,
        to: { name: mode.value.homeRouteName },
      });
    } else if (globalRoute.value) {
      links.push({
        label: "ホーム",
        icon: "material-symbols:home-rounded",
        to: { name: "admin" },
      });
      links.push({
        label: globalRoute.value.label,
        icon: globalRoute.value.icon,
      });
      return links;
    }

    for (const item of trailLinks.value) {
      links.push(item);
    }

    const tail = currentPageLabel.value.trim();
    if (tail) {
      const card = registryCard.value;
      const isRegistryLanding =
        card?.routeName === routeName.value && trailLinks.value.length === 0;
      if (!isRegistryLanding || links.length === 0) {
        links.push({
          label: tail,
          icon: card?.icon,
        });
      } else if (links[links.length - 1]?.label !== tail) {
        links.push({ label: tail, icon: card?.icon });
      }
    }

    return links;
  });

  const showBackButton = computed(
    () =>
      !options.hideBackButton &&
      !!backTargetLabel.value &&
      !isModeHomePage.value
  );

  return {
    mode,
    globalRoute,
    registryCard,
    currentPageLabel,
    backTargetLabel,
    breadcrumbLinks,
    showBackButton,
    isModeHomePage,
    goBack,
  };
}
