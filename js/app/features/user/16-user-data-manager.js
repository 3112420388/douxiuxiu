/* v3 semantic split: class from js/app/05-interaction-download-user.js | keep script order */
        class UserDataManager {
            constructor() {
                this.KEYS = {
                    LIKES: 'dxx_user_likes',
                    MUSIC: 'dxx_user_music',
                    DOWNLOADS: 'dxx_user_downloads',
                    FAV_DATA: 'dxx_fav_data',
                    PROFILE: 'dxx_user_profile'
                };

                // 内存缓存 (用于 UI 快速渲染)
                this.likes = [];
                this.music = [];
                this.downloads = [];
                this.favData = [];
                this.userProfile = {};

                // 标记数据是否已加载
                this.isReady = false;
            }
            // 1. 处理文件选择 (压缩并转 Base64)
            handleAvatarFile(input) {
                const file = input.files[0];
                if (!file) return;

                // 文件大小限制 (例如 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    app.interaction.showToast('图片太大，请选择小于5MB的图片');
                    return;
                }

                app.interaction.showToast('正在处理图片...');

                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.src = e.target.result;
                    img.onload = () => {
                        // --- 图片压缩逻辑 ---
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        // 限制最大尺寸 (500px足够清晰且不占太多空间)
                        const maxWidth = 500;
                        const maxHeight = 500;
                        let width = img.width;
                        let height = img.height;

                        // 计算缩放比例
                        if (width > height) {
                            if (width > maxWidth) {
                                height *= maxWidth / width;
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width *= maxHeight / height;
                                height = maxHeight;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);

                        // 导出为 JPEG (质量 0.7) 大幅减小体积
                        const base64 = canvas.toDataURL('image/jpeg', 0.7);

                        // 更新 UI 和 隐藏的输入框
                        document.getElementById('edit-avatar-preview').src = base64;
                        document.getElementById('edit-avatar').value = base64; // 赋值给旧逻辑用的输入框

                        app.interaction.showToast('图片已准备就绪');
                    };
                };
                reader.readAsDataURL(file);
            }

            getDefaultProfile() {
                return {
                    nickname: '未登录',
                    uid: '点击头像登录',
                    avatar: 'https://q1.qlogo.cn/g?b=qq&nk=10001&s=640'
                };
            }
            // 初始化：从 DB 加载数据到内存
            async init() {
                try {
                    // 1. 加载其他本地数据 (收藏、音乐、下载等保持本地存储)
                    const [likes, music, downloads, favData] = await Promise.all([
                        StorageService.get(this.KEYS.LIKES, []),
                        StorageService.get(this.KEYS.MUSIC, []),
                        StorageService.get(this.KEYS.DOWNLOADS, []),
                        StorageService.get(this.KEYS.FAV_DATA, null)
                    ]);

                    this.likes = likes;
                    this.music = music;
                    this.downloads = downloads;

                    // 初始化收藏夹
                    if (!favData || !Array.isArray(favData)) {
                        await this.initFavData();
                    } else {
                        this.favData = favData;
                    }

                    // ============================================================
                    // ★★★ 核心修改：用户信息同步逻辑 ★★★
                    // ============================================================

                    // A. 先读取本地缓存作为默认值 (防止网络延迟导致界面空白)
                    let profile = await StorageService.get(this.KEYS.PROFILE, this.getDefaultProfile());
                    this.userProfile = profile;

                    // B. 如果已登录，从服务器获取最新数据
                    if (app.accountManager && app.accountManager.user) {
                        try {
                            const res = await Api.Auth.getUserInfo(app.accountManager.user.id);
                            if (res.code === 200 && res.data) {
                                const serverUser = res.data;

                                // 1. 更新 UserDataManager 的 profile
                                this.userProfile = {
                                    nickname: serverUser.username,
                                    uid: serverUser.id,
                                    avatar: serverUser.avatar
                                };

                                // 2. 更新 AccountManager 的 user 对象 (包含硬币等信息)
                                app.accountManager.user.username = serverUser.username;
                                app.accountManager.user.avatar = serverUser.avatar;
                                app.accountManager.user.coins = serverUser.coins;
                                app.accountManager.user.role = serverUser.role;

                                // 3. 保存最新数据到本地缓存
                                app.accountManager.saveLocal(); // 这会自动调用 updateAllUI 刷新界面
                                await this._save(this.KEYS.PROFILE, this.userProfile);

                                console.log('用户信息已从数据库同步');
                            }
                        } catch (err) {
                            console.warn('云端用户信息同步失败，使用本地缓存', err);
                        }
                    }
                    // ============================================================

                    this.isReady = true;
                    console.log("UserDataManager initialized (Async)");

                    // 再次刷新 UI 确保显示的是最新数据
                    this.refreshProfileUI();
                    if (app.accountManager) app.accountManager.updateAllUI();

                } catch (e) {
                    console.error("User Data Init Failed:", e);
                }
            }



            // 初始化收藏夹结构
            async initFavData() {
                // 尝试迁移旧的 localStorage 数据 (兼容性)
                let oldFavs = [];
                try {
                    oldFavs = JSON.parse(localStorage.getItem('dxx_user_favorites') || '[]');
                } catch (e) { }

                this.favData = [{
                    id: 'default',
                    name: '默认收藏',
                    createTime: Date.now(),
                    items: oldFavs
                }];
                await this._save(this.KEYS.FAV_DATA, this.favData);
            }

            // 内部保存方法
            async _save(key, data) {
                await StorageService.set(key, data);
            }

            // --- 文件夹管理 ---
            async createFolder(name) {
                const newFolder = {
                    id: 'fav_' + Date.now(),
                    name: name,
                    createTime: Date.now(),
                    items: []
                };
                this.favData.push(newFolder);
                await this._save(this.KEYS.FAV_DATA, this.favData);
                return newFolder;
            }

            async deleteFolder(folderId) {
                if (folderId === 'default') return false;
                const idx = this.favData.findIndex(f => f.id === folderId);
                if (idx > -1) {
                    this.favData.splice(idx, 1);
                    await this._save(this.KEYS.FAV_DATA, this.favData);
                    return true;
                }
                return false;
            }

            // --- 收藏操作 ---
            // (同步方法保持不变，因为我们有内存缓存)
            isInFolder(work, folderId) {
                const folder = this.favData.find(f => f.id === folderId);
                if (!folder) return false;
                const targetId = this.getWorkId(work);
                return folder.items.some(i => this.getWorkId(i) === targetId);
            }

            isFavorite(work) {
                const targetId = this.getWorkId(work);
                for (const folder of this.favData) {
                    if (folder.items.some(i => this.getWorkId(i) === targetId)) return true;
                }
                return false;
            }

            async addToFolder(work, folderId) {
                const folder = this.favData.find(f => f.id === folderId);
                if (!folder) return false;

                // 【核心修复】防止重复收藏
                // 如果已经在文件夹中，直接返回 false，表示未执行添加操作
                if (this.isInFolder(work, folderId)) {
                    return false;
                }

                const safeWork = this._sanitizeWork(work);
                folder.items.unshift(safeWork);
                await this._save(this.KEYS.FAV_DATA, this.favData);
                return true;
            }

            async removeFromFolder(work, folderId) {
                const folder = this.favData.find(f => f.id === folderId);
                if (!folder) return false;

                const targetId = this.getWorkId(work);
                const idx = folder.items.findIndex(i => this.getWorkId(i) === targetId);

                if (idx > -1) {
                    folder.items.splice(idx, 1);
                    await this._save(this.KEYS.FAV_DATA, this.favData);
                    return true;
                }
                return false;
            }

            getTotalFavCount() {
                return this.favData.reduce((acc, curr) => acc + curr.items.length, 0);
            }

            // --- 喜欢/点赞 ---
            async toggleLike(work) {
                if (!work) return false;
                const targetId = this.getWorkId(work);
                const idx = this.likes.findIndex(i => this.getWorkId(i) === targetId);
                let result = false;

                if (idx > -1) {
                    this.likes.splice(idx, 1);
                    result = false;
                } else {
                    this.likes.unshift(this._sanitizeWork(work));
                    result = true;
                }
                await this._save(this.KEYS.LIKES, this.likes);
                return result;
            }

            isLiked(work) {
                const targetId = this.getWorkId(work);
                return this.likes.some(i => this.getWorkId(i) === targetId);
            }

            // --- 音乐收藏 ---
            async toggleMusic(musicInfo, sourceWork) {
                if (!musicInfo) return false;
                const targetId = this.getMusicId(musicInfo);
                const idx = this.music.findIndex(i => this.getMusicId(i) === targetId);
                let result = false;

                if (idx > -1) {
                    this.music.splice(idx, 1);
                    result = false;
                } else {
                    let savedSource = null;
                    if (sourceWork) {
                        savedSource = {
                            type: sourceWork.type || '视频',
                            title: sourceWork.title || '',
                            author: sourceWork.author || '',
                            cover: sourceWork.cover || '',
                            url: sourceWork.type === '视频' ? sourceWork.url : ''
                        };
                    }
                    const entry = {
                        title: musicInfo.title || '原声',
                        author: musicInfo.author || '未知',
                        url: musicInfo.url || '',
                        duration: musicInfo.duration || '00:00',
                        source_work: savedSource,
                        saved_at: Date.now()
                    };
                    this.music.unshift(entry);
                    result = true;
                }
                await this._save(this.KEYS.MUSIC, this.music);
                return result;
            }

            isMusicSaved(urlOrInfo) {
                if (!urlOrInfo) return false;
                let id = typeof urlOrInfo === 'string' ? this.getMusicId({ url: urlOrInfo }) : this.getMusicId(urlOrInfo);
                return this.music.some(i => this.getMusicId(i) === id);
            }

            async addDownloadLog(type, name, url) {
                const log = { type, name, url, time: Date.now() };
                this.downloads.unshift(log);
                if (this.downloads.length > 100) this.downloads.length = 100;
                await this._save(this.KEYS.DOWNLOADS, this.downloads);
            }

            // --- 辅助方法 ---
            getWorkId(work) {
                if (!work) return 'unknown';
                if (work.id) return String(work.id);
                if (work.type === '视频') return work.url;
                if (work.images && work.images.length > 0) {
                    const firstImg = work.images[0];
                    return Array.isArray(firstImg) ? firstImg[0] : firstImg;
                }
                return (work.title || 'no_title') + '_' + (work.author || 'no_author');
            }

            getMusicId(musicInfo) {
                if (!musicInfo) return 'unknown';
                if (musicInfo.url && musicInfo.url.length > 5) return musicInfo.url;
                return (musicInfo.title || '').trim() + '_' + (musicInfo.author || '').trim();
            }

            _sanitizeWork(work) {
                return {
                    id: work.id || '', // 确保保存 ID
                    type: work.type || '',
                    url: work.url || '',
                    cover: work.cover || '',
                    images: work.images || [],
                    title: work.title || '',
                    author: work.author || '未知',
                    music_info: work.music_info || {},
                    like: work.like || 0,
                    comment: work.comment || 0,
                    width: work.width || 0, // 保存尺寸
                    height: work.height || 0,
                    saved_at: Date.now()
                };
            }

            // --- 个人资料 ---
            refreshProfileUI() {
                const p = this.userProfile;
                const avatarEl = document.querySelector('.my-avatar-container img');
                const nickEl = document.querySelector('.my-nickname');
                const idEl = document.querySelector('.my-id');
                if (avatarEl) avatarEl.src = p.avatar;
                if (nickEl) nickEl.innerText = p.nickname;
                if (idEl) idEl.innerText = p.uid;
            }

            openEditModal() {
                if (!app.accountManager.user) {
                    app.interaction.showToast('请先登录');
                    return;
                }

                const user = app.accountManager.user;

                // 填充昵称
                document.getElementById('edit-nick').value = user.username || '';

                // 填充头像数据
                const currentAvatar = (user.avatar && user.avatar !== 'null') ? user.avatar : '';

                // 如果没有头像，使用默认图
                const displayAvatar = currentAvatar || getDiceBearAvatar(user.username);

                // 更新预览图和隐藏值
                document.getElementById('edit-avatar-preview').src = displayAvatar;
                document.getElementById('edit-avatar').value = currentAvatar;

                // 填充 ID (只读)
                const uidInput = document.getElementById('edit-uid');
                if (uidInput) {
                    uidInput.value = user.id;
                    uidInput.disabled = true;
                    uidInput.style.opacity = '0.5';
                }

                document.getElementById('profile-edit-mask').classList.add('active');
                const modal = document.getElementById('profile-edit-modal');
                modal.style.display = 'block';
                setTimeout(() => modal.classList.add('active'), 10);
            }

            closeEditModal() {
                const modal = document.getElementById('profile-edit-modal');


                document.getElementById('profile-edit-mask').classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 200);
            }

            // --- UserDataManager 类内部 ---

            async saveProfile() {
                const nickInput = document.getElementById('edit-nick');
                const avatarInput = document.getElementById('edit-avatar');

                // 增加空值检查，防止报错
                const nick = nickInput ? nickInput.value.trim() : '';
                const avt = avatarInput ? avatarInput.value.trim() : '';

                if (!nick) return app.interaction.showToast('昵称不能为空');

                // 获取当前用户对象
                const user = app.accountManager.user;
                if (!user) return app.interaction.showToast('请先登录');

                app.interaction.showToast('正在保存...');

                // === 核心修复逻辑 ===
                // 判断头像是否为 Base64 (本地上传的图片)
                const isLocalImage = avt.startsWith('data:image');


                const serverAvatar = isLocalImage ? (user.avatar && !user.avatar.startsWith('data:') ? user.avatar : '') : avt;

                try {

                    const res = await Api.Auth.updateProfile(null, user.id, nick, serverAvatar);


                    // 更新内存数据
                    user.username = nick;
                    // 【关键】本地保存用户选择的最新头像（哪怕它是 Base64）
                    user.avatar = avt;

                    // 保存到 LocalStorage (持久化)
                    app.accountManager.saveLocal();

                    // 更新 IndexedDB (UserDataManager 缓存)
                    this.userProfile = {
                        nickname: nick,
                        uid: user.id,
                        avatar: avt
                    };
                    await this._save(this.KEYS.PROFILE, this.userProfile);

                    // 4. 立即刷新所有页面的 UI
                    app.accountManager.updateAllUI();

                    app.interaction.showToast('保存成功 (本地已更新)');
                    this.closeEditModal();

                } catch (e) {
                    console.error("Profile save error (ignored):", e);
                    // 即使断网或出错，也保证本地能修改成功
                    user.username = nick;
                    user.avatar = avt;
                    app.accountManager.saveLocal();
                    app.accountManager.updateAllUI();
                    app.interaction.showToast('网络异常，已保存至本地');
                    this.closeEditModal();
                }
            }
            formatTime(ts) {
                return formatMonthDayTime(ts);
            }
        }

