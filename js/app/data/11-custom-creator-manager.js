/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
        class CustomCreatorManager {
            constructor() {
                this.STORAGE_KEY = 'douxiuxiu_custom_creators';
                // 配置 localForage
                localforage.config({
                    name: 'DouXiuXiuApp',
                    storeName: 'creators_db'
                });
            }

            // 获取所有自定义资源
            // --- 修改：变成异步方法 ---
            async getAll() {
                try {
                    const val = await localforage.getItem(this.STORAGE_KEY);
                    return val || {};
                } catch (e) {
                    console.error('读取本地资源数据失败', e);
                    return {};
                }
            }
            // 增加一个批量保存方法，供 BackupManager 恢复数据使用
            async saveAll(allCreators) {
                await localforage.setItem(this.STORAGE_KEY, allCreators);
            }
            // 保存资源 (合并模式)
            // --- 修改：变成异步方法 ---
            async save(creatorData) {
                app.logger.info(`Saving creator: ${creatorData.info.name}`);
                if (!creatorData || !creatorData.info || !creatorData.info.name) {
                    return { success: false, message: '数据格式不正确' };
                }

                try {
                    const all = await this.getAll(); // 添加 await
                    // 标记为自定义
                    creatorData.isCustom = true;
                    all[creatorData.info.name] = creatorData;

                    await localforage.setItem(this.STORAGE_KEY, all); // 添加 await
                    return { success: true };
                } catch (e) {
                    // IndexedDB 很难存满，通常是磁盘满了
                    console.error(e);
                    return { success: false, message: '保存失败: ' + e.message };
                }
            }

            // 删除资源
            // --- 修改：变成异步方法 ---
            async delete(name) {
                const all = await this.getAll();
                if (all[name]) {
                    delete all[name];
                    await localforage.setItem(this.STORAGE_KEY, all);
                    return true;
                }
                return false;
            }

            // 导出资源数据 (生成JSON文件下载)
            async export(name) {
                const all = await this.getAll();
                const data = all[name];
                if (!data) return;

                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                saveAs(blob, `douxiuxiu_${name}.json`);
            }
        }

        // --- 媒体分析工具类 (修复版) ---
