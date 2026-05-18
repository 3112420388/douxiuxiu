/* v3 semantic split: class from js/app/05-interaction-download-user.js | keep script order */
        class DownloadManager {
            constructor() {
                this.tasks = [];
                // 1. 从 Api 模块获取代理前缀
                this.proxy = Api.getProxyPrefix();
                this.currentView = 'active'; // active | history
                this.floatBtn = document.getElementById('download-float-btn');
                this.badge = document.getElementById('df-badge-count');

                // 缓存当前待下载的资源列表和元数据
                this.currentAssets = [];
                this.currentMeta = null;
            }

            // 切换下载页面的 Tab
            switchTab(tab, btn) {
                this.currentView = tab;

                // 样式切换
                const parent = btn.parentElement;
                setActiveButton(parent.querySelectorAll('.view-btn'), btn);

                const containerActive = document.getElementById('download-task-list');
                const containerHistory = document.getElementById('download-history-list');
                const emptyTip = document.getElementById('no-task-tip');
                const clearBtn = document.querySelector('#download-center-page .header-right');

                containerActive.style.display = 'none';
                containerHistory.style.display = 'none';
                emptyTip.style.display = 'none';

                if (tab === 'active') {
                    containerActive.style.display = 'block';
                    this.renderTasks();
                    // 扫把按钮功能：清除已完成/失败的任务，保留进行中
                    clearBtn.onclick = () => this.clearFinishedTasks();
                } else {
                    containerHistory.style.display = 'block';
                    this.renderHistory();
                    // 扫把按钮功能：清空历史记录
                    clearBtn.onclick = () => this.clearHistoryLog();
                }
            }

            // 创建下载任务
            createTask(type, name) {
                const task = {
                    id: Date.now() + Math.random(),
                    type: type, // 'zip' or 'file'
                    name: name,
                    progress: 0,
                    status: 'running', // running, success, error
                    startTime: Date.now()
                };
                this.tasks.unshift(task);
                this.renderTasks();
                this.updateActiveCount();
                return task;
            }

            updateTask(id, progress, status = null) {
                const task = this.tasks.find(t => t.id === id);
                if (task) {
                    task.progress = progress;
                    if (status) task.status = status;

                    // 仅在当前视图为 active 时才操作 DOM，提升性能
                    if (this.currentView === 'active') {
                        this.renderTaskItem(task);
                    }

                    if (status === 'success' || status === 'error') {
                        this.updateActiveCount();
                    }
                }
            }

            // 获取选中资源的链接 (复制用)
            getLinks(idxs) {
                return idxs.map(i => {
                    const asset = this.currentAssets[i];
                    return asset ? asset.url : '';
                }).filter(url => url).join('\n');
            }

            // --- 内部辅助：检查积分 ---
            _checkQuota(amount) {
                if (!app.quotaManager.consume(amount)) {
                    app.interaction.showQuotaAlert();
                    return false;
                }
                return true;
            }

            // 核心 1: 打包下载 (Zip)
            async downloadZip(idxs) {
                if (!this._checkQuota(1)) return; // 扣除1次积分

                const zipName = this.generateZipName();
                const task = this.createTask('zip', zipName + '.zip');

                app.interaction.showToast('已加入下载任务列表');

                try {
                    const zip = new JSZip();
                    const folder = zip.folder(zipName); // 创建同名文件夹

                    let processed = 0;
                    const total = idxs.length;

                    // 并发下载
                    const jobs = idxs.map(async (i) => {
                        const f = this.currentAssets[i];
                        if (!f) return;

                        try {
                            // === 修改：使用 Api.Download.getBlob ===
                            // 视频走代理(true)，图片直连(false)
                            const useProxy = (f.type === "video");
                            const blob = await Api.Download.getBlob(f.url, useProxy);

                            if (blob) {
                                folder.file(f.name, blob);
                            } else {
                                throw new Error('Blob is null');
                            }
                        } catch (e) {
                            console.error(`File ${f.name} download failed:`, e);
                        }

                        processed++;
                        // 阶段1进度：0% - 80% (预留20%给压缩)
                        this.updateTask(task.id, (processed / total) * 80);
                    });

                    await Promise.all(jobs);

                    // 阶段2：生成压缩包
                    const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
                        const percent = 80 + (metadata.percent * 0.2);
                        this.updateTask(task.id, percent);
                    });

                    saveAs(content, zipName + ".zip");
                    this.updateTask(task.id, 100, 'success');
                    app.userDataManager.addDownloadLog('zip', zipName, '打包下载');

                } catch (e) {
                    this.updateTask(task.id, 0, 'error');
                    console.error("Zip download failed:", e);
                    app.interaction.showToast("打包失败");
                }
            }

            // 核心 2: 直接下载 (Direct)
            async downloadDirect(idxs) {
                const count = idxs.length;
                if (!this._checkQuota(count)) return; // 扣除 count 次积分

                app.interaction.showToast(`开始下载 ${count} 个文件`);

                for (let i of idxs) {
                    const f = this.currentAssets[i];
                    if (!f) continue;

                    const task = this.createTask('file', f.name);

                    try {
                        this.updateTask(task.id, 10); // 初始进度

                        // === 修改：使用 Api.Download.getBlob ===
                        const useProxy = (f.type === "video");
                        const blob = await Api.Download.getBlob(f.url, useProxy);

                        this.updateTask(task.id, 80); // 下载完成，准备保存

                        if (blob) {
                            saveAs(blob, f.name);
                            this.updateTask(task.id, 100, 'success');
                            app.userDataManager.addDownloadLog(f.type, f.name, f.url);
                        } else {
                            throw new Error("Blob is null");
                        }
                    } catch (e) {
                        this.updateTask(task.id, 0, 'error');
                        console.error(`Direct download failed for ${f.name}:`, e);

                        // 失败回退：尝试打开新窗口让浏览器自己处理
                        // window.open(f.url, '_blank');
                    }
                }
            }

            // 生成文件名
            generateZipName() {
                const timestamp = Date.now();
                const struct = CONFIG.ZIP_STRUCTURE || 'simple';

                const meta = this.currentMeta || { title: 'download', author: 'user' };
                // 简单的去特殊字符处理
                const safeTitle = (meta.title || '').replace(/[\\/:*?"<>|]/g, '_').substring(0, 20);
                const safeAuthor = (meta.author || '').replace(/[\\/:*?"<>|]/g, '_');

                const date = new Date();
                const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate()}`;

                if (struct === 'author') {
                    return `[${safeAuthor}]_${safeTitle}`;
                } else if (struct === 'date') {
                    return `[${dateStr}]_${safeTitle}`;
                } else {
                    return `download_${timestamp}`;
                }
            }

            // 准备资源数据
            prepareAssets(data) {
                this.currentMeta = data; // 保存元数据供命名使用
                this.currentAssets = [];

                if (!data) return [];

                if (data.type === "视频") {
                    this.currentAssets.push({
                        type: "video",
                        url: data.url,
                        name: `video_${Date.now()}.mp4`
                    });
                } else if (data.images) {
                    data.images.forEach((img, i) => {
                        // 兼容图片数组格式 [url, w, h]
                        const url = Array.isArray(img) ? img[0] : img;
                        this.currentAssets.push({
                            type: "image",
                            url: url,
                            name: `img_${i + 1}.jpg`
                        });
                    });
                }

                return this.currentAssets;
            }

            // --- UI 渲染部分 ---

            renderTasks() {
                const container = document.getElementById('download-task-list');
                const emptyTip = document.getElementById('no-task-tip');

                if (this.currentView !== 'active') return;

                if (this.tasks.length === 0) {
                    container.innerHTML = '';
                    emptyTip.style.display = 'block';
                    const tipDiv = emptyTip.querySelector('div');
                    if (tipDiv) tipDiv.innerText = '暂无进行中的任务';
                    return;
                }
                emptyTip.style.display = 'none';
                container.innerHTML = this.tasks.map(t => this.createTaskHtml(t)).join('');
            }

            renderHistory() {
                const container = document.getElementById('download-history-list');
                const emptyTip = document.getElementById('no-task-tip');
                const list = app.userDataManager.downloads;

                if (!list || list.length === 0) {
                    container.innerHTML = '';
                    emptyTip.style.display = 'block';
                    const tipDiv = emptyTip.querySelector('div');
                    if (tipDiv) tipDiv.innerText = '暂无历史记录';
                    return;
                }
                emptyTip.style.display = 'none';
                container.innerHTML = list.map(d => renderDownloadHistoryItem(d, {
                    rowClick: "app.interaction.showToast('文件已保存在本地')",
                    actionIcon: 'fa-check'
                })).join('');
            }

            clearHistoryLog() {
                if (confirm('确定清空所有历史下载记录吗？')) {
                    app.userDataManager.downloads = [];
                    app.userDataManager._save(app.userDataManager.KEYS.DOWNLOADS, []);
                    this.renderHistory();
                }
            }

            createTaskHtml(t) {
                let statusText = '下载中...';
                let statusClass = 'status-running';
                if (t.status === 'success') { statusText = '已完成'; statusClass = 'status-success'; }
                if (t.status === 'error') { statusText = '失败'; statusClass = 'status-error'; }

                return `
                <div class="task-item" id="task-${t.id}">
                    <div class="task-header">
                        <div class="task-name">${t.name}</div>
                        <div class="task-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar-fill" style="width: ${t.progress}%"></div>
                    </div>
                </div>`;
            }

            renderTaskItem(t) {
                const el = document.getElementById(`task-${t.id}`);
                if (!el) return;

                const bar = el.querySelector('.progress-bar-fill');
                const status = el.querySelector('.task-status');

                if (bar) bar.style.width = `${t.progress}%`;
                if (status) {
                    if (t.status === 'success') {
                        status.innerText = '已完成';
                        status.className = 'task-status status-success';
                    } else if (t.status === 'error') {
                        status.innerText = '失败';
                        status.className = 'task-status status-error';
                    } else {
                        status.innerText = `下载中 ${Math.floor(t.progress)}%`;
                    }
                }
            }

            updateActiveCount() {
                // 计算正在运行的任务
                const count = this.tasks.filter(t => t.status === 'running').length;

                // 更新设置页的数字
                const settingBadge = document.getElementById('active-task-count');
                if (settingBadge) settingBadge.innerText = count;

                // 控制悬浮球
                if (this.floatBtn) {
                    if (count > 0) {
                        this.floatBtn.style.display = 'flex';
                        this.floatBtn.querySelector('.df-text').innerText = '下载中';
                        this.badge.innerText = count;
                        this.badge.style.display = 'block';
                    } else {
                        // 只有在显示状态下才变为“已完成”然后隐藏
                        if (this.floatBtn.style.display === 'flex' || this.floatBtn.style.display === '') {
                            // 只有当之前有任务现在没了，才显示完成状态
                            // 这里简单处理：只要是0就尝试进入完成态
                            const hasFinishedTasks = this.tasks.some(t => t.status === 'success');
                            if (hasFinishedTasks) {
                                this.floatBtn.querySelector('.df-text').innerText = '已完成';
                                this.badge.style.display = 'none';

                                setTimeout(() => {
                                    // 再次检查，防止5秒内又有新任务
                                    const currRunning = this.tasks.filter(t => t.status === 'running').length;
                                    if (currRunning === 0) {
                                        this.floatBtn.style.display = 'none';
                                    }
                                }, 5000);
                            } else {
                                this.floatBtn.style.display = 'none';
                            }
                        }
                    }
                }
            }

            clearFinishedTasks() {
                // 保留正在运行的任务
                this.tasks = this.tasks.filter(t => t.status === 'running');
                this.renderTasks();
                this.updateActiveCount();
            }
        }
        // --- 用户数据管理器 (IndexedDB 重构版) ---
