export const useAlert = () => {
  const messageIsShow = ref(false); // 初期値はfalse

  // 必要に応じて他のメソッドやプロパティを追加できます

  return {
    messageIsShow,
  };
};
