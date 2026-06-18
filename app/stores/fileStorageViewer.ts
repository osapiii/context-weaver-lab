import { defineStore } from 'pinia'
import type {
  StorageFileMetadata,
  FileTypeFilter,
  SortBy,
  SortOrder,
  BreadcrumbItem,
  SignedUrlCacheEntry,
} from '@models/storageFileMetadata'
import { extractFileExtension, getFileTypeFromExtension } from '@models/storageFileMetadata'

/**
 * ファイルストレージビューアーStore
 *
 * @remarks
 * - Firebase Storageのファイル一覧を管理
 * - フィルタ・ソート・ページネーション機能を提供
 * - Signed URLキャッシュ管理（TTL: 50分）
 */
export const useFileStorageViewerStore = defineStore('fileStorageViewer', {
  state: () => ({
    // ナビゲーション状態
    currentPath: '',

    // データ状態
    files: [] as StorageFileMetadata[],
    folders: [] as string[],
    selectedFile: null as StorageFileMetadata | null,

    // フィルタ・ソート状態
    searchQuery: '',
    fileTypeFilter: 'all' as FileTypeFilter,
    sortBy: 'name' as SortBy,
    sortOrder: 'asc' as SortOrder,

    // ページネーション状態
    currentPage: 1,
    pageSize: 100,

    // UI状態
    isLoading: false,
    error: null as string | null,

    // パフォーマンス最適化
    signedUrlCache: new Map<string, SignedUrlCacheEntry>(),
  }),

  getters: {
    /**
     * フィルタリング済みファイル一覧
     *
     * @remarks
     * - searchQuery による部分一致検索
     * - fileTypeFilter によるファイル拡張子フィルタ
     */
    filteredFiles(): StorageFileMetadata[] {
      let result = this.files

      // 検索クエリフィルタ
      if (this.searchQuery.trim() !== '') {
        const query = this.searchQuery.toLowerCase()
        result = result.filter((file) => file.name.toLowerCase().includes(query))
      }

      // ファイルタイプフィルタ
      if (this.fileTypeFilter !== 'all') {
        result = result.filter((file) => {
          const extension = extractFileExtension(file.name)
          const fileType = getFileTypeFromExtension(extension)
          return fileType === this.fileTypeFilter
        })
      }

      return result
    },

    /**
     * ソート済みファイル一覧
     */
    filteredAndSortedFiles(): StorageFileMetadata[] {
      const filtered = this.filteredFiles
      const sorted = [...filtered]

      sorted.sort((a, b) => {
        let comparison = 0

        switch (this.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name)
            break
          case 'updated':
            comparison = new Date(a.updated).getTime() - new Date(b.updated).getTime()
            break
          case 'size':
            comparison = a.size - b.size
            break
          case 'type':
            {
              const typeA = getFileTypeFromExtension(extractFileExtension(a.name))
              const typeB = getFileTypeFromExtension(extractFileExtension(b.name))
              comparison = typeA.localeCompare(typeB)
            }
            break
        }

        return this.sortOrder === 'asc' ? comparison : -comparison
      })

      return sorted
    },

    /**
     * ページネーション済みファイル一覧
     */
    paginatedFiles(): StorageFileMetadata[] {
      const allFiles = this.filteredAndSortedFiles
      const startIndex = (this.currentPage - 1) * this.pageSize
      const endIndex = startIndex + this.pageSize

      return allFiles.slice(startIndex, endIndex)
    },

    /**
     * パンくずリスト
     *
     * @remarks
     * - ルートパス（organizations/{organizationId}/）は「My Files」として表示
     * - 階層構造をスラッシュで分割してBreadcrumbItemに変換
     */
    breadcrumbPaths(): BreadcrumbItem[] {
      if (!this.currentPath) return []

      const organizationStore = useOrganizationStore()
      const organizationId = organizationStore.getLoggedInOrganizationId
      const rootPath = `organizations/${organizationId}/`

      if (this.currentPath === rootPath) {
        return [{ label: 'My Files', path: rootPath, isRoot: true }]
      }

      const pathParts = this.currentPath
        .replace(rootPath, '')
        .split('/')
        .filter((part) => part !== '')

      const breadcrumbs: BreadcrumbItem[] = [{ label: 'My Files', path: rootPath, isRoot: true }]

      let accumulatedPath = rootPath
      for (const part of pathParts) {
        accumulatedPath += `${part}/`
        breadcrumbs.push({
          label: part,
          path: accumulatedPath,
          isRoot: false,
        })
      }

      return breadcrumbs
    },

    /**
     * ページネーション情報
     */
    paginationInfo(): {
      totalFiles: number
      totalPages: number
      startIndex: number
      endIndex: number
    } {
      const totalFiles = this.filteredAndSortedFiles.length
      const totalPages = Math.ceil(totalFiles / this.pageSize)
      const startIndex = (this.currentPage - 1) * this.pageSize + 1
      const endIndex = Math.min(startIndex + this.pageSize - 1, totalFiles)

      return { totalFiles, totalPages, startIndex, endIndex }
    },

    /**
     * ツリー構造を構築
     *
     * @remarks
     * - 現在のパスからルートまでの階層構造を構築
     * - UTreeコンポーネント用のTreeItem形式に変換
     * - すべてのアイテムをデフォルトで展開
     */
    treeItems(): any[] {
      if (!this.currentPath) return []

      const organizationStore = useOrganizationStore()
      const organizationId = organizationStore.getLoggedInOrganizationId
      const rootPath = `organizations/${organizationId}/`

      // ルートアイテム
      const rootItem = {
        label: 'My Files',
        id: rootPath,
        icon: 'i-heroicons-folder',
        defaultExpanded: true,
        children: [] as any[],
      }

      // 現在のパスがルートの場合はルートのみ返す
      if (this.currentPath === rootPath) {
        return [rootItem]
      }

      // パスを分割して階層構造を構築
      const pathParts = this.currentPath
        .replace(rootPath, '')
        .split('/')
        .filter((part) => part !== '')

      // 現在のフォルダを追加
      let currentChildren = rootItem.children
      let accumulatedPath = rootPath

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]
        accumulatedPath += `${part}/`

        const folderItem = {
          label: part,
          id: accumulatedPath,
          icon: 'i-heroicons-folder',
          defaultExpanded: true, // 常に展開
          children: [] as any[],
        }

        currentChildren.push(folderItem)
        currentChildren = folderItem.children

        // 現在のパスのフォルダを追加
        if (accumulatedPath === this.currentPath) {
          this.folders.forEach((folder) => {
            folderItem.children.push({
              label: folder,
              id: `${accumulatedPath}${folder}/`,
              icon: 'i-heroicons-folder',
              defaultExpanded: true, // 常に展開
              children: [],
            })
          })
        }
      }

      return [rootItem]
    },

    /**
     * 展開するツリーパスのリスト
     *
     * @remarks
     * - すべてのパスを展開するためのIDリストを生成
     */
    expandedTreePaths(): string[] {
      if (!this.currentPath) return []

      const organizationStore = useOrganizationStore()
      const organizationId = organizationStore.getLoggedInOrganizationId
      const rootPath = `organizations/${organizationId}/`

      const paths: string[] = [rootPath]

      if (this.currentPath === rootPath) {
        return paths
      }

      const pathParts = this.currentPath
        .replace(rootPath, '')
        .split('/')
        .filter((part) => part !== '')

      let accumulatedPath = rootPath
      for (const part of pathParts) {
        accumulatedPath += `${part}/`
        paths.push(accumulatedPath)
      }

      // 現在のパス配下のフォルダも追加
      this.folders.forEach((folder) => {
        paths.push(`${this.currentPath}${folder}/`)
      })

      return paths
    },
  },

  actions: {
    /**
     * ファイル一覧を取得
     *
     * @remarks
     * - organization境界検証を実行
     * - エラー時はglobalErrorStoreにエラーを記録
     */
    async loadFiles(path: string, bucketName: string): Promise<void> {
      this.isLoading = true
      this.error = null

      try {
        const organizationStore = useOrganizationStore()
        const organizationId = organizationStore.getLoggedInOrganizationId

        if (!organizationId) {
          throw new Error('Organization ID is not available')
        }

        const storageOperations = useFirebaseStorageOperations()
        const result = await storageOperations.listFiles({
          bucketName,
          path,
          organizationId,
        })

        this.files = result.files
        this.folders = result.folders
        this.currentPath = path
      } catch (error: unknown) {
        const globalError = useGlobalErrorStore()
        let userMessage = 'ファイル一覧の取得に失敗しました。'

        // Firebase Storage APIエラー分類
        if (error && typeof error === 'object' && 'code' in error) {
          const firebaseError = error as { code: string; message: string }

          switch (firebaseError.code) {
            case 'storage/unauthorized':
              userMessage = 'アクセス権限がありません。管理者にお問い合わせください。'
              break
            case 'storage/object-not-found':
              userMessage = 'ファイルが存在しません。一覧を再読み込みします。'
              this.currentPath = '' // ルートに戻る
              break
            default:
              userMessage = 'ストレージエラーが発生しました。しばらく待ってから再試行してください。'
              break
          }
        }

        globalError.createNewGlobalError({ selectedErrorMessage: userMessage })
        this.error = userMessage
        this.files = []
        this.folders = []
      } finally {
        this.isLoading = false
      }
    },

    /**
     * フォルダに移動
     *
     * @remarks
     * - 現在のパスにフォルダ名を追加して新しいパスを構築
     * - loadFiles()を自動的に呼び出してファイル一覧を更新
     */
    async navigateToFolder(folderName: string, bucketName: string): Promise<void> {
      const newPath = `${this.currentPath}${folderName}/`
      await this.loadFiles(newPath, bucketName)
    },

    /**
     * パスに移動（パンくずリストからの移動に使用）
     */
    async navigateToPath(path: string, bucketName: string): Promise<void> {
      await this.loadFiles(path, bucketName)
    },

    /**
     * キャッシュからSigned URLを取得
     *
     * @returns Signed URL（有効期限内の場合）、それ以外はnull
     */
    getCachedSignedUrl(filePath: string): string | null {
      const cacheEntry = this.signedUrlCache.get(filePath)

      if (!cacheEntry) return null

      // 有効期限チェック
      if (Date.now() > cacheEntry.expiresAt) {
        this.signedUrlCache.delete(filePath) // 期限切れキャッシュを削除
        return null
      }

      return cacheEntry.url
    },

    /**
     * Signed URLをキャッシュに追加
     *
     * @remarks
     * - TTL: 50分（Firebase Storage Signed URLは1時間有効なため、50分でキャッシュ）
     */
    setCachedSignedUrl(filePath: string, url: string): void {
      const TTL_MINUTES = 50
      const expiresAt = Date.now() + TTL_MINUTES * 60 * 1000

      this.signedUrlCache.set(filePath, { url, expiresAt })
    },

    /**
     * 期限切れSigned URLキャッシュをクリア
     *
     * @remarks
     * - 定期的に実行することでメモリリークを防止
     */
    clearExpiredSignedUrlCache(): void {
      const now = Date.now()
      const expiredPaths: string[] = []

      for (const [filePath, cacheEntry] of this.signedUrlCache.entries()) {
        if (now > cacheEntry.expiresAt) {
          expiredPaths.push(filePath)
        }
      }

      for (const path of expiredPaths) {
        this.signedUrlCache.delete(path)
      }
    },

    /**
     * 検索クエリを設定
     */
    setSearchQuery(query: string): void {
      this.searchQuery = query
      this.resetPagination()
    },

    /**
     * ファイルタイプフィルタを設定
     */
    setFileTypeFilter(filter: FileTypeFilter): void {
      this.fileTypeFilter = filter
      this.resetPagination()
    },

    /**
     * ソート設定を変更
     */
    setSortBy(sortBy: SortBy): void {
      this.sortBy = sortBy
    },

    /**
     * ソート順を設定
     */
    setSortOrder(sortOrder: SortOrder): void {
      this.sortOrder = sortOrder
    },

    /**
     * ページネーションをリセット
     */
    resetPagination(): void {
      this.currentPage = 1
    },

    /**
     * ページを設定
     */
    setPage(page: number): void {
      this.currentPage = page
    },

    /**
     * ファイルをダウンロード
     *
     * @remarks
     * - Signed URL生成 → ブラウザダウンロード
     * - ガイドライン準拠: guide_09_INFRA_firebase_storage.md セクション2.3
     * - キャッシュを活用して不要なAPI呼び出しを削減
     */
    async downloadFile(file: StorageFileMetadata, bucketName: string): Promise<void> {
      try {
        const storageOps = useFirebaseStorageOperations()

        // キャッシュチェック
        let downloadUrl = this.getCachedSignedUrl(file.fullPath)

        // キャッシュミス: 新しいSigned URLを生成
        if (!downloadUrl) {
          downloadUrl = await storageOps.getAuthenticatedUrl({
            bucketName,
            filePath: file.fullPath,
          })
          this.setCachedSignedUrl(file.fullPath, downloadUrl)
        }

        // ブラウザダウンロード（<a>要素を使用）
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = file.name
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        log('INFO', 'File download initiated', { fileName: file.name, filePath: file.fullPath })
      } catch (error: unknown) {
        const globalError = useGlobalErrorStore()
        log('ERROR', 'Failed to download file', error)
        globalError.createNewGlobalError({
          selectedErrorMessage: 'ファイルのダウンロードに失敗しました。',
        })
      }
    },
  },
})
