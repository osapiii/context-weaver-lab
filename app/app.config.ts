export default defineAppConfig({
  ui: {
    colors: {
      primary: "emerald",
      secondary: "teal",
      info: "blue",
      warning: "yellow",
      success: "green",
      error: "red",
      background: "gray",
      neutral: "slate",
      accent: "emerald",
      purple: "purple",
      violet: "violet",
      fuchsia: "fuchsia",
      // `color="violet"` を UButton 等で使う場面が複数あるため明示的に登録.
      // 未登録だと Nuxt UI v3 がスタイルを当ててくれず、ボタンが「色なし白」になる.
      excel: "#197141",
    },
    // 未移行の UModal 直書き用グローバル安全網.
    // 新規モーダルは `EnModal` を使うのが推奨パス. ここの設定は #header / #footer
    // slot を使っている既存モーダルに最低限のグレー背景・divider を当てて、真っ白で
    // 浮いていたヘッダー/フッターの締まりを底上げする.
    modal: {
      slots: {
        content: ["rounded-xl overflow-hidden shadow-xl"],
        header: [
          "bg-slate-50",
          "border-b border-slate-200",
          "px-5 py-3",
          "text-slate-900 font-bold",
        ],
        body: ["bg-white p-5"],
        footer: [
          "bg-slate-50/60",
          "border-t border-slate-100",
          "px-5 py-3",
          "flex justify-end items-center gap-2",
        ],
        close: [
          "rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        ],
      },
    },
    card: {
      slots: {
        // default = "脇役装備" : 白ベースで情報密度を高くしつつ、軽い立体感だけ残す
        root: [
          "rounded-xl overflow-hidden",
          "bg-white",
          "border border-slate-200",
          "shadow-sm",
          "transition-all duration-200",
        ],
        header: [
          "p-4 sm:px-6",
          "bg-white",
          "border-b border-slate-200",
          "text-slate-800 font-bold",
        ],
        body: ["p-4 sm:p-6", "bg-white"],
        footer: [
          "p-4 sm:px-6",
          "bg-slate-50",
          "border-t border-slate-200",
        ],
      },
      variants: {
        variant: {
          // solid : 全面ダーク (達成バナー / プレミアム表示)
          solid: {
            root: [
              "bg-gradient-to-br from-slate-800 to-slate-900",
              "text-white",
              "shadow-[0_4px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
            ],
          },
          // outline : 旧 default 相当 (軽グラデ + リング)
          outline: {
            root: [
              "bg-gradient-to-br from-white to-slate-50",
              "ring-1 ring-slate-200/60",
              "divide-y divide-slate-200",
              "shadow-[0_2px_4px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]",
            ],
          },
          soft: {
            root: [
              "bg-gradient-to-br from-slate-50/80 to-slate-100/80",
              "divide-y divide-slate-200/50",
              "shadow-[0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]",
            ],
          },
          subtle: {
            root: [
              "bg-gradient-to-br from-slate-50/60 to-slate-100/60",
              "ring-1 ring-slate-200/50",
              "divide-y divide-slate-200/50",
              "shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)]",
            ],
          },
          // hero = "主役装備" : 旧 default の派手なダーク header。 達成感シーン専用
          hero: {
            root: [
              "bg-gradient-to-br from-white to-slate-50",
              "shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]",
              "border border-slate-200/50",
            ],
            header: [
              "bg-gradient-to-r from-slate-700 via-slate-800 to-slate-700",
              "text-white font-bold",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.2)]",
              "text-shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
            ],
            body: ["bg-gradient-to-br from-white to-slate-50/50"],
          },
        },
      },
      // default は軽量の脇役装備。 派手にしたい時は variant="hero" / "solid" を明示
      defaultVariants: {},
    },
    button: {
      slots: {
        base: "font-bold cursor-pointer rounded-lg",
      },
    },
    toast: {
      slots: {
        title: "font-bold text-md",
        wrapper: "p-2",
      },
    },
    alert: {
      slots: {
        root: "relative overflow-hidden w-full rounded-lg p-4 flex gap-2.5",
        wrapper: "min-w-0 flex-1 flex flex-col",
        title: "text-lg font-bold",
        description: "text-sm opacity-90",
        icon: "shrink-0 size-5",
        avatar: "shrink-0",
        avatarSize: "2xl",
        actions: "flex flex-wrap gap-1.5 shrink-0",
        close: "p-0",
      },
      variants: {
        color: {
          primary: "",
          secondary: "",
          success: "",
          info: "",
          warning: "",
          error: "",
          neutral: "",
        },
        variant: {
          solid: "",
          outline: "",
          soft: "",
          subtle: "",
        },
        orientation: {
          horizontal: {
            root: "items-center",
            actions: "items-center",
          },
          vertical: {
            root: "items-start",
            actions: "items-start mt-2.5",
          },
        },
        title: {
          true: {
            description: "mt-1",
          },
        },
      },
      compoundVariants: [
        {
          color: "primary",
          variant: "solid",
          class: {
            root: "bg-primary text-inverted",
          },
        },
        {
          color: "secondary",
          variant: "solid",
          class: {
            root: "bg-secondary text-inverted",
          },
        },
        {
          color: "success",
          variant: "solid",
          class: {
            root: "bg-success text-inverted",
          },
        },
        {
          color: "info",
          variant: "solid",
          class: {
            root: "bg-info text-inverted",
          },
        },
        {
          color: "warning",
          variant: "solid",
          class: {
            root: "bg-warning text-inverted",
          },
        },
        {
          color: "error",
          variant: "solid",
          class: {
            root: "bg-error text-inverted",
          },
        },
        {
          color: "primary",
          variant: "outline",
          class: {
            root: "text-primary ring ring-inset ring-primary/25",
          },
        },
        {
          color: "secondary",
          variant: "outline",
          class: {
            root: "text-secondary ring ring-inset ring-secondary/25",
          },
        },
        {
          color: "success",
          variant: "outline",
          class: {
            root: "text-success ring ring-inset ring-success/25",
          },
        },
        {
          color: "info",
          variant: "outline",
          class: {
            root: "text-info ring ring-inset ring-info/25",
          },
        },
        {
          color: "warning",
          variant: "outline",
          class: {
            root: "text-warning ring ring-inset ring-warning/25",
          },
        },
        {
          color: "error",
          variant: "outline",
          class: {
            root: "text-error ring ring-inset ring-error/25",
          },
        },
        {
          color: "primary",
          variant: "soft",
          class: {
            root: "bg-primary/10 text-primary",
          },
        },
        {
          color: "secondary",
          variant: "soft",
          class: {
            root: "bg-secondary/10 text-secondary",
          },
        },
        {
          color: "success",
          variant: "soft",
          class: {
            root: "bg-success/10 text-success",
          },
        },
        {
          color: "info",
          variant: "soft",
          class: {
            root: "bg-info/10 text-info",
          },
        },
        {
          color: "warning",
          variant: "soft",
          class: {
            root: "bg-warning/10 text-warning",
          },
        },
        {
          color: "error",
          variant: "soft",
          class: {
            root: "bg-error/10 text-error",
          },
        },
        {
          color: "primary",
          variant: "subtle",
          class: {
            root: "bg-primary/10 text-primary ring ring-inset ring-primary/25",
          },
        },
        {
          color: "secondary",
          variant: "subtle",
          class: {
            root: "bg-secondary/10 text-secondary ring ring-inset ring-secondary/25",
          },
        },
        {
          color: "success",
          variant: "subtle",
          class: {
            root: "bg-success/10 text-success ring ring-inset ring-success/25",
          },
        },
        {
          color: "info",
          variant: "subtle",
          class: {
            root: "bg-info/10 text-info ring ring-inset ring-info/25",
          },
        },
        {
          color: "warning",
          variant: "subtle",
          class: {
            root: "bg-warning/10 text-warning ring ring-inset ring-warning/25",
          },
        },
        {
          color: "error",
          variant: "subtle",
          class: {
            root: "bg-error/10 text-error ring ring-inset ring-error/25",
          },
        },
        {
          color: "neutral",
          variant: "solid",
          class: {
            root: "text-inverted bg-inverted",
          },
        },
        {
          color: "neutral",
          variant: "outline",
          class: {
            root: "text-highlighted bg-default ring ring-inset ring-default",
          },
        },
        {
          color: "neutral",
          variant: "soft",
          class: {
            root: "text-highlighted bg-elevated/50",
          },
        },
        {
          color: "neutral",
          variant: "subtle",
          class: {
            root: "text-highlighted bg-elevated/50 ring ring-inset ring-accented",
          },
        },
      ],
      defaultVariants: {
        color: "primary",
        variant: "solid",
      },
    },
    stepper: {
      slots: {
        title: "font-bold",
      },
    },
    table: {
      slots: {
        base: "bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden",
        wrapper: "overflow-x-auto",
        thead: "bg-slate-50",
        tbody: "divide-y divide-slate-200",
        th: "px-4 py-3 text-left text-sm font-semibold text-slate-800",
        tr: "hover:bg-slate-50/80 transition-colors",
        td: "px-4 py-3 text-sm text-slate-800 whitespace-nowrap",
      },
    },
    skeleton: {
      background: "bg-background-200",
    },
    // 旧 modal 定義 (`header: "text-white bg-slate-800"`) は EnModal の
    // `headerVariant="dark"` 経由で実現するため、ここのグローバル上書きは廃止.
    // モーダルのデフォルト header / footer / content スタイルは上部 (line 23-) の
    // `modal.slots` 定義で安全網として一元管理する.
    tabs: {
      slots: {
        root: "flex items-center gap-2",
        list: [
          "relative flex p-1 rounded-lg",
          "bg-gradient-to-br from-slate-100 to-slate-200",
          "shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]",
        ],
        indicator: [
          "absolute transition-[translate,width] duration-200",
          "rounded-md shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)]",
        ],
        trigger: [
          "group relative inline-flex items-center min-w-0",
          "data-[state=inactive]:text-slate-600",
          "hover:data-[state=inactive]:not-disabled:text-slate-800",
          "font-semibold rounded-md",
          "transition-all duration-200",
          "disabled:cursor-not-allowed disabled:opacity-75",
        ],
        leadingIcon: "shrink-0",
        leadingAvatar: "shrink-0",
        leadingAvatarSize: "",
        label: "truncate",
        trailingBadge: "shrink-0",
        trailingBadgeSize: "sm",
        content: "focus:outline-none w-full",
      },
      variants: {
        color: {
          primary: "",
          secondary: "",
          success: "",
          info: "",
          warning: "",
          error: "",
          neutral: "",
        },
        variant: {
          pill: {
            list: [
              "bg-gradient-to-br from-slate-100 to-slate-200",
              "rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]",
            ],
            trigger: "grow",
            indicator: [
              "rounded-md",
              "shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)]",
            ],
          },
          link: {
            list: "border-default",
            indicator: "rounded-full",
            trigger: "focus:outline-none",
          },
        },
        size: {
          xs: {
            trigger: "px-2 py-1 text-xs gap-1",
            leadingIcon: "size-4",
            leadingAvatarSize: "3xs",
          },
          sm: {
            trigger: "px-2.5 py-1.5 text-xs gap-1.5",
            leadingIcon: "size-4",
            leadingAvatarSize: "3xs",
          },
          md: {
            trigger: "px-3 py-1.5 text-sm gap-1.5",
            leadingIcon: "size-5",
            leadingAvatarSize: "2xs",
          },
          lg: {
            trigger: "px-3 py-2 text-sm gap-2",
            leadingIcon: "size-5",
            leadingAvatarSize: "2xs",
          },
          xl: {
            trigger: "px-3 py-2 text-base gap-2",
            leadingIcon: "size-6",
            leadingAvatarSize: "xs",
          },
        },
      },
      compoundVariants: [
        {
          color: "primary",
          variant: "pill",
          class: {
            indicator: [
              "bg-gradient-to-br from-primary-500 to-primary-600",
              "shadow-[0_2px_4px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.3)]",
            ],
            trigger:
              "data-[state=active]:text-white data-[state=active]:font-bold",
          },
        },
        {
          color: "secondary",
          variant: "pill",
          class: {
            indicator: [
              "bg-gradient-to-br from-secondary-500 to-secondary-600",
              "shadow-[0_2px_4px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.3)]",
            ],
            trigger:
              "data-[state=active]:text-white data-[state=active]:font-bold",
          },
        },
        {
          color: "neutral",
          variant: "pill",
          class: {
            indicator: [
              "bg-gradient-to-br from-slate-600 to-slate-700",
              "shadow-[0_2px_4px_rgba(71,85,105,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]",
            ],
            trigger:
              "data-[state=active]:text-white data-[state=active]:font-bold",
          },
        },
      ],
      defaultVariants: {
        color: "primary",
        variant: "pill",
        size: "md",
      },
    },
    formField: {
      slots: {
        root: "flex flex-col gap-2",
        wrapper: "",
        labelWrapper: "flex content-center items-center justify-between",
        label: "text-sm font-bold text-slate-800",
        container: "mt-1 relative",
        description: "text-muted",
        error: "mt-2 text-error",
        hint: "text-muted",
        help: "mt-2 text-muted",
      },
    },
    input: {
      slots: {
        root: "relative inline-flex items-center",
        base: [
          "w-full rounded-xl",
          "bg-gradient-to-br from-white to-slate-50",
          "px-[18px] py-[14px] text-base font-semibold text-slate-800",
          "shadow-[0_3px_0_0_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(0,0,0,0.05),inset_0_-1px_0_rgba(255,255,255,0.8)]",
          "transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "placeholder:text-dimmed",
          "hover:shadow-[0_3px_0_0_rgba(0,0,0,0.12),inset_0_1px_2px_rgba(0,0,0,0.05),inset_0_-1px_0_rgba(255,255,255,0.9)]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        ],
        leading: "absolute inset-y-0 start-0 flex items-center",
        leadingIcon: "shrink-0 text-dimmed",
        leadingAvatar: "shrink-0",
        leadingAvatarSize: "",
        trailing: "absolute inset-y-0 end-0 flex items-center",
        trailingIcon: "shrink-0 text-dimmed",
      },
      variants: {
        size: {
          xs: {
            base: "px-2 py-1 text-xs gap-1",
            leading: "ps-2",
            trailing: "pe-2",
            leadingIcon: "size-4",
            leadingAvatarSize: "3xs",
            trailingIcon: "size-4",
          },
          sm: {
            base: "px-2.5 py-1.5 text-xs gap-1.5",
            leading: "ps-2.5",
            trailing: "pe-2.5",
            leadingIcon: "size-4",
            leadingAvatarSize: "3xs",
            trailingIcon: "size-4",
          },
          md: {
            base: "px-2.5 py-1.5 text-sm gap-1.5",
            leading: "ps-2.5",
            trailing: "pe-2.5",
            leadingIcon: "size-5",
            leadingAvatarSize: "2xs",
            trailingIcon: "size-5",
          },
          lg: {
            base: "px-3 py-2 text-sm gap-2",
            leading: "ps-3",
            trailing: "pe-3",
            leadingIcon: "size-5",
            leadingAvatarSize: "2xs",
            trailingIcon: "size-5",
          },
          xl: {
            base: "px-[18px] py-[14px] text-base gap-2",
            leading: "ps-[18px]",
            trailing: "pe-[18px]",
            leadingIcon: "size-6",
            leadingAvatarSize: "xs",
            trailingIcon: "size-6",
          },
        },
      },
    },
    inputNumber: {
      slots: {
        root: "relative inline-flex items-center",
        base: [
          "w-full rounded-xl",
          "bg-gradient-to-br from-white to-slate-50",
          "px-[18px] py-[14px] text-base font-semibold text-slate-800",
          "shadow-[0_3px_0_0_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(0,0,0,0.05),inset_0_-1px_0_rgba(255,255,255,0.8)]",
          "transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "placeholder:text-dimmed",
          "hover:shadow-[0_3px_0_0_rgba(0,0,0,0.12),inset_0_1px_2px_rgba(0,0,0,0.05),inset_0_-1px_0_rgba(255,255,255,0.9)]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "border-0 focus:outline-none",
        ],
        increment: [
          "absolute flex items-center",
          "inset-y-0 end-0 pe-1",
          "text-slate-600 hover:text-slate-800",
          "transition-colors duration-200",
        ],
        decrement: [
          "absolute flex items-center",
          "inset-y-0 start-0 ps-1",
          "text-slate-600 hover:text-slate-800",
          "transition-colors duration-200",
        ],
      },
      variants: {
        size: {
          xs: "px-2 py-1 text-xs gap-1",
          sm: "px-2.5 py-1.5 text-xs gap-1.5",
          md: "px-2.5 py-1.5 text-sm gap-1.5",
          lg: "px-3 py-2 text-sm gap-2",
          xl: "px-[18px] py-[14px] text-base gap-2",
        },
        variant: {
          outline: [
            "text-slate-800",
            "bg-gradient-to-br from-white to-slate-50",
            "ring-0",
            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
          ],
          soft: [
            "text-slate-800",
            "bg-gradient-to-br from-slate-50/80 to-slate-100/80",
            "hover:bg-gradient-to-br hover:from-slate-100 hover:to-slate-200",
            "focus:bg-gradient-to-br focus:from-white focus:to-slate-50",
          ],
          subtle: [
            "text-slate-800",
            "bg-gradient-to-br from-slate-50/60 to-slate-100/60",
            "ring-1 ring-slate-200/50",
            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
          ],
          ghost: [
            "text-slate-800",
            "bg-transparent",
            "hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100",
            "focus:bg-gradient-to-br focus:from-white focus:to-slate-50",
          ],
          none: ["text-slate-800", "bg-transparent"],
        },
        orientation: {
          horizontal: {
            base: "text-center",
            increment: "inset-y-0 end-0 pe-1",
            decrement: "inset-y-0 start-0 ps-1",
          },
          vertical: {
            increment: "top-0 end-0 pe-1 [&>button]:py-0 scale-80",
            decrement: "bottom-0 end-0 pe-1 [&>button]:py-0 scale-80",
          },
        },
      },
      compoundVariants: [
        {
          decrement: true,
          size: "xs",
          class: "ps-7",
        },
        {
          decrement: true,
          size: "sm",
          class: "ps-8",
        },
        {
          decrement: true,
          size: "md",
          class: "ps-9",
        },
        {
          decrement: true,
          size: "lg",
          class: "ps-10",
        },
        {
          decrement: true,
          size: "xl",
          class: "ps-[18px]",
        },
        {
          increment: true,
          size: "xs",
          class: "pe-7",
        },
        {
          increment: true,
          size: "sm",
          class: "pe-8",
        },
        {
          increment: true,
          size: "md",
          class: "pe-9",
        },
        {
          increment: true,
          size: "lg",
          class: "pe-10",
        },
        {
          increment: true,
          size: "xl",
          class: "pe-[18px]",
        },
      ],
      defaultVariants: {
        size: "md",
        color: "primary",
        variant: "outline",
      },
    },
    chatMessage: {
      variants: {
        variant: {
          soft: {
            base: "bg-neutral-100 !bg-neutral-100 dark:!bg-neutral-100",
            body: "bg-neutral-100 !bg-neutral-100 dark:!bg-neutral-100",
          },
        },
      },
    },
  },
});
