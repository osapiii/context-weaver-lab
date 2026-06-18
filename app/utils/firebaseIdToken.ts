import { getAuth } from "firebase/auth";
import log from "@utils/logger";

/** Firebase Auth の ID トークン（ADK Bearer 用） */
export const getFirebaseIdToken = async (): Promise<string | null> => {
  try {
    const user = getAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    log("WARN", "[getFirebaseIdToken] failed", error);
    return null;
  }
};
