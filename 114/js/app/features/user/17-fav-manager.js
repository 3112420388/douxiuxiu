/* v3 semantic split: class from js/app/05-interaction-download-user.js | keep script order */
        class FavManager {
            constructor() {
                this.sheet = document.getElementById('fav-select-sheet');
                this.listContainer = document.getElementById('fav-select-list');
                this.quickPanel = document.getElementById('fav-quick-panel');
                this.quickList = document.getElementById('fav-quick-list');
                this.currentWork = null;

                // 绑定输入框回车事件
                const input = document.getElementById('new-folder-name');
                if (input) {
                    input.addEventListener('keyup', (e) => {
                        if (e.key === 'Enter') this.confirmCreate();
                    });
                }
            }

            // --- 1. 弹窗控制 ---

            // 打开新建弹窗
            openCreateModal() {
                const modal = document.getElementById('create-folder-modal');
                const mask = document.getElementById('create-folder-mask');
                const input = document.getElementById('new-folder-name');

                input.value = ''; // 清空输入
                mask.classList.add('active');
                modal.style.display = 'block';
                // 强制重绘以触发 transition
                setTimeout(() => modal.classList.add('active'), 10);

                setTimeout(() => input.focus(), 300);

                // 绑定遮罩点击关闭
                mask.onclick = () => this.closeCreateModal();
            }

            // 关闭新建弹窗
            closeCreateModal() {
                const modal = document.getElementById('create-folder-modal');
                const mask = document.getElementById('create-folder-mask');

                modal.classList.remove('active');
                mask.classList.remove('active');

                setTimeout(() => {
                    modal.style.display = 'none';
                }, 200);
            }

            // --- 2. 核心创建逻辑 ---

            confirmCreate() {
                const input = document.getElementById('new-folder-name');
                const name = input.value.trim();

                if (!name) {
                    app.interaction.showToast('请输入名称');
                    return;
                }

                // 调用数据层创建
                const newFolder = app.userDataManager.createFolder(name);

                this.closeCreateModal();
                app.interaction.showToast(`收藏夹 "${name}" 创建成功`);

                // --- 3. 智能刷新 UI ---

                // A. 如果是在“选择收藏夹”面板中
                if (this.sheet.classList.contains('active')) {
                    this.renderSheetList(); // 刷新列表
                    // 可选：创建后自动选中并添加到该文件夹
                    if (this.currentWork) {
                        this.toggleFolder(newFolder.id);
                    }
                }

                // A-2. 如果是在“快速收藏侧栏”中
                if (this.quickPanel && this.quickPanel.classList.contains('active')) {
                    this.renderQuickList();
                    if (this.currentWork) {
                        this.toggleFolder(newFolder.id);
                    }
                }

                // B. 如果是在“我的页面”的收藏 Tab 中
                const myPage = document.getElementById('my-page');
                if (myPage && myPage.classList.contains('active')) {
                    // 重新触发一次 Tab 切换逻辑来刷新列表
                    app.pageManager.switchMyTab('favorites');
                }
            }

            // 打开“添加到收藏夹”面板
            openAddToSheet() {
                // 获取当前作品
                const idx = app.mainSwiper.activeIndex;
                this.currentWork = app.fullPlaylist[idx];

                if (!this.currentWork) return;

                this.renderSheetList();

                // --- 核心修改：加入历史记录栈 ---
                app.pageManager.pushState('fav-select');
                // -----------------------------

                this.sheet.classList.add('active');
            }

            // 关闭面板 (修改为触发系统返回)
            closeSheet() {
                // 不直接 remove class，而是后退一步
                // 这会触发 window.onpopstate -> PageManager.handleSystemBack -> 关闭面板
                history.back();
            }

            // 打开快速收藏侧栏
            openQuickPanel() {
                const idx = app.mainSwiper.activeIndex;
                this.currentWork = app.fullPlaylist[idx];

                if (!this.currentWork) return;

                this.renderQuickList();
                app.pageManager.pushState('fav-quick');

                if (this.quickPanel) this.quickPanel.classList.add('active');
                const mask = document.getElementById('global-mask');
                if (mask) mask.classList.add('active');
            }

            closeQuickPanel() {
                history.back();
            }

            // 渲染面板列表 (通用)
            renderFolderList(container) {
                if (!container) return;
                const folders = app.userDataManager.favData || [];

                if (!this.currentWork) {
                    container.innerHTML = '<div style="text-align:center; padding:20px; color:#666; font-size:12px;">暂无可收藏作品</div>';
                    return;
                }

                const html = folders.map(f => {
                    // 检查当前作品是否已在该文件夹
                    const isSaved = app.userDataManager.isInFolder(this.currentWork, f.id);
                    const icon = isSaved ? '<i class="fa-solid fa-check-circle" style="color:#52c41a"></i>' : '<i class="fa-regular fa-folder"></i>';
                    const activeClass = isSaved ? 'selected' : '';

                    // 获取首图作为封面
                    let coverHtml = '';
                    if (f.items.length > 0) {
                        const first = f.items[0];
                        const img = first.type === '视频' ? first.cover : (first.images[0] || '');
                        coverHtml = `<img src="${img}">`;
                    } else {
                        coverHtml = `<i class="fa-solid fa-folder-open" style="font-size:20px; color:#555"></i>`;
                    }

                    return `
            <div class="fav-folder-item ${activeClass}" onclick="app.favManager.toggleFolder('${f.id}')">
                <div class="fav-icon-box">${coverHtml}</div>
                <div class="fav-info">
                    <div class="fav-title">${f.name}</div>
                    <div class="fav-count">${f.items.length} 个作品</div>
                </div>
                <div style="font-size:20px;">${icon}</div>
            </div>`;
                }).join('');

                container.innerHTML = html;
            }

            // 渲染面板列表
            renderSheetList() {
                this.renderFolderList(this.listContainer);
            }

            renderQuickList() {
                this.renderFolderList(this.quickList);
            }

            toggleFolder(folderId) {
                // 检查是否已在文件夹
                const isSaved = app.userDataManager.isInFolder(this.currentWork, folderId);

                if (isSaved) {
                    // 执行移除
                    app.userDataManager.removeFromFolder(this.currentWork, folderId);
                    app.interaction.showToast('已从该文件夹移除');
                } else {
                    // 执行添加 (addToFolder 内部现在会再次检查，防止并发重复)
                    app.userDataManager.addToFolder(this.currentWork, folderId).then(success => {
                        if (success) {
                            app.interaction.showToast('已加入收藏夹');
                        } else {
                            // 如果返回 false，说明已存在
                            app.interaction.showToast('该作品已在收藏夹中');
                        }
                    });
                }

                // 重新渲染当前面板状态 (打勾/取消打勾)
                // 稍微延迟以等待 async 操作完成 (或者把 toggleFolder 改为 async)
                setTimeout(() => {
                    if (this.sheet.classList.contains('active')) {
                        this.renderSheetList();
                    }
                    if (this.quickPanel && this.quickPanel.classList.contains('active')) {
                        this.renderQuickList();
                    }

                    // 刷新“我的”页面统计和列表
                    app.pageManager.updateMyStats();
                    app.pageManager.refreshMyPageListIfActive('favorites');

                    // 刷新长按菜单状态
                    if (app.menuManager) app.menuManager.updateFavoriteBtnState();
                    this.updateQuickFavoriteIcon();
                }, 50);
            }

            updateQuickFavoriteIcon() {
                if (!app.mainSwiper) return;
                const idx = app.mainSwiper.activeIndex;
                const slide = app.mainSwiper.slides[idx];
                const work = app.fullPlaylist[idx];
                if (!slide || !work) return;

                // 修改选择器，对应上面添加的 main-fav-icon
                const icon = slide.querySelector('.main-fav-icon');
                if (!icon) return;

                const isFav = app.userDataManager.isFavorite(work);

                if (isFav) {
                    icon.style.color = '#face15';
                    icon.classList.add('fa-bounce');
                    icon.classList.add('fav-active-glow'); // 加上呼吸光晕类名

                    setTimeout(() => {
                        icon.classList.remove('fa-bounce');
                    }, 1000);
                } else {
                    icon.style.color = '#fff';
                    icon.classList.remove('fav-active-glow'); // 移除光晕
                }
            }

            // 新建收藏夹
            createNewFolder() {
                const name = prompt("请输入收藏夹名称：");
                if (name && name.trim()) {
                    app.userDataManager.createFolder(name.trim());
                    this.renderSheetList();

                    // 如果在“我的”页面，也刷新
                    if (document.getElementById('my-page').classList.contains('active')) {
                        app.pageManager.switchMyTab('favorites');
                    }
                }
            }

            // 1. 打开收藏夹详情页 (渲染列表 + 移除按钮)
            openFolderDetail(folderId) {
                const folder = app.userDataManager.favData.find(f => f.id === folderId);
                if (!folder) return;

                document.getElementById('fav-detail-title').innerText = folder.name;

                // 头部操作栏 (保持不变)
                const actionBox = document.getElementById('fav-detail-actions');
                let headerHtml = `<i class="fa-solid fa-file-export" style="color:#b388eb; cursor:pointer; margin-right:15px;" onclick="app.favManager.exportFolder('${folder.id}')" title="导出收藏夹"></i>`;
                if (folder.id !== 'default') {
                    headerHtml += `<i class="fa-solid fa-trash-can" style="color:#ff4d4f; cursor:pointer;" onclick="app.favManager.doDeleteFolder('${folder.id}')"></i>`;
                }
                actionBox.innerHTML = headerHtml;

                // 渲染内容网格
                const grid = document.getElementById('fav-detail-grid');
                const empty = document.getElementById('fav-empty-tip');

                if (folder.items.length === 0) {
                    grid.innerHTML = '';
                    empty.style.display = 'block';
                } else {
                    empty.style.display = 'none';
                    // 临时保存当前列表供播放跳转使用
                    app.currentFavContext = folder.items;

                    const html = folder.items.map((w, i) => renderWorkGridItem(w, i, {
                        clickAction: `app.playFromFavDetail(${i})`,
                        removeAction: `app.favManager.removeItemFromFolder('${folder.id}', ${i}, event)`,
                        typeFallback: '视频'
                    })).join('');
                    grid.innerHTML = html;
                }

                app.pageManager.pushState('fav-detail');
                document.getElementById('fav-detail-page').classList.add('active');
            }

            // 2. 【新增】处理单个移出逻辑
            async removeItemFromFolder(folderId, index, event) {
                // 阻止冒泡，防止触发播放
                if (event) event.stopPropagation();

                if (!confirm('确定将此作品移出收藏夹吗？')) return;

                const folder = app.userDataManager.favData.find(f => f.id === folderId);
                if (!folder || !folder.items[index]) return;

                const work = folder.items[index];

                // 调用 UserDataManager 执行移除
                await app.userDataManager.removeFromFolder(work, folderId);

                app.interaction.showToast('已移出');

                // 重新渲染当前详情页 (实现即时刷新)
                this.openFolderDetail(folderId);

                // 刷新“我的”页面的统计数据
                app.pageManager.updateMyStats();
                // 刷新“我的”页面列表 (如果正好停在收藏Tab)
                app.pageManager.refreshMyPageListIfActive('favorites');
            }
            // 新增：导出收藏夹 (修改版：使用首图作为头像)
            exportFolder(folderId) {
                const folder = app.userDataManager.favData.find(f => f.id === folderId);
                if (!folder) return;

                if (folder.items.length === 0) {
                    app.interaction.showToast('收藏夹为空，无法导出');
                    return;
                }

                // 1. 定义默认兜底图标 (黄色文件夹 SVG)
                const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23face15"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';

                // 2. 【核心修改】尝试提取第一个作品的封面
                let coverAvatar = defaultAvatar;

                if (folder.items.length > 0) {
                    const firstWork = folder.items[0];

                    // 逻辑：优先取 cover 字段 (通常是视频封面)
                    if (firstWork.cover && firstWork.cover.startsWith('http')) {
                        coverAvatar = firstWork.cover;
                    }
                    // 其次：如果是图集，取 images 数组的第一张
                    else if (firstWork.images && firstWork.images.length > 0) {
                        const firstImg = firstWork.images[0];
                        // 兼容数据结构：可能是字符串，也可能是 [url, w, h] 数组
                        coverAvatar = Array.isArray(firstImg) ? firstImg[0] : firstImg;
                    }
                }

                // 3. 构造导出数据
                const exportData = {
                    info: {
                        name: folder.name, // 文件夹名称作为资源名

                        // 使用提取到的封面，如果提取失败则使用默认文件夹图标
                        avatar: coverAvatar,

                        signature: `来自收藏夹导出 (${folder.items.length}个作品)`,
                        source_url: '',
                        last_updated: Date.now(),
                        origin_type: 'favorite' // 标记来源
                    },
                    works: folder.items
                };

                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                saveAs(blob, `收藏夹_${folder.name}.json`);
                app.interaction.showToast('已导出，可在“添加资源”页导入');
            }
            doDeleteFolder(folderId) {
                if (confirm('确定删除此收藏夹吗？里面的收藏记录也会被删除。')) {
                    app.userDataManager.deleteFolder(folderId);
                    app.pageManager.closePage('fav-detail-page');
                    app.pageManager.switchMyTab('favorites'); // 刷新列表
                    app.pageManager.updateMyStats();
                    app.interaction.showToast('收藏夹已删除');
                }
            }
        }
        // ==========================================
        //  1. AccountManager (修复版 - 补全缺失方法)
        // ==========================================
