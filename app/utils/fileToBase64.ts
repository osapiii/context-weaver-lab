/**
 * ファイルをBase64エンコードするユーティリティ関数
 * 
 * @param file - エンコードするFileオブジェクト
 * @returns Promise<{data: string, mimeType: string, fileName: string}>
 * @throws Error - ファイル読み込みエラー時
 */
export async function fileToBase64(
  file: File
): Promise<{ data: string; mimeType: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      try {
        const result = reader.result as string;
        // data:image/png;base64, の形式からbase64部分のみを取得
        const base64Data = result.includes(",")
          ? result.split(",")[1]
          : result;

        resolve({
          data: base64Data,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
        });
      } catch (error) {
        reject(new Error(`Failed to encode file: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 複数のファイルをBase64エンコードする
 * 
 * @param files - エンコードするFileオブジェクトの配列
 * @returns Promise<Array<{data: string, mimeType: string, fileName: string}>>
 */
export async function filesToBase64(
  files: File[]
): Promise<Array<{ data: string; mimeType: string; fileName: string }>> {
  return Promise.all(files.map((file) => fileToBase64(file)));
}

