export default (obj: Record<string, unknown> | undefined) => {
  if (obj === undefined) {
    return false;
  } else {
    for (const key in obj) {
      if (obj[key] === undefined) {
        return false;
      }
    }
    return true;
  }
};
