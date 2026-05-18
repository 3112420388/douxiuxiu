/* v3 semantic split: class from js/app/07-log-backup-clean-menu.js | keep script order */
        class BackupManager {
            constructor() {
                // --- 配置区域 ---
                this.CLOUD_API = 'cloud_api.php'; // 保留原代码2的API入口定义
                this.CLOUD_KEY = 'dxx_mock_cloud_db'; // 备用：模拟云端存储Key (如果没有后端)
                this.HISTORY_KEY = 'dxx_backup_history';
                this.SNAPSHOT_KEY = 'dxx_local_snapshots';

                // 历史和快照异步加载
                this.history = [];
                this.snapshots = [];

                // 配置：决定备份哪些模块
                this.config = {
                    settings: true,
                    user_profile: true,
                    creators: true,
                    favorites: true,
                    likes: true,
                    music: true,
                    downloads: false
                };
            }

            // 初始化：加载本地数据
            async init() {
                try {
                    // 兼容性处理：如果 StorageService 不存在，回退到 localStorage
                    if (typeof StorageService === 'undefined') {
                        this.history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
                        this.snapshots = JSON.parse(localStorage.getItem(this.SNAPSHOT_KEY) || '[]');
                    } else {
                        this.history = await StorageService.get(this.HISTORY_KEY, []);
                        this.snapshots = await StorageService.get(this.SNAPSHOT_KEY, []);
                    }
                    console.log("BackupManager initialized (Unified)");
                } catch (e) {
                    console.error("BackupManager init error:", e);
                }
            }

            // --- 界面交互 ---

            openBackupPage() {
                app.pageManager.pushState('backup-page');
                document.getElementById('backup-page').classList.add('active');

                // 尝试更新账号UI (保留代码2的逻辑)
                if (app.accountManager && typeof app.accountManager.updateAllUI === 'function') {
                    app.accountManager.updateAllUI();
                }

                this.renderUI();
            }

            toggleOption(key, el) {
                this.config[key] = !this.config[key];
                el.classList.toggle('active', this.config[key]);
            }

            renderUI() {
                // 1. 渲染云端状态
                const user = app.accountManager.user;
                const statusEl = document.getElementById('backup-cloud-status');
                const loginBtn = document.getElementById('backup-login-btn');
                const logoutBtn = document.getElementById('backup-logout-btn');

                if (statusEl) {
                    if (user) {
                        statusEl.innerText = `已连接: ${user.username || user.uid}`;
                        statusEl.style.color = '#52c41a';
                        if (loginBtn) loginBtn.style.display = 'none';
                        if (logoutBtn) logoutBtn.style.display = 'block';
                    } else {
                        statusEl.innerText = '未登录 (离线)';
                        statusEl.style.color = '#888';
                        if (loginBtn) loginBtn.style.display = 'block';
                        if (logoutBtn) logoutBtn.style.display = 'none';
                    }
                }

                // 2. 渲染本地快照
                const snapEl = document.getElementById('backup-snapshot-container');
                if (snapEl) {
                    if (this.snapshots.length === 0) {
                        snapEl.innerHTML = '<div style="text-align:center; padding:15px; color:#666; font-size:12px;">暂无快照</div>';
                    } else {
                        snapEl.innerHTML = this.snapshots.map(s => `
                <div class="bh-item">
                    <div class="bh-content">
                        <div class="bh-action">${s.name || '未命名快照'}</div>
                        <div class="bh-time">${new Date(s.time).toLocaleString()} · ${this._formatSize(s.size)}</div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <span class="bh-status success" style="cursor:pointer;" onclick="app.backupManager.restoreSnapshot('${s.id}')">恢复</span>
                        <span class="bh-status fail" style="cursor:pointer;" onclick="app.backupManager.deleteSnapshot('${s.id}')">删除</span>
                    </div>
                </div>`).join('');
                    }
                }

                // 3. 渲染历史日志 (新增功能)
                const listEl = document.getElementById('backup-history-container');
                if (listEl) {
                    if (this.history.length === 0) {
                        listEl.innerHTML = '<div style="text-align:center; padding:15px; color:#666; font-size:12px;">暂无日志</div>';
                    } else {
                        const map = { 'export': '导出', 'import': '导入', 'backup': '上传', 'restore': '下载', 'sync': '同步', 'snapshot': '快照' };
                        listEl.innerHTML = this.history.map(h => `
                <div class="bh-item">
                    <div class="bh-content">
                        <div class="bh-action">${map[h.type] || h.type} - ${h.detail || '操作完成'}</div>
                        <div class="bh-time">${new Date(h.time).toLocaleString()}</div>
                    </div>
                    <span class="bh-status ${h.success ? 'success' : 'fail'}">${h.success ? '成功' : '失败'}</span>
                </div>`).join('');
                    }
                }
            }

            // --- 核心功能：数据收集 ---

            async _collectDataBasedOnConfig() {
                const currentVersion = (window.DxxSystem && typeof DxxSystem.getVersion === 'function') ? DxxSystem.getVersion() : '1.0';
                const d = { version: currentVersion, timestamp: Date.now() };
                const ud = app.userDataManager;

                if (this.config.settings) d.settings = CONFIG;
                if (this.config.user_profile) d.user_profile = ud.userProfile;
                if (this.config.likes) d.likes = ud.likes;
                if (this.config.favorites) d.favorites = ud.favData;
                if (this.config.music) d.music = ud.music;
                if (this.config.downloads) d.downloads = ud.downloads;
                if (this.config.creators) {
                    d.creators = await app.customManager.getAll();
                    if (app.dataSystem && typeof app.dataSystem.getCollectionData === 'function') {
                        d.creator_collections = await app.dataSystem.getCollectionData();
                    }
                }

                // 积分数据兼容 (优先使用 QuotaManager，否则用 StorageService)
                if (app.quotaManager && typeof app.quotaManager.get === 'function') {
                    d.quota = app.quotaManager.get();
                } else {
                    d.quota = await this._storageGet('dxx_quota', 99999);
                }

                // 记录已使用 Token (如果有)
                d.used_tokens = await this._storageGet('dxx_used_tokens', []);

                return d;
            }

            async _collectAllDataRaw() {
                // 用于快照，忽略 config 开关，强制备份所有核心数据
                const d = await this._collectDataBasedOnConfig();
                // 补全可能因 config 关闭而未收集的数据
                const ud = app.userDataManager;
                d.settings = CONFIG;
                d.user_profile = ud.userProfile;
                d.likes = ud.likes;
                d.favorites = ud.favData;
                d.music = ud.music;
                d.downloads = ud.downloads;
                d.creators = await app.customManager.getAll();
                return d;
            }

            // --- 快照管理 ---

            async createSnapshot() {
                const name = prompt("请输入快照名称", `快照_${new Date().toLocaleDateString()}`);
                if (!name) return;

                try {
                    app.interaction.showToast("正在创建快照...");
                    const fullData = await this._collectAllDataRaw();
                    const jsonStr = JSON.stringify(fullData);

                    const snapshot = {
                        id: Date.now().toString(),
                        time: Date.now(),
                        name: name,
                        data: fullData,
                        size: jsonStr.length
                    };

                    if (this.snapshots.length >= 3) {
                        if (!confirm("快照已满(3个)，将自动覆盖最旧的快照，继续吗？")) return;
                        this.snapshots.pop();
                    }

                    this.snapshots.unshift(snapshot);
                    await this._saveSnapshots();
                    await this._addHistory('snapshot', true, '创建: ' + name);
                    app.interaction.showToast('快照创建成功');
                } catch (e) {
                    console.error(e);
                    app.interaction.showToast('创建失败: ' + e.message);
                }
                this.renderUI();
            }

            async restoreSnapshot(id) {
                const snap = this.snapshots.find(s => s.id === id);
                if (!snap) return;

                if (confirm(`确定要恢复快照 "${snap.name}" 吗？\n当前数据将丢失。`)) {
                    await this._restoreLogic(snap.data, 'overwrite');
                    await this._addHistory('snapshot', true, '恢复: ' + snap.name);
                }
            }

            async deleteSnapshot(id) {
                if (!confirm('确定删除此快照？')) return;
                this.snapshots = this.snapshots.filter(s => s.id !== id);
                await this._saveSnapshots();
                this.renderUI();
            }

            // --- 文件导入导出 ---

            async exportToFile() {
                app.interaction.showToast("正在打包数据...");
                const data = await this._collectDataBasedOnConfig();
                const jsonStr = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                saveAs(blob, `Dxx_Backup_${Date.now()}.json`);
                await this._addHistory('export', true, '保存到本地');
                app.interaction.showToast("导出完成");
            }

            async handleFileImport(input) {
                const result = await readJsonFileFromInput(input);
                if (!result) return;
                const { file, data } = result;
                try {
                    // --- 智能身份保护逻辑 ---
                    const currentUserUid = app.userDataManager.userProfile.uid;
                    const fileUserUid = data.user_profile ? data.user_profile.uid : null;
                    let protectMsg = "";

                    if (fileUserUid && fileUserUid !== currentUserUid) {
                        if (this.config.user_profile) {
                            const btn = document.querySelector('.bo-item[onclick*="user_profile"]');
                            if (btn && btn.classList.contains('active')) this.toggleOption('user_profile', btn);
                            protectMsg += "\n- ?? 检测到不同账号，已自动取消【个人资料】导入（保护当前身份）";
                        }
                    }

                    const resourceCount = data.creators ? Object.keys(data.creators).length : 0;
                    const mode = confirm(
                        `【导入分析: ${file.name}】
` +
                        `包含创作资源: ${resourceCount} 个` +
                        protectMsg +
                        `

[确定] = 智能合并 (保留现有，冲突覆盖，推荐)
[取消] = 完全覆盖 (清空现有，完全替换)`
                    ) ? 'merge' : 'overwrite';

                    await this._restoreLogic(data, mode);
                    await this._addHistory('import', true, mode === 'merge' ? '合并导入' : '覆盖导入');
                } catch (err) {
                    console.error(err);
                    app.interaction.showToast('文件格式错误');
                }
            }

            // --- 云同步逻辑 (融合了代码1的智能对比) ---

            async startSmartSync() {
                if (!app.accountManager.user) return app.interaction.showToast('请先登录账号');

                const icon = document.querySelector('.sc-icon i');
                if (icon) icon.classList.add('fa-spin-fast');
                app.interaction.showToast('正在对比云端数据...');

                try {
                    // 模拟网络延迟 / 真实API请求
                    // 如果你有真实的 apiFetch，在这里替换 StorageService
                    /* 
                    const res = await apiFetch(this.CLOUD_API, 'check_sync_status'); 
                    let cloudPacket = res.data; 
                    */
                    await new Promise(r => setTimeout(r, 600));
                    const cloudPacket = await this._storageGet(this.CLOUD_KEY, null);

                    const cloudTime = cloudPacket ? new Date(cloudPacket.uploadTime).toLocaleString() : '无';

                    if (!cloudPacket) {
                        if (confirm('云端暂无数据，是否上传当前本地数据？')) this.backupToCloud(true);
                    } else {
                        const choice = prompt(
                            `【同步冲突解决】\n云端时间: ${cloudTime}\n\n` +
                            `1. ?? 下载并覆盖本地 (以云端为准)\n` +
                            `2. ?? 上传并覆盖云端 (以本地为准)\n` +
                            `3. ?? 双向智能合并 (推荐：保留两边的数据)\n\n请输入数字选择:`, "3");

                        if (choice === '1') {
                            await this._restoreLogic(cloudPacket.data, 'overwrite');
                            await this._addHistory('sync', true, '云端覆盖本地');
                        } else if (choice === '2') {
                            await this.backupToCloud(true);
                            await this._addHistory('sync', true, '本地覆盖云端');
                        } else if (choice === '3') {
                            // 先下载合并
                            await this._restoreLogic(cloudPacket.data, 'merge');
                            // 再上传合并后的结果
                            setTimeout(() => this.backupToCloud(true), 1000);
                            await this._addHistory('sync', true, '双向合并');
                        }
                    }
                } catch (e) {
                    console.error("Sync error:", e);
                    app.interaction.showToast('同步出错');
                } finally {
                    if (icon) icon.classList.remove('fa-spin-fast');
                }
            }

            async backupToCloud(silent = false) {
                if (!app.accountManager.user) return app.interaction.showToast('请登录');
                if (!silent) app.interaction.showToast('上传中...');

                try {
                    const data = await this._collectDataBasedOnConfig();
                    const packet = {
                        uid: app.accountManager.user.uid,
                        uploadTime: Date.now(),
                        data: data
                    };

                    // --- 实际 API 接入点 ---
                    // const res = await apiFetch(this.CLOUD_API, 'upload_backup', { data: JSON.stringify(packet) });
                    // if (res.code !== 200) throw new Error(res.msg);

                    // 模拟存储
                    await this._storageSet(this.CLOUD_KEY, packet);
                    await new Promise(r => setTimeout(r, 800));

                    if (!silent) {
                        app.interaction.showToast('备份成功');
                        await this._addHistory('backup', true, '上传成功');
                        this.renderUI();
                    }
                } catch (e) {
                    console.error(e);
                    app.interaction.showToast('备份失败');
                }
            }

            async restoreFromCloud() {
                if (!app.accountManager.user) return app.interaction.showToast('请登录');
                app.interaction.showToast('正在获取云端数据...');

                try {
                    // --- 实际 API 接入点 ---
                    // const res = await apiFetch(this.CLOUD_API, 'download_backup');
                    // const packet = res.data ? JSON.parse(res.data.data) : null;

                    await new Promise(r => setTimeout(r, 800));
                    const packet = await this._storageGet(this.CLOUD_KEY, null);

                    if (!packet) return app.interaction.showToast('云端无数据');

                    const timeStr = new Date(packet.uploadTime).toLocaleString();
                    const msg = `云端数据时间: ${timeStr}\n\n[确定] = 智能合并 (推荐)\n[取消] = 覆盖本地`;
                    const mode = confirm(msg) ? 'merge' : 'overwrite';

                    await this._restoreLogic(packet.data, mode);
                    await this._addHistory('restore', true, mode);

                } catch (e) {
                    console.error(e);
                    app.interaction.showToast('获取数据失败');
                }
            }

            // --- 核心恢复逻辑 (The Engine) ---

            async _restoreLogic(data, mode) {
                const ud = app.userDataManager;
                app.interaction.showToast("正在恢复数据...");

                try {
                    // 1. 设置 & 资料
                    if (data.settings && this.config.settings) {
                        Object.assign(CONFIG, data.settings);
                        if (app.settingsManager) await app.settingsManager.save();
                    }
                    if (data.user_profile && this.config.user_profile) {
                        ud.userProfile = data.user_profile;
                        await ud._save(ud.KEYS.PROFILE, data.user_profile);
                    }

                    // 2. 资源数据 (Creators) 深度合并
                    if (data.creators && this.config.creators) {
                        if (mode === 'overwrite') {
                            await app.customManager.saveAll(data.creators);
                        } else {
                            const local = await app.customManager.getAll();
                            const merged = this._deepMergeCreators(local, data.creators);
                            await app.customManager.saveAll(merged);
                        }
                    }
                    if (data.creator_collections && app.dataSystem && typeof app.dataSystem.restoreCollectionData === 'function') {
                        await app.dataSystem.restoreCollectionData(data.creator_collections, mode);
                    }

                    // 3. 数组列表数据 (Likes, Music, Downloads) 智能合并
                    const getKeyWork = (i) => i.id || i.url;
                    const getKeyMusic = (i) => i.url || (i.title + i.author);
                    const getKeyDL = (i) => i.url + i.time;

                    if (data.likes && this.config.likes) {
                        ud.likes = mode === 'overwrite' ? data.likes : this._smartMergeArrays(ud.likes, data.likes, getKeyWork);
                        await ud._save(ud.KEYS.LIKES, ud.likes);
                    }

                    if (data.music && this.config.music) {
                        ud.music = mode === 'overwrite' ? data.music : this._smartMergeArrays(ud.music, data.music, getKeyMusic);
                        await ud._save(ud.KEYS.MUSIC, ud.music);
                    }

                    if (data.downloads && this.config.downloads) {
                        ud.downloads = mode === 'overwrite' ? data.downloads : this._smartMergeArrays(ud.downloads, data.downloads, getKeyDL);
                        await ud._save(ud.KEYS.DOWNLOADS, ud.downloads);
                    }

                    // 4. 收藏夹深度合并
                    if (data.favorites && this.config.favorites) {
                        if (mode === 'overwrite') {
                            ud.favData = data.favorites;
                        } else {
                            const localFolders = ud.favData;
                            const remoteFolders = data.favorites;
                            const folderMap = new Map();
                            localFolders.forEach(f => folderMap.set(f.id, f));

                            remoteFolders.forEach(rf => {
                                if (folderMap.has(rf.id)) {
                                    // 文件夹存在，合并里面的 items
                                    const lf = folderMap.get(rf.id);
                                    lf.items = this._smartMergeArrays(lf.items, rf.items, getKeyWork);
                                } else {
                                    folderMap.set(rf.id, rf);
                                }
                            });
                            ud.favData = Array.from(folderMap.values());
                        }
                        await ud._save(ud.KEYS.FAV_DATA, ud.favData);
                    }

                    // 5. 积分恢复
                    if (data.quota !== undefined) {
                        if (app.quotaManager && typeof app.quotaManager.save === 'function') {
                            app.quotaManager.quota = data.quota;
                            await app.quotaManager.save();
                        } else {
                            await this._storageSet('dxx_quota', data.quota);
                        }
                    }
                    if (data.used_tokens) {
                        await this._storageSet('dxx_used_tokens', data.used_tokens);
                    }

                    // 6. 重启应用以生效
                    app.interaction.showToast('数据恢复成功，即将重启应用...');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);

                } catch (e) {
                    console.error("Restore failed:", e);
                    app.interaction.showToast('恢复过程中发生错误');
                }
            }

            // --- 辅助工具函数 ---

            _smartMergeArrays(local, remote, keyFn) {
                if (!local) local = [];
                if (!remote) remote = [];
                const map = new Map();
                local.forEach(i => { const k = keyFn(i); if (k) map.set(k, i); });
                // 远程覆盖本地同名项，新增不存在项
                remote.forEach(i => { const k = keyFn(i); if (k) map.set(k, i); });
                return Array.from(map.values());
            }

            _deepMergeCreators(local, remote) {
                if (!remote) return local;
                const merged = { ...local };
                Object.keys(remote).forEach(key => {
                    const rData = remote[key];
                    const lData = merged[key];
                    if (!lData) {
                        merged[key] = rData;
                    } else {
                        // 对比时间戳，保留新的 info
                        const lTime = (lData.info && lData.info.last_updated) || 0;
                        const rTime = (rData.info && rData.info.last_updated) || 0;
                        const newInfo = rTime > lTime ? rData.info : lData.info;
                        // 合并作品列表
                        const getWorkId = (w) => w.id || w.url;
                        const mergedWorks = this._smartMergeArrays(lData.works, rData.works, getWorkId);
                        merged[key] = { info: newInfo, works: mergedWorks, isCustom: true };
                    }
                });
                return merged;
            }

            async _addHistory(type, success, detail) {
                this.history.unshift({ type, success, detail, time: Date.now() });
                if (this.history.length > 50) this.history.pop();
                await this._storageSet(this.HISTORY_KEY, this.history);
                this.renderUI();
            }

            _formatSize(bytes) {
                if (bytes < 1024) return bytes + ' B';
                return (bytes / 1024).toFixed(1) + ' KB';
            }

            // --- 存储层抽象 (兼容 StorageService 和 localStorage) ---
            async _storageGet(key, defaultVal) {
                if (typeof StorageService !== 'undefined') {
                    return await StorageService.get(key, defaultVal);
                } else {
                    const raw = localStorage.getItem(key);
                    return raw ? JSON.parse(raw) : defaultVal;
                }
            }

            async _storageSet(key, val) {
                if (typeof StorageService !== 'undefined') {
                    await StorageService.set(key, val);
                } else {
                    localStorage.setItem(key, JSON.stringify(val));
                }
            }

            async _saveSnapshots() {
                await this._storageSet(this.SNAPSHOT_KEY, this.snapshots);
            }
        }
        // --- 自动清理管理器 ---
