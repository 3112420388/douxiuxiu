/* v3 semantic split: class from js/app/07-log-backup-clean-menu.js | keep script order */
        class AutoCleaner {
            constructor() {
                this.oneDay = 24 * 60 * 60 * 1000;
            }

            run() {
                if (!CONFIG.AUTO_CLEAN_CACHE) return;

                console.log('[AutoCleaner] 开始检查过期缓存...');
                let cleanedSize = 0;

                // 1. 清理过期日志
                cleanedSize += this.cleanLogs();

                // 2. 清理过期的网络资源缓存
                cleanedSize += this.cleanNetworkResources();

                // 3. 限制搜索历史长度
                this.trimSearchHistory();

                if (cleanedSize > 0) {
                    console.log(`[AutoCleaner] 清理完成，释放空间: ${app.dataSystem.formatSize(cleanedSize)}`);
                    // 可选：提示用户 (通常自动清理是静默的，不需要弹窗)
                    // app.interaction.showToast(`自动清理释放了 ${app.dataSystem.formatSize(cleanedSize)}`);
                }
            }

            // 清理日志
            cleanLogs() {
                const key = 'dxx_backup_history'; // 或者是 app.logger 用的 key
                // 注意：LogManager 也是存在内存里的，如果实现了持久化存储才需要清理
                // 这里假设清理 BackupManager 的历史记录
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) return 0;

                    const list = JSON.parse(raw);
                    const now = Date.now();
                    const expiry = CONFIG.LOG_EXPIRY_DAYS * this.oneDay;

                    const newList = list.filter(item => (now - item.time) < expiry);

                    if (newList.length < list.length) {
                        const newStr = JSON.stringify(newList);
                        localStorage.setItem(key, newStr);
                        return raw.length - newStr.length; // 返回释放的字符数
                    }
                } catch (e) { }
                return 0;
            }

            // 清理资源 (核心)
            cleanNetworkResources() {
                const key = 'douxiuxiu_custom_creators';
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) return 0;

                    const creators = JSON.parse(raw);
                    const names = Object.keys(creators);
                    const now = Date.now();
                    const expiry = CONFIG.CACHE_EXPIRY_DAYS * this.oneDay;
                    let deletedCount = 0;

                    names.forEach(name => {
                        const item = creators[name];

                        // 安全检查：必须有 info 对象
                        if (!item.info) return;

                        // 核心判断逻辑：
                        // 1. 必须是 'network' 类型 (本地文件导入的和收藏夹导出的不删)
                        // 2. 检查 last_updated 是否超过过期时间
                        // 3. 兼容性：如果 info.origin_type 不存在，但有 source_url，也视为网络资源
                        const isNetwork = item.info.origin_type === 'network' || (!item.info.origin_type && item.info.source_url);

                        if (isNetwork && item.info.last_updated) {
                            const diff = now - item.info.last_updated;
                            if (diff > expiry) {
                                delete creators[name]; // 删除该资源
                                deletedCount++;
                                console.log(`[AutoCleaner] 删除过期资源: ${name} (过期 ${Math.floor(diff / this.oneDay)} 天)`);
                            }
                        }
                    });

                    if (deletedCount > 0) {
                        const newStr = JSON.stringify(creators);
                        localStorage.setItem(key, newStr);

                        // 同时更新内存中的数据
                        if (app.dataLoader) {
                            app.dataLoader.globalCreators = creators;
                        }

                        return raw.length - newStr.length;
                    }
                } catch (e) {
                    console.error('[AutoCleaner] 清理资源出错', e);
                }
                return 0;
            }

            // 限制搜索历史
            trimSearchHistory() {
                const key = 'dxx_search_history';
                try {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        let list = JSON.parse(raw);
                        if (list.length > 20) { // 只保留最近20条
                            list = list.slice(0, 20);
                            localStorage.setItem(key, JSON.stringify(list));
                        }
                    }
                } catch (e) { }
            }
        }

