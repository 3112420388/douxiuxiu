/* v3 semantic split: class from js/app/06-account-resource-data-chat.js | keep script order */
        class ResourceManager {
            constructor() {
                this.currentName = null;
                this.data = null;
                this.renderToken = 0;
                this.renderBatchSize = 30;
                this.pageEl = document.getElementById('resource-manage-page');
                if (this.pageEl) {
                    const observer = new MutationObserver(() => {
                        if (!this.pageEl.classList.contains('active')) {
                            this.renderToken += 1; // 取消未完成的渲染
                        }
                    });
                    observer.observe(this.pageEl, { attributes: true, attributeFilter: ['class'] });
                    this.pageObserver = observer;
                }
            }

            // 打开管理页 (需保持异步)
            async open(name, event) {
                if (event) event.preventDefault();

                this.currentName = name;
                const all = await app.customManager.getAll();
                this.data = all[name];

                if (!this.data) {
                    app.interaction.showToast('资源数据不在本地');
                    return;
                }

                const isFav = this.data.info.origin_type === 'favorite';
                const favAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23face15"/><path fill="%23ffffff" d="M50 72.4L24.1 86l4.9-28.8L8 36.6l28.9-4.2L50 6l13.1 26.4 28.9 4.2-21 20.6 4.9 28.8z"/></svg>';
                const genericAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%235cc9ff"/><path fill="%23ffffff" d="M50 25a20 20 0 1 0 0 40 20 20 0 0 0 0-40zm0 48c-18 0-34 9-34 22h68c0-13-16-22-34-22z"/></svg>';
                const currentDefault = isFav ? favAvatar : genericAvatar;

                document.getElementById('rm-name-input').value = this.data.info.name;
                document.getElementById('rm-url-input').value = this.data.info.source_url || '';
                const avatarUrl = this.data.info.avatar || '';
                document.getElementById('rm-avatar-input').value = avatarUrl;
                document.getElementById('rm-avatar-preview').src = avatarUrl || currentDefault;

                document.getElementById('rm-avatar-input').oninput = (e) => {
                    const val = e.target.value.trim();
                    document.getElementById('rm-avatar-preview').src = val || currentDefault;
                };

                app.pageManager.pushState('resource-manage');
                document.getElementById('resource-manage-page').classList.add('active');
                document.getElementById('sidebar-page').classList.remove('active');
                document.getElementById('global-mask').classList.remove('active');

                this.renderCollectionSelect();
                this.updateLocalControls();
                this.renderWorks({ defer: true });
            }

            async openLocal(type, event) {
                if (event) event.preventDefault();
                await app.ensureLocalCreatorData(type, { persistMissing: true });
                const cfg = app.getLocalMediaConfig(type);
                return this.open(cfg.name);
            }

            isLocalResource() {
                return !!(this.data && this.data.info && this.data.info.origin_type === 'local');
            }

            getLocalType() {
                if (this.data && this.data.info && this.data.info.local_type) return this.data.info.local_type;
                if (this.currentName === LOCAL_MEDIA_CONFIG.video.name) return 'video';
                if (this.currentName === LOCAL_MEDIA_CONFIG.music.name) return 'music';
                return '';
            }

            updateLocalControls() {
                const isLocal = this.isLocalResource();
                const scanGroup = document.getElementById('rm-local-scan-group');
                const mixGroup = document.getElementById('rm-local-mix-group');
                const updateBtn = document.getElementById('rm-update-btn');
                const deleteBtn = document.getElementById('rm-delete-btn');
                const nameInput = document.getElementById('rm-name-input');
                const urlInput = document.getElementById('rm-url-input');

                if (scanGroup) scanGroup.style.display = isLocal ? '' : 'none';
                if (mixGroup) mixGroup.style.display = isLocal ? '' : 'none';

                if (updateBtn) {
                    if (isLocal) {
                        updateBtn.style.display = '';
                        updateBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 扫描';
                        updateBtn.onclick = () => this.scanLocal();
                    } else {
                        updateBtn.style.display = '';
                        updateBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 立即联网更新';
                        updateBtn.onclick = () => this.triggerUpdate();
                    }
                }
                if (deleteBtn) {
                    if (isLocal) {
                        deleteBtn.style.display = '';
                        deleteBtn.setAttribute('title', '清除扫描记录');
                        deleteBtn.onclick = () => this.clearLocalCache();
                    } else {
                        deleteBtn.style.display = '';
                        deleteBtn.setAttribute('title', '删除整个资源合集');
                        deleteBtn.onclick = () => this.deleteCurrentResource();
                    }
                }
                if (nameInput) {
                    nameInput.readOnly = isLocal;
                    nameInput.style.opacity = isLocal ? '0.7' : '';
                }
                if (urlInput) {
                    urlInput.readOnly = isLocal;
                    urlInput.style.opacity = isLocal ? '0.7' : '';
                }
                if (isLocal) {
                    this.refreshLocalScanStatus();
                    this.refreshLocalMixToggle();
                    this.renderLocalScanControls('扫描准备就绪', false, false);
                }
            }

            refreshLocalScanStatus() {
                const status = document.getElementById('rm-local-scan-status');
                if (!status) return;
                const ts = this.data && this.data.info ? this.data.info.last_updated : 0;
                if (!ts) {
                    status.innerText = '尚未扫描';
                    return;
                }
                status.innerText = `上次扫描：${new Date(ts).toLocaleString()}`;
            }

            setLocalScanStatusText(text) {
                const status = document.getElementById('rm-local-scan-status');
                if (!status) return;
                status.innerText = text;
            }

            renderLocalScanControls(msg, isPaused = false, active = false) {
                const controls = document.getElementById('rm-local-scan-controls');
                if (!controls) return;
                if (!active) {
                    controls.style.display = 'none';
                    return;
                }
                const icon = isPaused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
                const action = isPaused ? 'app.resumeLocalScan()' : 'app.pauseLocalScan()';
                const cls = isPaused ? 'resume' : 'pause';
                controls.style.display = 'flex';
                controls.innerHTML = `
                    <div class="dm-progress-text">
                        <i class="fa-solid fa-spinner ${isPaused ? '' : 'fa-spin'}"></i> ${msg}
                    </div>
                    <button class="dm-ctrl-btn ${cls}" onclick="${action}">
                        ${icon}
                    </button>
                    <button class="dm-ctrl-btn stop" onclick="app.stopLocalScan()">
                        <i class="fa-solid fa-stop"></i>
                    </button>
                `;
            }

            refreshLocalMixToggle() {
                const toggle = document.getElementById('rm-local-mix-toggle');
                if (!toggle) return;
                const mixEnabled = this.data && this.data.info && this.data.info.mix_enabled !== undefined
                    ? this.data.info.mix_enabled
                    : true;
                toggle.checked = !!mixEnabled;
            }

            async toggleLocalMix(enabled) {
                if (!this.isLocalResource() || !this.data) return;
                this.data.info = this.data.info || {};
                this.data.info.mix_enabled = !!enabled;
                const allCreators = await app.customManager.getAll();
                allCreators[this.currentName] = this.data;
                await app.customManager.saveAll(allCreators);
                if (app.dataLoader && app.dataLoader.globalCreators) {
                    app.dataLoader.globalCreators[this.currentName] = this.data;
                }
                if (app.dataSystem && app.dataSystem.currentTab === 'creators') app.dataSystem.renderList();
                if (app.renderer) app.renderer.renderSidebar(app.dataLoader.globalCreators);
            }
            // 【新增】点击列表播放
            playFromResourceManage(index) {
                if (!this.data || !this.data.works || this.data.works.length === 0) return;

                // 进入上下文播放模式，传入当前列表的副本
                app.enterContextPlay([...this.data.works], index);
            }

            renderWorks({ defer = true } = {}) {
                const container = document.getElementById('rm-works-grid');
                const countBadge = document.getElementById('rm-count-badge');
                const list = this.data.works || [];

                countBadge.innerText = `${list.length} 个作品`;

                if (list.length === 0) {
                    container.innerHTML = '<div style="text-align:center; padding:40px 0; color:#666; font-size:13px;">暂无作品</div>';
                    return;
                }

                container.innerHTML = '';
                const token = ++this.renderToken;
                const batchSize = this.renderBatchSize;
                let index = 0;

                const renderBatch = () => {
                    if (token !== this.renderToken) return;
                    const page = document.getElementById('resource-manage-page');
                    if (page && !page.classList.contains('active')) return;

                    const batch = list.slice(index, index + batchSize);
                    if (batch.length === 0) return;

                    const html = batch.map((w, i) => {
                        const globalIndex = index + i;
                        return renderUniWorkListItem(w, globalIndex, {
                            clickAction: `app.resourceManager.playFromResourceManage(${globalIndex})`,
                            itemStyle: 'cursor:pointer; background:rgba(255,255,255,0.03); position: relative;',
                            infoStyle: 'padding-right: 40px;',
                            fallbackAuthor: this.data.info.name || '未知',
                            fallbackAvatar: this.data.info.avatar || '',
                            showTopBadge: true,
                            topBadgeStyle: 'font-size:8px; padding:0 3px;',
                            deleteAction: `event.stopPropagation(); app.resourceManager.deleteSingleWork(${globalIndex})`
                        });
                    }).join('');
                    container.insertAdjacentHTML('beforeend', html);

                    index += batchSize;
                    if (index < list.length) {
                        requestAnimationFrame(renderBatch);
                    }
                };

                if (defer) {
                    requestAnimationFrame(renderBatch);
                } else {
                    renderBatch();
                }
            }

            // --- 修复点：异步保存信息 ---
            async saveInfo() {
                const newName = document.getElementById('rm-name-input').value.trim();
                const newUrl = document.getElementById('rm-url-input').value.trim();
                const newAvatar = document.getElementById('rm-avatar-input').value.trim();

                if (!newName) return app.interaction.showToast('名称不能为空');

                const allCreators = await app.customManager.getAll();
                const oldName = this.currentName;

                if (newName !== oldName && allCreators[newName]) {
                    return app.interaction.showToast('该名称已存在，请换一个');
                }

                const isFav = this.data.info.origin_type === 'favorite';
                const favAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23face15"/><path fill="%23ffffff" d="M50 72.4L24.1 86l4.9-28.8L8 36.6l28.9-4.2L50 6l13.1 26.4 28.9 4.2-21 20.6 4.9 28.8z"/></svg>';
                const genericAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%235cc9ff"/><path fill="%23ffffff" d="M50 25a20 20 0 1 0 0 40 20 20 0 0 0 0-40zm0 48c-18 0-34 9-34 22h68c0-13-16-22-34-22z"/></svg>';
                const currentDefault = isFav ? favAvatar : genericAvatar;

                this.data.info.name = newName;
                this.data.info.source_url = newUrl;
                this.data.info.avatar = newAvatar || currentDefault;

                if (newName !== oldName) {
                    delete allCreators[oldName];
                    allCreators[newName] = this.data;
                    this.currentName = newName;
                    if (app.dataSystem && typeof app.dataSystem.renameCreatorKey === 'function') {
                        await app.dataSystem.renameCreatorKey(oldName, newName);
                    }
                } else {
                    allCreators[oldName] = this.data;
                }

                // ★★★ 修复：使用 saveAll 存入 DB
                await app.customManager.saveAll(allCreators);

                app.dataLoader.globalCreators = allCreators;
                app.renderer.renderSidebar(allCreators);
                app.interaction.showToast('保存成功');
                await this.renderCollectionSelect();
            }

            async renderCollectionSelect() {
                const select = document.getElementById('rm-collection-select');
                if (!select) return;
                if (!app.dataSystem || typeof app.dataSystem.getCollectionData !== 'function') return;

                const data = await app.dataSystem.getCollectionData();
                const list = Array.isArray(data.list) ? data.list : [];
                const assignments = data.assignments || {};
                const current = assignments[this.currentName] || '';

                let options = `<option value="">未归类</option>`;
                list.forEach(name => {
                    options += `<option value="${name}">${name}</option>`;
                });
                select.innerHTML = options;
                select.value = current;
            }

            async saveCollectionAssignment() {
                const select = document.getElementById('rm-collection-select');
                if (!select) return;
                const value = select.value;
                if (app.dataSystem && typeof app.dataSystem.setCreatorCollection === 'function') {
                    await app.dataSystem.setCreatorCollection(this.currentName, value);
                    if (app.dataSystem.updateState === 'idle') app.dataSystem.resetFooter();
                    if (app.dataSystem.currentTab === 'creators') app.dataSystem.renderList();
                    app.renderer.renderSidebar(app.dataLoader.globalCreators);
                    app.interaction.showToast('合集已更新');
                }
            }

            // --- 修复点：异步删除单个作品 ---
            async deleteSingleWork(index) {
                if (!confirm('确定删除这个作品吗？')) return;

                this.data.works.splice(index, 1);

                const allCreators = await app.customManager.getAll();
                allCreators[this.currentName] = this.data;

                // ★★★ 修复：使用 saveAll 存入 DB
                await app.customManager.saveAll(allCreators);

                this.renderWorks();
                app.interaction.showToast('作品已删除');
            }

            async scanLocal() {
                const type = this.getLocalType();
                if (!type) return;
                const works = await app.runLocalScan(type, { force: false });
                const cfg = app.getLocalMediaConfig(type);
                const creator = app.dataLoader.globalCreators[cfg.name];
                if (creator) this.data = creator;
                this.renderWorks();
                this.refreshLocalScanStatus();
                if (!works.length) app.interaction.showToast(`${cfg.name}暂无可用文件`);
            }

            async clearLocalCache() {
                const type = this.getLocalType();
                if (!type) return;
                if (!confirm('确定清除扫描记录吗？')) return;
                const cfg = app.getLocalMediaConfig(type);
                await app.resetLocalMediaData(type);
                const creator = app.dataLoader.globalCreators[cfg.name];
                if (creator) this.data = creator;
                this.renderWorks();
                this.refreshLocalScanStatus();
                this.refreshLocalMixToggle();
                app.interaction.showToast('扫描记录已清除');
            }

            // 触发联网更新
            async triggerUpdate() {
                if (this.isLocalResource()) {
                    return this.scanLocal();
                }
                const url = this.data.info.source_url;
                if (!url) return app.interaction.showToast('未配置数据源链接，无法更新');
                app.pageManager.closePage('resource-manage-page');
                setTimeout(() => {
                    app.dataSystem.open();
                    app.dataSystem.switchTab('creators');
                    app.dataSystem.updateCreator(this.currentName, url);
                }, 300);
            }

            exportData() {
                app.customManager.export(this.currentName);
            }

            deleteCurrentResource() {
                if (this.isLocalResource()) {
                    return this.clearLocalCache();
                }
                if (confirm(`【高危】确定要彻底删除资源合集 "${this.currentName}" 吗？\n所有数据将不可恢复。`)) {
                    // 注意：customManager.delete 已经是异步的
                    app.customManager.delete(this.currentName).then(success => {
                        if (success) {
                            delete app.dataLoader.globalCreators[this.currentName];
                            app.renderer.renderSidebar(app.dataLoader.globalCreators);
                            app.pageManager.closePage('resource-manage-page');
                            app.interaction.showToast('资源已删除');
                        }
                    });
                }
            }
        }
