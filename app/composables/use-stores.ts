import { storeToRefs } from "pinia";

export const useGlobalError = () => {
  const store = useGlobalErrorStore();
  const storeRefs = storeToRefs(store);

  return {
    ...storeRefs,
    ...store,
  };
};
