/* v3 semantic split: class from js/app/01-storage-quota.js | keep script order */
        class StorageService {
            static async init() {
                // 动态获取版本号，确保与 DxxSystem 保持一致
                const sysVersion = (window.DxxSystem && typeof DxxSystem.getVersion === 'function')
                    ? DxxSystem.getVersion()
                    : '2.0';

                localforage.config({
                    driver: localforage.INDEXEDDB, // 强制使用 IndexedDB
                    name: 'DouXiuXiuApp',
                    // IndexedDB 要求 version 为数字，因此这里进行转换
                    version: parseFloat(sysVersion),
                    storeName: 'dxx_store',
                    description: 'DouXiuXiu Main Storage'
                });
                await localforage.ready();
            }

            static async get(key, defaultValue = null) {
                try {
                    const val = await localforage.getItem(key);
                    return val === null ? defaultValue : val;
                } catch (e) {
                    console.error(`[DB Read Error] ${key}:`, e);
                    return defaultValue;
                }
            }

            static async set(key, value) {
                try {
                    await localforage.setItem(key, value);
                    return true;
                } catch (e) {
                    console.error(`[DB Write Error] ${key}:`, e);
                    return false;
                }
            }

            static async remove(key) {
                await localforage.removeItem(key);
            }

            static async clear() {
                await localforage.clear();
            }

            // 获取所有数据的大小（估算）
            static async getStorageUsage() {
                let totalSize = 0;
                try {
                    let keys = await localforage.keys();
                    for (const key of keys) {
                        const val = await localforage.getItem(key);
                        if (val) {
                            // 粗略估算 JSON 字符串长度 * 2 字节
                            totalSize += JSON.stringify(val).length * 2;
                        }
                    }
                } catch (e) {
                    console.warn("Storage usage calc error:", e);
                }
                return totalSize;
            }
        }
        // --- 积分/口令管理器 (修复版：适配 DB) ---
