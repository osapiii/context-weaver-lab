type DataObject = { [key: string]: string };

export function returnUniqueValuesByKey(params: {
  dataObjectArray: DataObject[];
  key: string;
}): string[] {
  const uniqueValuesSet = new Set(
    params.dataObjectArray.map((item) => item[params.key])
  );
  return Array.from(uniqueValuesSet);
}

export function findFirstObjectByKeyValue<T>(params: {
  dataObjectArray: T[];
  key: keyof T;
  value: string | number;
}): T | undefined {
  return params.dataObjectArray.find(
    (item) => item[params.key] == params.value
  );
}

export const arrayToString = (arr: number[]): string => {
  return arr.join(",");
};

export const stringToArray = (text: string): string[] => {
  return text.split(",");
};
