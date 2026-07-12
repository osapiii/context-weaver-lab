import { consola } from "consola";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

export default function log(
  level: "ERROR" | "WARN" | "INFO" | "DEBUG",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...messages: any[]
) {
  // if (import.meta.env.MODE !== "development") {
  //   return;
  // }

  switch (level) {
    case "ERROR":
      consola.error("", ...messages);
      break;
    case "WARN":
      consola.warn("", ...messages);
      break;
    case "INFO":
      consola.info("", ...messages);
      break;
    case "DEBUG":
      consola.debug("", ...messages);
      break;
    default:
      consola.log("", ...messages);
      break;
  }
}
