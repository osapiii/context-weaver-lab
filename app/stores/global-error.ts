import { defineStore } from "pinia";
import log from "@utils/logger";

// *********STORE*********
export const useGlobalErrorStore = defineStore("globalError", {
  state: () => ({
    globalErrorModalStatus: "none" as "none" | "triggered",
    globalErrorCode: "" as string,
    globalErrorMessage: "" as string,
    selectedErrorMessage: {
      type: "error",
      errorCode: 0,
      message: "",
    } as {
      type: string;
      errorCode: number;
      message: string;
    },
    errorCodeList: {
      businessPartner: {
        E4300: {
          type: "error",
          errorCode: 4300,
          message: "取引先の作成に失敗しました",
        },
        E4301: {
          type: "error",
          errorCode: 4301,
          message: "取引先一覧の取得に失敗しました",
        },
        E4302: {
          type: "error",
          errorCode: 4302,
          message: "取引先情報の取得に失敗しました",
        },
        E4303: {
          type: "error",
          errorCode: 4303,
          message: "取引実績の取得に失敗しました",
        },
        E4304: {
          type: "error",
          errorCode: 4304,
          message: "取引先の削除に失敗しました",
        },
      },
      diagnosis: {
        answer: {
          E600: {
            type: "error",
            errorCode: 600,
            message: "選択された選択肢の取得に失敗しました",
          },
          E601: {
            type: "error",
            errorCode: 601,
            message: "結果レポートの表示に失敗しました",
          },
        },
        config: {
          E1700: {
            type: "error",
            errorCode: 1700,
            message:
              "診断公開リクエストの作成に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1701: {
            type: "error",
            errorCode: 1701,
            message:
              "診断公開バージョン一覧の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E103: {
            type: "error",
            errorCode: 103,
            message: "診断設定画面での設問初期化に失敗しました。",
          },
          E301: {
            type: "error",
            errorCode: 301,
            message: "新規診断の生成に失敗しました",
          },
          E302: {
            type: "error",
            errorCode: 302,
            message: "診断保存時に設定情報の上書きに失敗しました。",
          },
          E303: {
            type: "error",
            errorCode: 303,
            message: "診断保存時に設問構成情報の上書きに失敗しました。",
          },
          E400: {
            type: "error",
            errorCode: 400,
            message: "診断下書き設定の履歴保存に失敗しました",
          },
          E401: {
            type: "error",
            errorCode: 401,
            message:
              "診断下書き設定の履歴保存に失敗しました(過去の保存履歴の取得に失敗)",
          },
          E402: {
            type: "error",
            errorCode: 402,
            message:
              "診断下書き設定の履歴保存時のバージョンアップに失敗しました",
          },
          E403: {
            type: "error",
            errorCode: 403,
            message: "診断下書き設定の履歴取得に失敗しました",
          },
          E404: {
            type: "error",
            errorCode: 404,
            message: "診断下書き設定の適用に失敗しました",
          },
          E500: {
            type: "error",
            errorCode: 500,
            message: "診断設定取り込み情報読み込みに失敗しました",
          },
          E501: {
            type: "error",
            errorCode: 501,
            message: "診断設定取り込み情報読み込みに失敗しました",
          },
          E1400: {
            type: "error",
            errorCode: 1400,
            message:
              "診断一覧の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1401: {
            type: "error",
            errorCode: 1401,
            message:
              "診断情報の更新に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1900: {
            type: "error",
            errorCode: 1900,
            message:
              "編集対象の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1910: {
            type: "error",
            errorCode: 1910,
            message:
              "設問の保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
        },
      },
      gcsFileDownload: {
        E700: {
          type: "error",
          errorCode: 700,
          message: "指定されたファイルのダウンロードに失敗しました",
        },
        E701: {
          type: "error",
          errorCode: 701,
          message: "指定されたファイルのアップロードに失敗しました",
        },
      },
      answerGroup: {
        config: {
          E800: {
            type: "error",
            errorCode: 800,
            message: "回答グループ一覧の取得に失敗しました",
          },
          E801: {
            type: "error",
            errorCode: 801,
            message: "回答グループ詳細の取得に失敗しました",
          },
          E802: {
            type: "error",
            errorCode: 802,
            message:
              "アップロードされたユーザーファイルに形式エラーがありました。修正して再アップロードしてください。",
          },
          E803: {
            type: "error",
            errorCode: 803,
            message:
              "アップロードされたCSV経由のユーザー新規登録に失敗しました",
          },
          E804: {
            type: "error",
            errorCode: 804,
            message: "登録済み回答ユーザー一覧の取得に失敗しました",
          },
          E805: {
            type: "error",
            errorCode: 805,
            message: "新規回答ユーザーグループの作成に失敗しました",
          },
          E1000: {
            type: "error",
            errorCode: 1000,
            message: "属性紐付けテーブルの取得に失敗しました",
          },
          E900: {
            type: "error",
            errorCode: 900,
            message:
              "回答ユーザーグループの情報取得に失敗しました。お手数ですが、システム担当者にお問い合わせください。",
          },
          E3000: {
            type: "error",
            errorCode: 3000,
            message: "グループユーザーの取得に失敗しました",
          },
        },
      },
      email: {
        E1100: {
          type: "error",
          errorCode: 1100,
          message:
            "メール送信予約の作成に失敗しました。お手数ですが、もう1度お試しください。",
        },
        E1110: {
          type: "error",
          errorCode: 1110,
          message:
            "メール送信予約一覧の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください。",
        },
        E1120: {
          type: "error",
          errorCode: 1120,
          message:
            "メール送信予約の情報取得に失敗しました。お手数ですが、システム担当者にお問い合わせください。",
        },
      },
      surveyAnswer: {
        E1320: {
          type: "error",
          errorCode: 1320,
          message: "サーベイの読み込みに失敗しました",
        },
        E1330: {
          type: "error",
          errorCode: 1330,
          message: "回答結果を保存できませんでした",
        },
      },
      setting: {
        google: {
          E1500: {
            type: "error",
            errorCode: 1500,
            message:
              "Googleユーザー連携設定に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1501: {
            type: "error",
            errorCode: 1501,
            message:
              "Googleユーザー一覧の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
        },
        sentEmails: {
          E1600: {
            type: "error",
            errorCode: 1600,
            message:
              "送信元メールアドレス一覧の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
        },
        slack: {
          E1801: {
            type: "error",
            errorCode: 1801,
            message:
              "Slack連携情報の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1802: {
            type: "error",
            errorCode: 1802,
            message:
              "Slack通知設定の保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1803: {
            type: "error",
            errorCode: 1803,
            message:
              "Slack通知のテスト送信に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
        },
      },
      auth: {
        E1800: {
          type: "error",
          errorCode: 1800,
          message:
            "アクセストークンの保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
      },
      survey: {
        config: {
          E1229: {
            type: "error",
            errorCode: 1229,
            message: "サーベイの新規作成に失敗しました。",
          },
          E1230: {
            type: "error",
            errorCode: 1230,
            message:
              "サーベイ情報の保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1200: {
            type: "error",
            errorCode: 1200,
            message:
              "サーベイ情報の詳細取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1210: {
            type: "error",
            errorCode: 1210,
            message:
              "サーベイ設問情報の保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E1220: {
            type: "error",
            errorCode: 1220,
            message:
              "HTTP POSTリクエストの保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E2204: {
            type: "error",
            errorCode: 2204,
            message: "サーベイのバージョン復元に失敗しました",
          },
          E2000: {
            type: "error",
            errorCode: 2000,
            message:
              "サーベイの公開に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E2200: {
            type: "error",
            errorCode: 2200,
            message:
              "新規のサーベイ生成に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E2201: {
            type: "error",
            errorCode: 2201,
            message:
              "サーベイ情報の保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
          E2202: {
            type: "error",
            errorCode: 2202,
            message: "サーベイの設定情報取得に失敗しました",
          },
          E2203: {
            type: "error",
            errorCode: 2203,
            message: "サーベイの取得に失敗しました",
          },

          E1702: {
            type: "error",
            errorCode: 1702,
            message:
              "サーベイの公開に失敗しました。お手数ですが、システム担当者にお問い合わせください",
          },
        },
      },
      logic: {
        config: {
          E199: {
            type: "error",
            errorCode: 199,
            message: "新規ロジックの初期化に失敗しました",
          },
          E200: {
            type: "error",
            errorCode: 200,
            message: "ロジック情報 > 質問票の初期化に失敗しました。",
          },
          E201: {
            type: "error",
            errorCode: 201,
            message: "ロジック情報 > 診断グループの初期化に失敗しました。",
          },
          E202: {
            type: "error",
            errorCode: 202,
            message: "ロジック情報 > チャートスコアの初期化に失敗しました。",
          },
          E203: {
            type: "error",
            errorCode: 203,
            message: "ロジック情報 > おすすめアイテムの初期化に失敗しました。",
          },
          E204: {
            type: "error",
            errorCode: 204,
            message: "ロジック情報初期化中に原因不明のエラーが発生しました",
          },
        },
        E2100: {
          type: "error",
          errorCode: 2100,
          message:
            "新規の診断ロジック生成に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2120: {
          type: "error",
          errorCode: 2120,
          message:
            "ロジック一覧の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2110: {
          type: "error",
          errorCode: 2110,
          message:
            "ロジック詳細の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2230: {
          type: "error",
          errorCode: 2230,
          message:
            "総合スコア設定の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2240: {
          type: "error",
          errorCode: 2240,
          message:
            "チャートスコアグループ設定の取得に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2310: {
          type: "error",
          errorCode: 2310,
          message:
            "質問票の更新に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2320: {
          type: "error",
          errorCode: 2320,
          message:
            "診断グループの更新に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2330: {
          type: "error",
          errorCode: 2330,
          message:
            "チャートスコアの更新に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2340: {
          type: "error",
          errorCode: 2340,
          message:
            "おすすめアイテムの更新に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2350: {
          type: "error",
          errorCode: 2350,
          message:
            "アップロードされたCSV形式に誤りがあります。修正して再度アップロードしてください。",
        },
        E2360: {
          type: "error",
          errorCode: 2360,
          message: "総合スコアの初期化に失敗しました。",
        },
        E2370: {
          type: "error",
          errorCode: 2370,
          message:
            "おすすめアイテムと診断グループマッピングの初期化に失敗しました。",
        },
        E2380: {
          type: "error",
          errorCode: 2380,
          message: "診断グループ設定の初期化に失敗しました。",
        },
        E2390: {
          type: "error",
          errorCode: 2390,
          message:
            "チャートスコア配点表のフォーマットが誤っています。カラム名を正しく修正して、再度アップロードしてください。",
        },
        E2391: {
          type: "error",
          errorCode: 2391,
          message:
            "おすすめアイテム配点表のフォーマットが誤っています。カラム名を正しく修正して、再度アップロードしてください。",
        },
        E2392: {
          type: "error",
          errorCode: 2392,
          message:
            "診断グループ配点表のフォーマットが誤っています。カラム名を正しく修正して、再度アップロードしてください。",
        },
        E2393: {
          type: "error",
          errorCode: 2393,
          message:
            "チャートスコアグループ配点表のフォーマットが誤っています。カラム名を正しく修正して、再度アップロードしてください。",
        },
        E2400: {
          type: "error",
          errorCode: 2400,
          message: "診断ロジック保存済みバージョンの情報取得に失敗しました。",
        },
        E2410: {
          type: "error",
          errorCode: 2410,
          message: "ロジック保存履歴の取得に失敗しました",
        },
        E2420: {
          type: "error",
          errorCode: 2420,
          message: "ロジックの最新公開バージョンの取得に失敗しました",
        },
        E2430: {
          type: "error",
          errorCode: 2430,
          message: "ロジック保存履歴一覧の取得に失敗しました",
        },
        E2440: {
          type: "error",
          errorCode: 2440,
          message: "ロジック保存履歴の新規作成に失敗しました",
        },
        E2460: {
          type: "error",
          errorCode: 2460,
          message: "総合スコアの保存に失敗しました",
        },
        E2450: {
          type: "error",
          errorCode: 2450,
          message: "ロジック設定のロールバックに失敗しました",
        },
        E2470: {
          type: "error",
          errorCode: 2470,
          message: "選択中ロジックの接続先診断情報の取得に失敗しました",
        },
        E2480: {
          type: "error",
          errorCode: 2480,
          message: "ロールバックリクエストの作成に失敗しました",
        },
        E2500: {
          type: "error",
          errorCode: 2500,
          message:
            "ロジックからの診断設問の生成に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2510: {
          type: "error",
          errorCode: 2510,
          message:
            "診断フローのIDに重複があります。お手数ですが、リロードして再度お試しください。",
        },
        E2600: {
          type: "error",
          errorCode: 2600,
          message:
            "診断グループの判定に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2700: {
          type: "error",
          errorCode: 2700,
          message:
            "おすすめアイテムの表示に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
        E2900: {
          type: "error",
          errorCode: 2900,
          message:
            "回答フローの保存に失敗しました。お手数ですが、システム担当者にお問い合わせください",
        },
      },
      html: {
        E3001: {
          type: "error",
          errorCode: 3001,
          message: "送信メールのHTML取得に失敗しました",
        },
      },
      urlParse: {
        E2910: {
          type: "error",
          errorCode: 2910,
          message: "不正なURLです",
        },
      },
    },
  }),
  getters: {
    isModalOpen(): boolean {
      return this.globalErrorModalStatus === "triggered";
    },
  },
  actions: {
    /**
     * エラーを生成する
     */
    createNewGlobalError(params: {
      selectedErrorMessage: {
        type: string;
        errorCode: number;
        message: string;
      };
    }): void {
      const globalLoading = useGlobalLoadingStore();
      this.selectedErrorMessage = params.selectedErrorMessage;
      // loading中の場合は終了する
      if (globalLoading.isLoading) {
        globalLoading.stopLoading();
      }
      log("ERROR", "createNewGlobalError triggered!🚨 ", params);
      // Errorモーダルを表示
      this.globalErrorModalStatus = "triggered";
      // エラーをスローして処理をストップ
      createError(params.selectedErrorMessage.message);
    },
  },
});
