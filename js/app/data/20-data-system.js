/* v3 semantic split: class from js/app/06-account-resource-data-chat.js | keep script order */
        class DataSystem {
            constructor() {
                this.container = document.getElementById('dm-list-content');
                this.currentTab = 'creators';
                this.searchText = '';
                this.collectionStoreKey = 'douxiuxiu_creator_collections';
                this.collectionData = { list: [], assignments: {} };
                this.currentCollection = 'all';
                this.collectionsLoaded = false;

                // --- 新增：更新状态控制 ---
                this.updateState = 'idle'; // idle, running, paused, stopped
                this.updateAbortController = null;
            }

            async ensureCollectionsLoaded() {
                if (this.collectionsLoaded) return;
                await this.loadCollections();
            }

            normalizeCollectionData(data) {
                const normalized = { list: [], assignments: {} };
                if (data && Array.isArray(data.list)) {
                    const seen = new Set();
                    data.list.forEach(name => {
                        const trimmed = String(name || '').trim();
                        if (!trimmed) return;
                        if (trimmed === 'all' || trimmed === '全部' || trimmed === '全部资源合集') return;
                        if (!seen.has(trimmed)) {
                            seen.add(trimmed);
                            normalized.list.push(trimmed);
                        }
                    });
                }
                if (data && data.assignments && typeof data.assignments === 'object') {
                    Object.keys(data.assignments).forEach(key => {
                        const value = String(data.assignments[key] || '').trim();
                        if (value) normalized.assignments[key] = value;
                    });
                }
                Object.values(normalized.assignments).forEach(name => {
                    if (name === 'all' || name === '全部' || name === '全部资源合集') return;
                    if (!normalized.list.includes(name)) normalized.list.push(name);
                });
                return normalized;
            }

            async loadCollections() {
                const stored = await localforage.getItem(this.collectionStoreKey);
                this.collectionData = this.normalizeCollectionData(stored);
                this.collectionsLoaded = true;
            }

            async saveCollections() {
                await localforage.setItem(this.collectionStoreKey, this.collectionData);
            }

            async getCollectionData() {
                await this.ensureCollectionsLoaded();
                return JSON.parse(JSON.stringify(this.collectionData));
            }

            async restoreCollectionData(data, mode = 'overwrite') {
                const incoming = this.normalizeCollectionData(data);
                if (mode === 'overwrite') {
                    this.collectionData = incoming;
                    this.collectionsLoaded = true;
                    await this.saveCollections();
                    return;
                }
                await this.ensureCollectionsLoaded();
                const list = [...this.collectionData.list];
                incoming.list.forEach(name => {
                    if (!list.includes(name)) list.push(name);
                });
                const assignments = { ...this.collectionData.assignments, ...incoming.assignments };
                this.collectionData = { list, assignments };
                await this.saveCollections();
            }

            async cleanMissingAssignments(allKeys) {
                const existing = new Set(allKeys);
                const assignments = this.collectionData.assignments || {};
                let changed = false;
                Object.keys(assignments).forEach(name => {
                    if (!existing.has(name)) {
                        delete assignments[name];
                        changed = true;
                    }
                });
                if (changed) await this.saveCollections();
            }

            renderCollectionOptions(allKeys) {
                const select = document.getElementById('dm-collection-select');
                if (!select) return;
                const assignments = this.collectionData.assignments || {};
                const counts = {};
                this.collectionData.list.forEach(name => { counts[name] = 0; });
                allKeys.forEach(key => {
                    const group = assignments[key];
                    if (counts[group] !== undefined) counts[group] += 1;
                });

                let optionsHtml = `<option value="all">全部资源合集 (${allKeys.length})</option>`;
                this.collectionData.list.forEach(name => {
                    const count = counts[name] || 0;
                    optionsHtml += `<option value="${name}">${name} (${count})</option>`;
                });
                select.innerHTML = optionsHtml;

                if (this.currentCollection !== 'all' && !this.collectionData.list.includes(this.currentCollection)) {
                    this.currentCollection = 'all';
                }
                select.value = this.currentCollection;
            }

            switchCollection(value) {
                this.currentCollection = value || 'all';
                this.renderList();
                if (this.updateState === 'idle') this.resetFooter();
            }

            async openCollectionManager() {
                await this.ensureCollectionsLoaded();
                const mask = document.getElementById('collection-manage-mask');
                const modal = document.getElementById('collection-manage-modal');
                if (mask) mask.classList.add('active');
                if (modal) modal.classList.add('active');
                const input = document.getElementById('new-collection-name');
                if (input) input.value = '';
                this.renderCollectionManagerList();
            }

            closeCollectionManager() {
                const mask = document.getElementById('collection-manage-mask');
                const modal = document.getElementById('collection-manage-modal');
                if (mask) mask.classList.remove('active');
                if (modal) modal.classList.remove('active');
            }

            async renderCollectionManagerList() {
                await this.ensureCollectionsLoaded();
                const listEl = document.getElementById('collection-list');
                if (!listEl) return;
                const creators = await app.customManager.getAll();
                const allKeys = Object.keys(creators);
                await this.cleanMissingAssignments(allKeys);
                const assignments = this.collectionData.assignments || {};
                const counts = {};
                this.collectionData.list.forEach(name => { counts[name] = 0; });
                allKeys.forEach(key => {
                    const group = assignments[key];
                    if (counts[group] !== undefined) counts[group] += 1;
                });

                if (this.collectionData.list.length === 0) {
                    listEl.innerHTML = `<div style="color:#777; font-size:12px; padding:6px 0;">暂无合集</div>`;
                    return;
                }

                listEl.innerHTML = this.collectionData.list.map(name => {
                    const count = counts[name] || 0;
                    return `
                        <div class="dm-collection-item">
                            <div class="dm-collection-info">
                                <div>${name}</div>
                                <div class="dm-collection-count">${count} 个博主</div>
                            </div>
                            <div class="dm-collection-actions">
                                <button class="dm-mini-btn" onclick="app.dataSystem.updateCollection('${name}')">更新</button>
                                <button class="dm-mini-btn" onclick="app.dataSystem.exportCollection('${name}')">导出</button>
                                <button class="dm-mini-btn" onclick="app.dataSystem.renameCollection('${name}')">改名</button>
                                <button class="dm-mini-btn danger" onclick="app.dataSystem.deleteCollection('${name}')">删除</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            async confirmCreateCollection() {
                await this.ensureCollectionsLoaded();
                const input = document.getElementById('new-collection-name');
                if (!input) return;
                const name = input.value.trim();
                if (!name) return app.interaction.showToast('请输入合集名称');
                if (name === 'all' || name === '全部' || name === '全部资源合集') {
                    return app.interaction.showToast('该名称已被占用');
                }
                if (this.collectionData.list.includes(name)) {
                    return app.interaction.showToast('合集已存在');
                }
                this.collectionData.list.push(name);
                await this.saveCollections();
                input.value = '';
                this.renderCollectionManagerList();
                this.renderList();
                if (app.renderer) {
                    app.renderer.renderSidebar(app.dataLoader ? app.dataLoader.globalCreators : {});
                }
            }

            async renameCollection(name) {
                await this.ensureCollectionsLoaded();
                const nextName = prompt('输入新的合集名称：', name);
                if (nextName === null) return;
                const trimmed = nextName.trim();
                if (!trimmed) return app.interaction.showToast('名称不能为空');
                if (trimmed === 'all' || trimmed === '全部' || trimmed === '全部资源合集') {
                    return app.interaction.showToast('该名称已被占用');
                }
                if (trimmed === name) return;
                if (this.collectionData.list.includes(trimmed)) {
                    return app.interaction.showToast('合集已存在');
                }
                const idx = this.collectionData.list.indexOf(name);
                if (idx >= 0) this.collectionData.list[idx] = trimmed;
                Object.keys(this.collectionData.assignments || {}).forEach(key => {
                    if (this.collectionData.assignments[key] === name) {
                        this.collectionData.assignments[key] = trimmed;
                    }
                });
                if (this.currentCollection === name) this.currentCollection = trimmed;
                await this.saveCollections();
                this.renderCollectionManagerList();
                this.renderList();
            }

            async deleteCollection(name) {
                await this.ensureCollectionsLoaded();
                if (!confirm(`确定删除合集 "${name}" 吗？`)) return;
                this.collectionData.list = this.collectionData.list.filter(item => item !== name);
                Object.keys(this.collectionData.assignments || {}).forEach(key => {
                    if (this.collectionData.assignments[key] === name) {
                        delete this.collectionData.assignments[key];
                    }
                });
                if (this.currentCollection === name) this.currentCollection = 'all';
                await this.saveCollections();
                this.renderCollectionManagerList();
                this.renderList();
            }

            async setCreatorCollection(name, collection) {
                await this.ensureCollectionsLoaded();
                const assignments = this.collectionData.assignments || {};
                const trimmed = (collection || '').trim();

                if (!trimmed) {
                    delete assignments[name];
                } else {
                    if (!this.collectionData.list.includes(trimmed)) {
                        this.collectionData.list.push(trimmed);
                    }
                    assignments[name] = trimmed;
                }

                this.collectionData.assignments = assignments;
                await this.saveCollections();
            }

            async renameCreatorKey(oldName, newName) {
                if (!oldName || !newName || oldName === newName) return;
                await this.ensureCollectionsLoaded();
                const assignments = this.collectionData.assignments || {};
                if (assignments[oldName]) {
                    assignments[newName] = assignments[oldName];
                    delete assignments[oldName];
                    this.collectionData.assignments = assignments;
                    await this.saveCollections();
                }
            }

            async runCreatorUpdateBatch(keys, creators, options = {}) {
                if (this.updateState === 'running' || this.updateState === 'paused') {
                    app.interaction.showToast('当前正在更新中，请勿重复操作');
                    return null;
                }
                if (!keys || keys.length === 0) {
                    app.interaction.showToast(options.emptyText || '没有可更新的资源');
                    return null;
                }

                this.updateState = 'running';
                let success = 0;
                let skipped = 0;
                try {
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        await this.checkPauseState();
                        this.renderUpdateControlBar(`${options.progressPrefix || '正在更新'} (${i + 1}/${keys.length}): ${key}`);
                        try {
                            await this.updateCreator(key, creators[key].info.source_url, true);
                            success++;
                            await this.checkPauseState();
                            await new Promise(r => setTimeout(r, 1000));
                        } catch (e) {
                            if (e.message === 'UpdateStopped') throw e;
                            if (options.logSkip) console.log('Update skip', key, e);
                            skipped++;
                        }
                    }
                    app.interaction.showToast(`${options.donePrefix || '批量更新完成'}: 成功 ${success}, 跳过 ${skipped}`);
                } catch (e) {
                    if (e.message === 'UpdateStopped') {
                        app.interaction.showToast(`更新已终止 (成功 ${success} 个)`);
                    } else {
                        console.error(e);
                        app.interaction.showToast('更新发生错误');
                    }
                } finally {
                    this.resetFooter();
                }
                return { success, skipped };
            }

            async updateCollection(name) {
                await this.ensureCollectionsLoaded();
                const creators = await app.customManager.getAll();
                const assignments = this.collectionData.assignments || {};
                const keys = Object.keys(creators)
                    .filter(k => assignments[k] === name)
                    .filter(k => creators[k].info && creators[k].info.source_url);
                return this.runCreatorUpdateBatch(keys, creators, {
                    emptyText: '该合集没有可更新的资源',
                    progressPrefix: '正在更新合集',
                    donePrefix: '合集更新完成'
                });
            }

            async exportCollection(name) {
                await this.ensureCollectionsLoaded();
                const creators = await app.customManager.getAll();
                const assignments = this.collectionData.assignments || {};
                const members = Object.keys(creators).filter(k => assignments[k] === name);

                if (members.length === 0) return app.interaction.showToast('该合集没有可导出的资源');

                const payload = {
                    collection: { name: name, members: members },
                    creators: {},
                    exported_at: Date.now()
                };

                members.forEach(member => {
                    payload.creators[member] = creators[member];
                });

                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                saveAs(blob, `douxiuxiu_collection_${name}.json`);
            }

            triggerImportCollection() {
                const input = document.getElementById('collection-import-input');
                if (input) input.click();
            }

            async handleImportCollection(input) {
                const result = await readJsonFileFromInput(input);
                if (!result) return;
                try {
                    const packets = Array.isArray(result.data) ? result.data : [result.data];
                    for (const packet of packets) {
                        await this.importCollectionPacket(packet);
                    }
                    this.renderCollectionManagerList();
                    this.renderList();
                    app.interaction.showToast('导入完成');
                } catch (err) {
                    console.error(err);
                    app.interaction.showToast('导入失败，文件格式不正确');
                }
            }

            async importCollectionPacket(packet) {
                if (!packet || typeof packet !== 'object') return;
                await this.ensureCollectionsLoaded();

                if (packet.creator_collections && typeof packet.creator_collections === 'object') {
                    await this.restoreCollectionData(packet.creator_collections, 'merge');
                }

                const collectionInfo = packet.collection || {};
                const name = (collectionInfo.name || packet.name || packet.collection_name || '').trim();
                const members = Array.isArray(collectionInfo.members || packet.members) ? (collectionInfo.members || packet.members) : [];
                const creators = packet.creators && typeof packet.creators === 'object' ? packet.creators : null;

                if (!name && !creators) return;

                let allCreators = await app.customManager.getAll();
                if (creators) {
                    const existing = Object.keys(creators).filter(key => allCreators[key]);
                    let allowOverwrite = true;
                    if (existing.length > 0) {
                        allowOverwrite = confirm(`检测到 ${existing.length} 个同名资源，是否覆盖？`);
                    }
                    Object.keys(creators).forEach(key => {
                        if (allCreators[key] && !allowOverwrite) return;
                        allCreators[key] = creators[key];
                    });
                    await app.customManager.saveAll(allCreators);
                }

                if (!name) return;

                if (!this.collectionData.list.includes(name)) {
                    this.collectionData.list.push(name);
                }

                const assignments = this.collectionData.assignments || {};
                const memberList = members.length ? members : (creators ? Object.keys(creators) : []);
                memberList.forEach(member => {
                    if (allCreators[member]) assignments[member] = name;
                });
                this.collectionData.assignments = assignments;
                await this.saveCollections();
            }

            async assignCreatorToCollection(name) {
                await this.ensureCollectionsLoaded();
                const assignments = this.collectionData.assignments || {};
                const current = assignments[name] || '';
                const listHint = this.collectionData.list.length ? this.collectionData.list.join('、') : '暂无合集';
                const input = prompt(`输入合集名称（留空=未归类）\n现有：${listHint}`, current);
                if (input === null) return;
                const trimmed = input.trim();

                if (!trimmed) {
                    delete assignments[name];
                    await this.saveCollections();
                    this.renderList();
                    return;
                }

                if (trimmed === 'all' || trimmed === '全部' || trimmed === '全部资源合集') {
                    return app.interaction.showToast('该名称已被占用');
                }

                if (!this.collectionData.list.includes(trimmed)) {
                    if (!confirm(`合集 "${trimmed}" 不存在，是否新建？`)) return;
                    this.collectionData.list.push(trimmed);
                }
                assignments[name] = trimmed;
                await this.saveCollections();
                this.renderCollectionManagerList();
                this.renderList();
            }

            // --- 新增：暂停检查器 ---
            // 在循环中调用此方法，如果状态是 paused，就会一直等待
            async checkPauseState() {
                if (this.updateState === 'stopped') throw new Error('UpdateStopped');

                while (this.updateState === 'paused') {
                    // 每 200ms 检查一次
                    await new Promise(r => setTimeout(r, 200));
                    // 暂停期间如果被点击了停止
                    if (this.updateState === 'stopped') throw new Error('UpdateStopped');
                }
            }

            // --- 新增：渲染底部控制栏 ---
            renderUpdateControlBar(msg, isPaused = false) {
                const footer = document.getElementById('dm-footer-creators');
                if (!footer) return;

                const icon = isPaused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
                const action = isPaused ? 'app.dataSystem.resumeUpdate()' : 'app.dataSystem.pauseUpdate()';
                const cls = isPaused ? 'resume' : 'pause';

                footer.innerHTML = `
            <div class="dm-update-controls">
                <div class="dm-progress-text">
                    <i class="fa-solid fa-spinner ${isPaused ? '' : 'fa-spin'}"></i> ${msg}
                </div>
                <button class="dm-ctrl-btn ${cls}" onclick="${action}">
                    ${icon}
                </button>
                <button class="dm-ctrl-btn stop" onclick="app.dataSystem.stopUpdate()">
                    <i class="fa-solid fa-stop"></i>
                </button>
            </div>
        `;
            }

            // --- 新增：恢复默认按钮 ---
            resetFooter() {
                const footer = document.getElementById('dm-footer-creators');
                if (!footer) return;
                const isCollection = this.currentCollection && this.currentCollection !== 'all';
                const action = isCollection
                    ? `app.dataSystem.updateCollection('${this.currentCollection}')`
                    : 'app.dataSystem.updateAllCreators()';
                const label = isCollection ? '更新当前合集' : '更新全部数据';
                footer.innerHTML = `
            <button class="dm-action-btn primary" onclick="${action}">
                <i class="fa-solid fa-rotate-right"></i> ${label}
            </button>
        `;
                this.updateState = 'idle';
            }

            // --- 新增：控制动作 ---
            pauseUpdate() {
                this.updateState = 'paused';
                const text = document.querySelector('.dm-progress-text');
                if (text) this.renderUpdateControlBar(text.innerText.replace('更新中', '已暂停'), true);
                app.interaction.showToast('更新已暂停');
            }

            resumeUpdate() {
                this.updateState = 'running';
                const text = document.querySelector('.dm-progress-text');
                if (text) this.renderUpdateControlBar(text.innerText.replace('已暂停', '更新中'), false);
                app.interaction.showToast('继续更新');
            }

            stopUpdate() {
                if (confirm('确定要终止更新吗？')) {
                    this.updateState = 'stopped';
                    // 立即中止网络请求
                    if (this.updateAbortController) {
                        this.updateAbortController.abort();
                    }
                    // 界面会在 catch 块中重置
                }
            }
            open() {
                app.pageManager.pushState('data-manager');
                document.getElementById('data-manager-page').classList.add('active');
                this.refreshStats();
                // 默认重置搜索
                this.searchText = '';
                document.getElementById('dm-search-input').value = '';
                this.currentCollection = 'all';
                this.switchTab('creators');
            }
            // 在 DataSystem 类中替换 refreshStats
            async refreshStats() {
                // 1. 获取存储大小 (异步)
                let total = await StorageService.getStorageUsage();

                const limit = 1024 * 1024 * 1024; // IndexedDB 限制设为 500MB (或者更多)
                const percentage = Math.min(100, (total / limit) * 100);
                const free = Math.max(0, limit - total);

                // DOM 更新
                const circle = document.querySelector('.circle');
                const text = document.querySelector('.dm-percentage-text');
                const usedEl = document.querySelector('.dm-used');
                const freeEl = document.querySelector('.dm-free');
                const barFill = document.querySelector('.dm-bar-fill');

                let color = '#5cc9ff';
                if (percentage > 60) color = '#faad14';
                if (percentage > 90) color = '#ff4d4f';

                if (circle) {
                    circle.setAttribute('stroke-dasharray', `${percentage}, 100`);
                    circle.style.stroke = color;
                }
                if (barFill) {
                    barFill.style.width = `${percentage}%`;
                    barFill.style.background = color;
                }
                if (text) text.innerText = Math.round(percentage) + '%';
                if (usedEl) usedEl.innerText = this.formatSize(total);
                if (freeEl) freeEl.innerText = this.formatSize(free);
            }

            // 2. 搜索处理
            handleSearch(val) {
                this.searchText = val.toLowerCase();
                this.renderList();
            }

            // 3. Tab 切换
            switchTab(tab, btnElement) {
                this.currentTab = tab;

                // 更新 Tab 样式
                const dmTabs = document.querySelectorAll('.dm-tab');
                const idx = ['creators', 'downloads', 'system'].indexOf(tab);
                setActiveButton(dmTabs, btnElement || dmTabs[idx]);

                // 更新搜索框显隐 (系统页不需要搜索)
                document.getElementById('dm-search-container').style.display = tab === 'system' ? 'none' : 'flex';

                const collectionBar = document.getElementById('dm-collection-bar');
                if (collectionBar) collectionBar.style.display = tab === 'creators' ? 'flex' : 'none';

                // 更新底部按钮栏
                document.getElementById('dm-footer-creators').style.display = tab === 'creators' ? 'block' : 'none';
                document.getElementById('dm-footer-downloads').style.display = tab === 'downloads' ? 'block' : 'none';

                this.renderList();
            }

            // 4. 核心渲染列表 (修复版)
            async renderList() {
                this.container.innerHTML = '';
                let html = '';

                // --- A. 资源列表 ---
                if (this.currentTab === 'creators') {
                    await this.ensureCollectionsLoaded();
                    const creators = await app.customManager.getAll();
                    const allKeys = Object.keys(creators);
                    await this.cleanMissingAssignments(allKeys);
                    this.renderCollectionOptions(allKeys);

                    let keys = allKeys;
                    const assignments = this.collectionData.assignments || {};

                    if (this.currentCollection !== 'all') {
                        keys = keys.filter(k => assignments[k] === this.currentCollection);
                    }

                    // 搜索过滤
                    if (this.searchText) {
                        keys = keys.filter(k => k.toLowerCase().includes(this.searchText));
                    }

                    if (keys.length === 0) {
                        const emptyText = this.searchText
                            ? '未找到相关资源'
                            : (this.currentCollection !== 'all' ? '该合集暂无资源' : '未找到相关资源');
                        html = this.getEmptyState(emptyText);
                    } else {
                        keys.forEach(key => {
                            const c = creators[key];
                            const size = JSON.stringify(c).length * 2;
                            const collectionName = assignments[key] || '未归类';

                            // 【核心修复 1】在此处定义 hasUrl，否则下面引用会报错导致列表不显示
                            const hasUrl = c.info.source_url && c.info.source_url.length > 0;
                            const isLocal = c.info && c.info.origin_type === 'local';
                            const localType = c.info && c.info.local_type ? c.info.local_type : '';
                            const avatar = isLocal
                                ? getDiceBearAvatar(c.info.name || 'Guest')
                                : c.info.avatar;

                            let sourceClass = '';
                            const originType = c.info.origin_type;

                            // 来源样式判断
                            if (originType === 'favorite') {
                                sourceClass = 'source-fav';
                            } else if (originType === 'local') {
                                sourceClass = 'source-local';
                            } else if (originType === 'network') {
                                sourceClass = 'source-net';
                            } else {
                                // 兼容旧数据
                                if (hasUrl) {
                                    sourceClass = 'source-net';
                                } else {
                                    sourceClass = 'source-local';
                                }
                            }

                            // 时间判断
                            let timeStatus = '<span class="dm-badge green"></span>刚刚';
                            if (c.info.last_updated) {
                                const diff = Date.now() - c.info.last_updated;
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                if (days === 0) timeStatus = '<span class="dm-badge green"></span>今天';
                                else if (days < 3) timeStatus = `<span class="dm-badge green"></span>${days}天前`;
                                else timeStatus = `<span class="dm-badge yellow"></span>${days}天前`;
                            }

                            const subTitleHtml = `<div class="dm-meta">${timeStatus} · ${c.works.length}个作品</div>`;

                            html += `
<div class="dm-item ${sourceClass}" id="creator-item-${key}">
    <img class="dm-avatar" src="${avatar}"/>
    <div class="dm-content">
                                <div class="dm-title-row">
                                    <div class="dm-title">${c.info.name}</div>
                                    <span class="dm-collection-tag">${collectionName}</span>
                                    <div class="dm-size-tag">${this.formatSize(size)}</div>
                                </div>
                                ${subTitleHtml}
                            </div>
                            <div class="dm-actions">
                                <!-- 修复变量引用 hasUrl -->
                                ${isLocal
                                    ? `<div class="dm-act-btn update" onclick="app.openLocalMedia('${localType}')" title="立即扫描"><i class="fa-solid fa-magnifying-glass-plus"></i></div>`
                                    : (hasUrl ? `<div class="dm-act-btn update" onclick="app.dataSystem.updateCreator('${key}', '${c.info.source_url}')" title="更新"><i class="fa-solid fa-rotate"></i></div>` : '')
                                }
                                <div class="dm-act-btn" onclick="app.dataSystem.assignCreatorToCollection('${key}')" title="加入合集"><i class="fa-solid fa-folder"></i></div>
                                <div class="dm-act-btn" onclick="app.dataSystem.exportCreator('${key}')" title="导出JSON"><i class="fa-solid fa-file-export"></i></div>
                                <div class="dm-act-btn delete" onclick="app.deleteCreator(event, '${key}');" title="${isLocal ? '清除扫描记录' : '删除'}"><i class="fa-solid fa-trash"></i></div>
                            </div>
                        </div>`;
                        });
                    }
                }
                // --- B. 下载记录 ---
                else if (this.currentTab === 'downloads') {
                    let dls = app.userDataManager.downloads;
                    if (this.searchText) {
                        dls = dls.filter(d => d.name.toLowerCase().includes(this.searchText));
                    }

                    if (dls.length === 0) html = this.getEmptyState('暂无下载记录');
                    else {
                        dls.forEach(d => {
                            const iconClass = `dm-icon-${d.type}`;
                            html += `
                            <div class="dm-item">
                                <div class="dm-icon-box ${iconClass}">
                                    <i class="fa-solid ${this.getTypeIcon(d.type)}"></i>
                                </div>
                                <div class="dm-content">
                                    <div class="dm-title-row">
                                        <div class="dm-title">${d.name}</div>
                                    </div>
                                    <div class="dm-meta">${app.userDataManager.formatTime(d.time)}</div>
                                </div>
                            </div>`;
                        });
                    }
                }
                // --- C. 系统缓存 ---
                else if (this.currentTab === 'system') {
                    html = `
                    <div class="dm-item">
                        <div class="dm-icon-box" style="background:#333"><i class="fa-solid fa-gear"></i></div>
                        <div class="dm-content">
                            <div class="dm-title">应用配置重置</div>
                            <div class="dm-meta">清除偏好设置、隐私状态等</div>
                        </div>
                        <div class="dm-act-btn delete" onclick="localStorage.removeItem('douxiuxiu_settings'); alert('重置完成'); location.reload();">
                            <i class="fa-solid fa-trash-can"></i>
                        </div>
                    </div>
                    <div class="dm-item">
                        <div class="dm-icon-box" style="background:#333"><i class="fa-solid fa-database"></i></div>
                        <div class="dm-content">
                            <div class="dm-title">完全格式化</div>
                            <div class="dm-meta">删除所有本地数据，恢复出厂设置</div>
                        </div>
                        <div class="dm-act-btn delete" onclick="app.dataSystem.clearAllCache()">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                    </div>`;
                }

                this.container.innerHTML = html;
            }

            // 辅助：获取类型图标
            getTypeIcon(type) {
                const map = { 'video': 'fa-video', 'music': 'fa-music', 'image': 'fa-image', 'zip': 'fa-file-zipper' };
                return map[type] || 'fa-file';
            }

            // 辅助：空状态 HTML
            getEmptyState(text) {
                return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:#666;">
                    <i class="fa-regular fa-folder-open" style="font-size:40px;margin-bottom:10px;"></i>
                    <div>${text}</div>
                </div>`;
            }

            formatSize(bytes) {
                if (bytes < 1024) return bytes + ' B';
                else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
                else return (bytes / 1048576).toFixed(2) + ' MB';
            }

            // 构建下一页URL（支持新API分页格式）
            _buildNextPageUrl(currentUrl, nextPage, pagination) {
                try {
                    const urlObj = new URL(currentUrl);

                    // 设置 cursor 或 max_cursor（API使用cursor参数）
                    if (pagination.cursor !== undefined) {
                        urlObj.searchParams.set('cursor', pagination.cursor);
                    } else if (pagination.max_cursor !== undefined) {
                        urlObj.searchParams.set('cursor', pagination.max_cursor);
                    } else if (pagination.next_cursor !== undefined) {
                        urlObj.searchParams.set('cursor', pagination.next_cursor);
                    }

                    return urlObj.toString();
                } catch (e) {
                    console.warn('构建下一页URL失败:', e);
                    return null;
                }
            }

            // --- 新增：通用获取创作者数据函数，仿照addCreatorFromDyUrl逻辑 ---
            async fetchCreatorDataFromUrl(url, progressCallback, abortController) {
                const fetchedIds = new Set();
                const fetchedWorksBuffer = [];

                // 使用配置的API地址
                const sdk = Api.getSdkConfig();
                const params = new URLSearchParams();
                if (sdk.key && sdk.key.trim() !== '') {
                    params.set(sdk.keyParam, sdk.key);
                }
                params.set(sdk.urlParam, url);
                let currentApiUrl = `${sdk.base}/${sdk.profilePath}?${params.toString()}`;

                let hasMore = true;
                let pageCount = 0;
                let retryCount = 0;

                try {
                    while (hasMore && !abortController.signal.aborted) {
                        pageCount++;
                        if (progressCallback) progressCallback(pageCount, fetchedWorksBuffer.length);

                        console.log(`请求第 ${pageCount} 页...`);

                        try {
                            const response = await fetch(currentApiUrl, {
                                signal: abortController.signal
                            });

                            if (!response.ok) throw new Error(`HTTP状态: ${response.status}`);

                            const resData = await response.json();

                            console.log(`API响应:`, {
                                hasData: !!resData.data,
                                dataLength: resData.data ? resData.data.length : 0,
                                hasMore: resData.has_more,
                                maxCursor: resData.max_cursor,
                                nextUrl: resData.next_url,
                                pagination: resData.pagination
                            });

                            if (!resData || (resData.code && resData.code !== 200)) {
                                if (pageCount === 1) throw new Error(resData.msg || '无法获取数据');
                                console.warn('API 结束或异常:', resData);
                                hasMore = false;
                                break;
                            }

                            let list = [];
                            if (Array.isArray(resData)) list = resData;
                            else if (resData.data && Array.isArray(resData.data)) list = resData.data;

                            if (list.length > 0) {
                                for (const item of list) {
                                    const realItem = item.data || item;
                                    const id = realItem.aweme_id || realItem.id;

                                    if (id && !fetchedIds.has(id)) {
                                        fetchedIds.add(id);
                                        fetchedWorksBuffer.push(item);
                                    }
                                }

                                let nextUrl = null;
                                if (Array.isArray(resData) && resData.length > 0 && resData[0].next_url) {
                                    nextUrl = resData[0].next_url;
                                } else if (resData.next_url) {
                                    nextUrl = resData.next_url;
                                } else if (resData.data && resData.data.next_url) {
                                    nextUrl = resData.data.next_url;
                                } else {
                                    // 兼容新版 API 分页结构（pagination + max_cursor）
                                    const pagination = resData.pagination || (resData.data ? resData.data.pagination : null);
                                    if (pagination && pagination.has_more && (pagination.max_cursor !== undefined || pagination.cursor !== undefined || pagination.next_cursor !== undefined)) {
                                        nextUrl = this._buildNextPageUrl(currentApiUrl, pageCount + 1, pagination);
                                    } else if (resData.has_more && (resData.max_cursor !== undefined || resData.cursor !== undefined)) {
                                        // 兼容旧版抖音 API 格式
                                        const mockPagination = {
                                            has_more: resData.has_more,
                                            max_cursor: resData.max_cursor,
                                            cursor: resData.cursor
                                        };
                                        nextUrl = this._buildNextPageUrl(currentApiUrl, pageCount + 1, mockPagination);
                                    }
                                }

                                console.log(`第 ${pageCount} 页处理完成，数据量: ${list.length}, 是否有下一页: ${!!nextUrl}`);

                                if (nextUrl) {
                                    try {
                                        currentApiUrl = new URL(nextUrl, currentApiUrl).toString();
                                    } catch (e) {
                                        currentApiUrl = nextUrl;
                                    }
                                    retryCount = 0;
                                } else {
                                    hasMore = false;
                                }
                            } else {
                                hasMore = false;
                            }

                            if (hasMore) {
                                await new Promise(r => setTimeout(r, 1500));
                            }

                        } catch (err) {
                            if (err.name === 'AbortError') {
                                console.log('请求被终止');
                                break;
                            }

                            console.error('请求出错:', err);
                            retryCount++;
                            if (retryCount >= 3) {
                                hasMore = false;
                            } else {
                                await new Promise(r => setTimeout(r, 2000));
                            }
                        }
                    }

                    return { data: fetchedWorksBuffer, aborted: false };

                } catch (error) {
                    if (error.name === 'AbortError') {
                        // 返回已获取的数据和终止标志
                        return { data: fetchedWorksBuffer, aborted: true };
                    }
                    console.error('获取数据流程错误:', error);
                    throw error;
                }
            }



            async _fetchAllPages(initialUrl, statusCallback) {
                // ... (变量初始化保持不变) ...
                let allWorks = [];
                let currentUrl = initialUrl; // 注意：如果是通过 addCreatorFromDyUrl 传入的，需要是完整API链接或者仅目标URL
                // Api.External.fetchDouyinProfile 内部会自动拼接 API Key 和 Base URL，所以我们这里假设 initialUrl 是目标用户的主页链接
                // 但是 DataSystem 之前的逻辑是手动拼接 API 链接
                // 为了兼容，我们修改 fetchDouyinProfile 的逻辑，或者在这里做判断
                // 最好的方式是：DataSystem 传递原始抖音链接，让 API 模块处理

                // 由于代码结构的改动，这里建议直接使用 fetchDouyinProfile 
                // 但注意：分页逻辑需要手动处理 next_url

                let hasMore = true;
                let page = 1;
                let retryCount = 0;
                const MAX_PAGES = 50;

                this.updateAbortController = new AbortController();

                while (hasMore && page <= MAX_PAGES) {
                    await this.checkPauseState();
                    if (statusCallback) statusCallback(page, allWorks.length);

                    try {
                        // === 修改：使用 Api.External.fetchDouyinProfile ===
                        // 注意：如果 currentUrl 已经是带 API Key 的长链接（next_url 返回的通常是），则直接 fetchJson
                        // 如果是用户输入的短链/主页链，则走 fetchDouyinProfile

                        let json;
                        // 判断是否为API返回的next_url（检查是否为完整的API URL）
                        if (currentUrl.includes('?') && (currentUrl.includes('key=') || currentUrl.includes('url=') || currentUrl.includes('msg='))) {
                            // 如果是 API 返回的 next_url，直接请求
                            json = await Api.getJson(currentUrl, { signal: this.updateAbortController.signal });
                        } else {
                            // 初始请求（用户输入的抖音链接）
                            json = await Api.External.fetchDouyinProfile(currentUrl, this.updateAbortController.signal);
                        }

                        if (!json || (json.code && json.code !== 200)) {
                            if (page === 1) throw new Error(json.msg || 'API请求失败');
                            console.warn('分页获取中断或结束:', json);
                            hasMore = false;
                            break;
                        }

                        let list = [];
                        if (Array.isArray(json)) {
                            list = json;
                        } else {
                            // 兼容新旧API格式：新API返回 {code:200, data:[...]}，旧API返回 {aweme_list:[...]}
                            const mappedList = getValueByPath(json, CONFIG.API_LIST_PATH);
                            if (Array.isArray(mappedList)) list = mappedList;
                            else if (json.data && Array.isArray(json.data)) list = json.data;
                            else if (json.aweme_list && Array.isArray(json.aweme_list)) list = json.aweme_list;
                        }

                        if (list.length === 0) {
                            hasMore = false;
                            break;
                        }

                        allWorks = allWorks.concat(list);

                        let nextUrl = getValueByPath(json, CONFIG.API_NEXT_PATH);
                        if (!nextUrl) {
                            if (Array.isArray(json) && json.length > 0 && json[0].next_url) {
                                nextUrl = json[0].next_url;
                            } else if (json.next_url) {
                                nextUrl = json.next_url;
                            } else if (json.data && json.data.next_url) {
                                nextUrl = json.data.next_url;
                            } else if (json.pagination && json.pagination.has_more) {
                                // 新API格式：如果有更多数据，需要构建下一页URL
                                nextUrl = this._buildNextPageUrl(currentUrl, page + 1, json.pagination);
                            }
                        }

                        if (nextUrl) {
                            currentUrl = nextUrl;
                            page++;
                            retryCount = 0;
                            await this.checkPauseState();
                            await new Promise(r => setTimeout(r, 1200));
                        } else {
                            hasMore = false;
                        }

                    } catch (e) {
                        if (e.name === 'AbortError' || e.message === 'UpdateStopped') {
                            throw new Error('UpdateStopped');
                        }
                        console.error(`第 ${page} 页获取失败`, e);
                        retryCount++;
                        if (retryCount >= 3) hasMore = false;
                        else await new Promise(r => setTimeout(r, 2000));
                    }
                }
                return allWorks;
            }

            async updateCreator(name, url, isBatchMode = false) {
                // 只有在非批量模式（即用户手动点击单个更新）时，才检查全局状态
                if (!isBatchMode) {
                    if (this.updateState === 'running' || this.updateState === 'paused') {
                        return app.interaction.showToast('有更新任务正在进行中');
                    }
                }
                // ---------------------------

                if (!url) return;
                const itemEl = document.getElementById(`creator-item-${name}`);
                const icon = itemEl ? itemEl.querySelector('.fa-rotate') : null;

                if (icon) icon.classList.add('fa-spin-fast');

                if (!isBatchMode) {
                    this.updateState = 'running';
                    this.renderUpdateControlBar(`正在更新: ${name}`);
                }
                try {
                    // 1. 获取本地旧数据
                    const allCreators = await app.customManager.getAll();
                    const oldCreatorData = (allCreators && allCreators[name]) ? allCreators[name] : { works: [], info: {} };
                    const oldWorks = oldCreatorData.works || [];

                    // 2. 获取网络新数据 (使用新的通用获取函数)
                    this.updateAbortController = new AbortController();
                    const fetchResult = await this.fetchCreatorDataFromUrl(url, (page, count) => {
                        // 如果是批量模式，更新控制条的进度文本
                        const statusText = `[${name}] 第${page}页, 已获${count}条`;
                        if (isBatchMode) {
                            // 批量模式下只更新文本，保持控制条结构
                            const textEl = document.querySelector('.dm-progress-text');
                            if (textEl) textEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${statusText}`;
                        } else {
                            // 单个模式
                            this.renderUpdateControlBar(statusText);
                        }
                    }, this.updateAbortController);

                    const rawNewDataList = fetchResult.data;

                    // 检查是否被终止
                    const aborted = fetchResult.aborted;
                    if (aborted && rawNewDataList.length === 0) {
                        // 终止但没有任何数据，则直接退出
                        if (isBatchMode) throw new Error('UpdateStopped');
                        else {
                            app.interaction.showToast('更新已终止，无新数据');
                            return;
                        }
                    }

                    // 终止但已有部分数据：继续走保存流程（保留已获取内容）
                    if (aborted && rawNewDataList.length > 0) {
                        if (!isBatchMode) {
                            app.interaction.showToast(`更新已终止，但已保存 ${rawNewDataList.length} 条内容`);
                        }
                    }

                    if (rawNewDataList.length === 0) {
                        throw new Error('未获取到有效数据');
                    }

                    // 3. 转换新数据
                    const convertedData = app.convertDyDataToCreator(rawNewDataList, { source_url: url });

                    // --- 【核心修复：智能去重与合并逻辑】 ---

                    // A. 建立新数据的 ID 映射 (处理新数据内部重复)
                    const newWorksUnique = [];
                    const newIdSet = new Set();

                    convertedData.works.forEach(work => {
                        // 优先使用 ID，没有则用 URL
                        const uniqueKey = work.id || work.url;
                        if (!newIdSet.has(uniqueKey)) {
                            // 标记置顶：如果是列表第一个且包含置顶标记（此处逻辑可按需调整，简单处理默认不置顶）
                            // 修正：新获取的数据默认无置顶状态，保持原逻辑
                            newIdSet.add(uniqueKey);
                            newWorksUnique.push(work);
                        }
                    });

                    // B. 建立旧数据的索引 (ID Map 和 Title Map)
                    const oldWorkMap = new Map();     // Key: ID or URL -> Work
                    const oldTitleMap = new Map();    // Key: Title -> Work (兜底用)

                    oldWorks.forEach(w => {
                        if (w.id) oldWorkMap.set(String(w.id), w);
                        else if (w.url) oldWorkMap.set(w.url, w);

                        // 建立标题索引用于通过标题匹配旧数据（防止因URL过期导致的重复）
                        if (w.title) oldTitleMap.set(w.title, w);
                    });

                    // C. 开始合并
                    const mergedWorks = [];
                    let updatedCount = 0;
                    let newCount = 0;

                    // 遍历新数据，尝试在旧数据中找到它
                    newWorksUnique.forEach(newWork => {
                        let matchedOldWork = null;

                        // 1. 尝试 ID 匹配
                        if (newWork.id && oldWorkMap.has(String(newWork.id))) {
                            matchedOldWork = oldWorkMap.get(String(newWork.id));
                        }
                        // 2. 尝试 URL 匹配 (针对旧数据有 ID 但新数据只有 URL 的情况，虽然少见)
                        else if (newWork.url && oldWorkMap.has(newWork.url)) {
                            matchedOldWork = oldWorkMap.get(newWork.url);
                        }
                        // 3. 【关键】尝试标题匹配 (针对旧数据无 ID 且 URL 已过期的情况)
                        else if (newWork.title && oldTitleMap.has(newWork.title)) {
                            matchedOldWork = oldTitleMap.get(newWork.title);
                        }

                        if (matchedOldWork) {
                            // 找到匹配的旧数据 -> 以新数据为主，保留用户设置（如置顶）
                            const mergedWork = {
                                ...matchedOldWork,
                                ...newWork,
                            };

                            // 补全旧数据缺失的 ID/URL（避免丢失唯一标识）
                            if (!mergedWork.id && matchedOldWork.id) mergedWork.id = matchedOldWork.id;
                            if (!mergedWork.url && matchedOldWork.url) mergedWork.url = matchedOldWork.url;

                            // 标记该旧数据已被处理，避免在后续“剩余旧数据”阶段再次添加
                            if (matchedOldWork.id) oldWorkMap.delete(String(matchedOldWork.id));
                            if (matchedOldWork.url) oldWorkMap.delete(matchedOldWork.url);
                            mergedWork._hasMerged = true;

                            mergedWorks.push(mergedWork);
                            updatedCount++;
                        } else {
                            // 没找到匹配 -> 视为全新作品
                            mergedWorks.push(newWork);
                            newCount++;
                        }
                    });

                    // D. 添加剩余的（未被更新的）旧数据
                    // 比如作者删除了视频，或者 API 没返回这些视频，我们选择保留在本地
                    oldWorks.forEach(oldW => {
                        if (!oldW._hasMerged) {
                            mergedWorks.push(oldW);
                        } else {
                            // 清理临时标记
                            delete oldW._hasMerged;
                        }
                    });

                    // --- 合并结束 ---

                    const finalCreatorData = {
                        info: {
                            ...oldCreatorData.info,
                            ...convertedData.info,
                            last_updated: Date.now()
                        },
                        works: mergedWorks,
                        isCustom: true
                    };

                    const saveResult = await app.customManager.save(finalCreatorData);
                    if (saveResult.success) {
                        app.dataLoader.globalCreators[name] = finalCreatorData; // 内存更新
                        if (!isBatchMode) {
                            app.interaction.showToast(`更新完成`);
                        }
                    } else {
                        throw new Error(saveResult.message);
                    }

                } catch (e) {
                    // 1. 如果是批量模式 (isBatchMode = true)
                    // 必须将错误向上抛出，让外层的 updateAllCreators 决定是“停止整个循环”还是“跳过当前继续下一个”
                    if (isBatchMode) throw e;

                    // 2. 如果是单个模式 (isBatchMode = false)
                    // 我们就是最顶层，必须在这里处理掉错误，防止浏览器报 Uncaught Error
                    if (e.message === 'UpdateStopped') {
                        app.interaction.showToast('更新已手动终止');
                    } else {
                        console.error(e); // 打印具体错误以便调试
                        app.interaction.showToast(`更新失败: ${e.message}`);
                    }
                } finally {
                    if (icon) icon.classList.remove('fa-spin-fast');
                    // 只有在非批量模式下，单个更新结束才重置UI和刷新列表
                    if (!isBatchMode) {
                        this.refreshAllData();
                        this.resetFooter(); // 这里会将状态重置为 idle
                    }
                }
            }

            // 6. 批量更新 (支持暂停/停止)
            async updateAllCreators() {
                const creators = await app.customManager.getAll();
                const keys = Object.keys(creators).filter(k => creators[k].info.source_url);
                return this.runCreatorUpdateBatch(keys, creators, {
                    emptyText: '没有可更新的资源',
                    progressPrefix: '正在更新',
                    donePrefix: '批量更新完成',
                    logSkip: true
                });
            }

            refreshAllData() {
                this.refreshStats();
                this.renderList();
                app.interaction.showToast(`已刷新`);
            }

            exportCreator(name) { app.customManager.export(name); }
            clearDownloads() {
                if (confirm('清空下载记录？')) {
                    app.userDataManager.downloads = [];
                    app.userDataManager._save(app.userDataManager.KEYS.DOWNLOADS, []);
                    this.refreshAllData();
                }
            }
            clearAllCache() {
                if (confirm('【高危】这将清空所有本地数据！')) {
                    localStorage.clear();
                    location.reload();
                }
            }
        }

        // --- 6. 聊天系统控制器 ---
