/* v3 semantic split: class from js/app/10-app-controller.js | keep script order */
        class App {
            constructor(startManager = GLOBAL_START_MANAGER) {
                // 先初始化日志管理器 (放在最前面，以便捕获其他模块初始化时的错误)
                this.logger = new LogManager();
                this.dataLoader = new DataLoader();
                this.renderer = new Renderer('video-list');
                this.mediaManager = new MediaManager();
                this.pageManager = new PageManager();
                this.interaction = new InteractionManager();
                this.downloadMgr = new DownloadManager();
                this.coordinator = new ResourceCoordinator();
                this.profileLoader = new ProfileLazyLoader();

                this.chat = new ChatSystem();//注册聊天室

                this.fullPlaylist = [];
                this.renderedCount = 0;
                this.mainSwiper = null;
                this.isLoadingMore = false;
                this.dcRenderedCount = 0;
                this.dcBatchSize = 12;
                this.isLoadingMoreDc = false;
                this.dcLazyObservers = {};
                this.currentProfileWorks = [];

                this.musicRecognizer = new MusicRecognizer();
                this.settingsManager = new SettingsManager();

                this.startManager = startManager;

                this.customManager = new CustomCreatorManager(); // 实例化管理器
                this.isFetching = false; // 新增：控制抓取状态
                this.fetchedWorksBuffer = []; // 新增：数据缓冲区
                this.menuManager = new MenuManager(); // 作品长按菜单管理器
                this.searchManager = new SearchManager();//搜素页
                this.randomVideoLoader = new RandomVideoLoader(this);
                this.randomFeedMode = null;
                this.isRandomFeedActive = false;
                this.randomFeedLoading = false;
                this.randomFeedExhausted = false;
                this.randomFeedApi = null;
                this.randomFeedApis = [];

                this.userDataManager = new UserDataManager();// 用户数据管理器
                this.dataSystem = new DataSystem();// 数据系统

                this.mediaAnalyzer = new MediaAnalyzer(); // 媒体分析器

                this.quotaManager = new QuotaManager(); // 积分

                this.favManager = new FavManager(); // 注册收藏管理器
                this.landscapePlayer = new LandscapePlayer(); // 注册横屏播放器
                this.accountManager = new AccountManager();//注册账号管理

                this.setContextMode(false);
                this.returnPageId = null; // 用于记录返回时要打开的页面 ID
                this.isMusicMode = false; // 新增：标记是否为纯音乐模式
                this.isSwiping = false;
                this.lastSwipeTime = 0;
                this.lastOpenAt = 0;
                this.clickSuppressMs = 350;
                this.currentCreatorName = '';
                this.currentProfileName = '';
                this.feedMode = 'single';
                this.feedSwipeTargets = {
                    recommend: { left: 'single', right: 'double' },
                    double: { left: 'recommend', right: 'single' }
                };
                this.feedScrollPositions = { recommend: 0, double: 0 };
                this.recommendRenderedCount = 0;
                this.recommendBatchSize = 6;
                this.isLoadingMoreRecommend = false;
                this.recommendScrollInitialized = false;
                this.recommendSingleObserver = null;
                this.recommendViewInitialized = false;
                this.doubleViewInitialized = false;
                this.feedReturnPosition = null;
                this.topNav = { navBtn: null, navIcon: null, searchBtn: null, navBar: null };
                this.topNavInitialized = false;
                this.pageLayerObserver = null;
                this.addCreatorEventsBound = false;

                this.backupManager = new BackupManager(); // 注册备份管理器
                this.resourceManager = new ResourceManager(); //资源管理器
                this.autoCleaner = new AutoCleaner(); // 注册清理器
                // 【新增】用于保存首页浏览状态
                this.homeFeedState = null;
                this.adVideos = []; // 存储内置广告视频
                this.adInjectionCounter = 0; // 新增：全局广告计数器，用于跨批次追踪
                // 新增：国内加速镜像站列表
                this.mirrorHosts = [
                    'https://raw.githubusercontent.com/hillmis/versionControl/main', // 原始源
                    'https://cdn.jsdelivr.net/gh/hillmis/versionControl@main',       // jsDelivr 镜像
                    'https://raw.gitmirror.com/hillmis/versionControl/main',         // GitMirror 镜像
                    'https://ghproxy.net/https://raw.githubusercontent.com/hillmis/versionControl/main' // GHProxy 代理
                ];

                // 新增注册
                this.circleManager = new CircleManager();
                this.incentiveManager = new IncentiveManager();

                // 本地媒体扫描状态
                this.localMediaCache = {
                    video: { works: [], lastScan: 0 },
                    music: { works: [], lastScan: 0 }
                };
                this.localMediaScanStatus = { video: false, music: false };
                this.localScanState = { status: 'idle', type: '', scanned: 0, lastPath: '', startAt: 0 };

                this.unifiedAccount = {
                    openProfileEdit: () => {
                        // 判断当前是否有登录用户
                        if (app.accountManager.user) {
                            // 已登录 -> 打开资料编辑弹窗
                            app.userDataManager.openEditModal();
                        } else {
                            // 未登录 -> 打开登录弹窗
                            app.accountManager.openModal();
                        }
                    },
                    saveProfile: () => this.userDataManager.saveProfile(),
                    openLanzouConfig: () => app.interaction.showToast('功能开发中'),
                    resetPasswordTrigger: () => app.interaction.showToast('请联系管理员重置')
                };
                window.app = this;
            }

            // ===== 本地媒体工具 =====
            getLocalMediaConfig(type) {
                return LOCAL_MEDIA_CONFIG[type] || LOCAL_MEDIA_CONFIG.video;
            }

            parseScanPaths(input) {
                const raw = (input || '').trim();
                if (!raw) return [];
                return raw.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean);
            }

            normalizeDirPath(path) {
                const raw = String(path || '').replace(/\\/g, '/');
                const merged = raw.replace(/\/{2,}/g, '/');
                if (!merged) return '/';
                const drive = merged.match(/^([A-Za-z]):\/?$/);
                if (drive) return `${drive[1]}:/`;
                if (merged.length === 1) return merged;
                return merged.replace(/\/+$/, '');
            }

            joinDirPath(base, name) {
                const cleanBase = this.normalizeDirPath(base);
                const cleanName = String(name || '').replace(/^\/+|\/+$/g, '');
                if (!cleanName) return cleanBase;
                if (cleanBase === '/') return `/${cleanName}`;
                return `${cleanBase}/${cleanName}`.replace(/\/{2,}/g, '/');
            }

            getParentDir(path, fallback) {
                const clean = this.normalizeDirPath(path);
                if (/^[A-Za-z]:\/$/.test(clean)) return clean;
                if (clean === '/' || clean === '') return this.normalizeDirPath(fallback || '/');
                const parts = clean.split('/').filter(Boolean);
                parts.pop();
                const parent = `/${parts.join('/')}`;
                return parent === '' ? '/' : parent;
            }

            ensureDirPickerBound() {
                if (this.dirPickerBound) return;
                this.dirPickerBound = true;

                const mask = document.getElementById('dir-picker-mask');
                const modal = document.getElementById('dir-picker-modal');
                const upBtn = document.getElementById('dir-picker-up');
                const selectBtn = document.getElementById('dir-picker-select');
                const cancelBtn = document.getElementById('dir-picker-cancel');

                const close = () => this.closeDirPicker();
                if (mask) mask.addEventListener('click', close);
                if (cancelBtn) cancelBtn.addEventListener('click', close);
                if (upBtn) {
                    upBtn.addEventListener('click', () => {
                        if (!this.dirPickerState) return;
                        const base = this.dirPickerState.base || '/';
                        this.dirPickerState.current = this.getParentDir(this.dirPickerState.current, base);
                        this.refreshDirPicker();
                    });
                }
                if (selectBtn) {
                    selectBtn.addEventListener('click', () => {
                        if (!this.dirPickerState) return;
                        const current = this.normalizeDirPath(this.dirPickerState.current);
                        if (this.dirPickerState.onSelect) this.dirPickerState.onSelect(current);
                        this.closeDirPicker();
                    });
                }
            }

            openDirPicker(native, onSelect, startPath = '') {
                if (!native || !native.file || typeof native.file.list !== 'function') return false;
                this.ensureDirPickerBound();
                try {
                    const has =
                        (native.permission && native.permission.hasStorage && native.permission.hasStorage()) ??
                        (native.system && native.system.hasStorage && native.system.hasStorage());
                    if (has === false) {
                        if (native.permission && native.permission.requestStorage) native.permission.requestStorage();
                        if (native.system && native.system.requestStorage) native.system.requestStorage();
                    }
                } catch { }

                const base = this.normalizeDirPath(
                    (native.file.externalStorage && native.file.externalStorage()) ||
                    (CONFIG.LOCAL_SCAN_LAST_DIR || '') ||
                    '/storage/emulated/0'
                );
                const current = this.normalizeDirPath(startPath || CONFIG.LOCAL_SCAN_LAST_DIR || base);

                this.dirPickerState = {
                    native,
                    base,
                    current,
                    onSelect
                };

                const mask = document.getElementById('dir-picker-mask');
                const modal = document.getElementById('dir-picker-modal');
                if (mask) mask.classList.add('active');
                if (modal) modal.classList.add('active');
                this.refreshDirPicker();
                return true;
            }

            closeDirPicker() {
                const mask = document.getElementById('dir-picker-mask');
                const modal = document.getElementById('dir-picker-modal');
                if (mask) mask.classList.remove('active');
                if (modal) modal.classList.remove('active');
                this.dirPickerState = null;
            }

            refreshDirPicker() {
                if (!this.dirPickerState) return;
                const { native, current } = this.dirPickerState;
                const pathEl = document.getElementById('dir-picker-current');
                const listEl = document.getElementById('dir-picker-list');
                if (pathEl) pathEl.innerText = current;
                if (!listEl) return;

                let listStr = '';
                try {
                    listStr = native.file.list(current);
                } catch {
                    listStr = '';
                }
                const parseList = window.MediaScanner?.parseNativeList || ((v) => String(v || '').split(/\\|\n/).map(s => s.trim()).filter(Boolean));
                const items = parseList(listStr).filter(n => n.endsWith('/'));
                listEl.innerHTML = '';
                if (!items.length) {
                    const empty = document.createElement('div');
                    empty.className = 'dir-picker-empty';
                    empty.innerText = '当前目录没有子文件夹';
                    listEl.appendChild(empty);
                    return;
                }
                items.forEach((raw) => {
                    const name = raw.replace(/\/$/, '');
                    const item = document.createElement('div');
                    item.className = 'dir-picker-item';
                    item.innerHTML = `<i class="fa-regular fa-folder-open"></i><span>${name}</span>`;
                    item.addEventListener('click', () => {
                        if (!this.dirPickerState) return;
                        this.dirPickerState.current = this.joinDirPath(this.dirPickerState.current, name);
                        this.refreshDirPicker();
                    });
                    listEl.appendChild(item);
                });
            }

            pickLocalScanFolder() {
                const display = document.getElementById('cfg-local-scan-paths-display');
                const applyPath = (path) => {
                    const clean = (path || '').trim();
                    if (!clean) return;
                    const existing = (CONFIG.LOCAL_SCAN_PATHS || '').trim();
                    const merged = existing ? `${existing}\n${clean}` : clean;
                    if (app.settingsManager) app.settingsManager.update('LOCAL_SCAN_PATHS', merged);
                    if (app.settingsManager) app.settingsManager.update('LOCAL_SCAN_LAST_DIR', clean);
                    if (display) {
                        display.innerText = merged;
                        display.style.color = '#ddd';
                    }
                };

                const native = window.MediaScanner && typeof window.MediaScanner.getNative === 'function'
                    ? window.MediaScanner.getNative()
                    : null;

                if (!native) {
                    const manual = prompt('请输入要扫描的文件夹路径');
                    if (manual) applyPath(manual);
                    return;
                }

                const cbName = '__dxxLocalFolderPicker';
                window[cbName] = (result) => {
                    applyPath(result);
                };

                const tryCall = (fn) => {
                    try {
                        if (typeof fn !== 'function') return false;
                        const ret = fn.length >= 1 ? fn(cbName) : fn();
                        if (ret) applyPath(ret);
                        return true;
                    } catch (e) {
                        return false;
                    }
                };

                let invoked = false;
                if (native.file && typeof native.file.pickDir === 'function') {
                    invoked = tryCall(native.file.pickDir);
                }
                if (!invoked && native.file && typeof native.file.list === 'function') {
                    const opened = this.openDirPicker(native, applyPath, CONFIG.LOCAL_SCAN_LAST_DIR);
                    if (opened) return;
                }
                if (!invoked) {
                    const manual = prompt('当前环境不支持文件夹选择，请手动输入路径');
                    if (manual) applyPath(manual);
                }
            }

            getLocalMediaAvatar(type) {
                return type === 'music'
                    ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=LocalMusic'
                    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=LocalVideo';
            }

            isLocalWork(work) {
                if (!work) return false;
                const idText = String(work.id || '');
                return idText.includes('local-') || work.is_local === true || work.origin_type === 'local';
            }

            applyLocalMusicSlideStyle(styleKey) {
                const key = String(styleKey || '1');
                const className = `local-music-style-${key}`;
                document.querySelectorAll('.local-music-container').forEach(el => {
                    el.classList.remove('local-music-style-1', 'local-music-style-2', 'local-music-style-3');
                    el.classList.add(className);
                });
            }

            async applyLocalMixSetting(enabled) {
                const allCreators = await this.customManager.getAll();
                let changed = false;
                ['video', 'music'].forEach((type) => {
                    const cfg = this.getLocalMediaConfig(type);
                    const data = allCreators[cfg.name];
                    if (!data) return;
                    data.info = data.info || {};
                    if (data.info.mix_enabled !== !!enabled) {
                        data.info.mix_enabled = !!enabled;
                        changed = true;
                    }
                    allCreators[cfg.name] = data;
                    if (this.dataLoader && this.dataLoader.globalCreators) {
                        this.dataLoader.globalCreators[cfg.name] = data;
                    }
                });
                if (changed) {
                    await this.customManager.saveAll(allCreators);
                    if (this.dataSystem && this.dataSystem.currentTab === 'creators') this.dataSystem.renderList();
                    if (this.renderer) this.renderer.renderSidebar(this.dataLoader.globalCreators || allCreators);
                    if (this.resourceManager && typeof this.resourceManager.refreshLocalMixToggle === 'function') {
                        this.resourceManager.refreshLocalMixToggle();
                    }
                }
            }

            getLocalMediaCover(type) {
                return type === 'music'
                    ? 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"%23ff7ad8\"><circle cx=\"32\" cy=\"32\" r=\"28\" fill=\"%23111\"/><circle cx=\"32\" cy=\"32\" r=\"6\" fill=\"%23ff7ad8\"/></svg>'
                    : 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"%234cc3ff\"><rect x=\"8\" y=\"12\" width=\"48\" height=\"36\" rx=\"6\" fill=\"%23111\"/><path d=\"M16 40l10-12 10 12 8-10 12 16H16z\" fill=\"%234cc3ff\"/></svg>';
            }

            normalizeLocalFileUrl(path) {
                if (!path) return '';
                const fixed = path.replace(/\\/g, '/');
                const raw = fixed.startsWith('file://') ? fixed : `file://${fixed}`;
                return encodeURI(raw);
            }

            getLocalScanTargets(type) {
                const native = window.MediaScanner && window.MediaScanner.getNative ? window.MediaScanner.getNative() : null;
                const external = native && native.file && typeof native.file.externalStorage === 'function'
                    ? native.file.externalStorage()
                    : '';
                const base = external || '/sdcard';
                const userTargets = this.parseScanPaths(CONFIG.LOCAL_SCAN_PATHS);
                const hasFullDisk = userTargets.some(t => t === '*' || t.includes('全盘'));
                if (userTargets.length > 0 && !hasFullDisk) {
                    return Array.from(new Set(userTargets.filter(Boolean)));
                }
                const targets = [base];
                if (type === 'video') targets.push(`${base}/DCIM`, `${base}/Movies`, `${base}/Download`);
                if (type === 'music') targets.push(`${base}/Music`, `${base}/Download`);
                return Array.from(new Set(targets.filter(Boolean)));
            }

            buildLocalMediaWorks(results, type, authorName) {
                const works = [];
                const seen = new Set();
                const cover = this.getLocalMediaCover(type);
                results.forEach((item) => {
                    if (!item || !item.path) return;
                    if (type === 'music' && item.type !== 'audio') return;
                    if (type === 'video' && item.type !== 'video') return;
                    if (seen.has(item.path)) return;
                    seen.add(item.path);
                    const rawName = item.name || item.path.split('/').pop() || item.path.split('\\').pop() || '本地文件';
                    const title = rawName.replace(/\.[^/.]+$/, '');
                    const fileUrl = this.normalizeLocalFileUrl(item.path);
                    if (type === 'music') {
                        works.push({
                            id: `local-music:${item.path}`,
                            type: '音乐',
                            title,
                            author: authorName,
                            url: fileUrl,
                            images: [cover],
                            cover,
                            like: 0,
                            comment: 0,
                            music_info: {
                                title,
                                author: authorName,
                                url: fileUrl
                            }
                        });
                    } else {
                        works.push({
                            id: `local-video:${item.path}`,
                            type: '视频',
                            title,
                            author: authorName,
                            url: fileUrl,
                            cover,
                            like: 0,
                            comment: 0
                        });
                    }
                });
                return works;
            }
            getLocalCreatorData(type) {
                const cfg = this.getLocalMediaConfig(type);
                if (!this.dataLoader || !this.dataLoader.globalCreators) return null;
                return this.dataLoader.globalCreators[cfg.name] || null;
            }

            buildLocalCreatorData(type, works = [], lastScan = 0) {
                const cfg = this.getLocalMediaConfig(type);
                const existing = this.getLocalCreatorData(type);
                const avatar = (existing && existing.info && existing.info.avatar) ? existing.info.avatar : this.getLocalMediaAvatar(type);
                const resolvedLast = typeof lastScan === 'number' ? lastScan : (existing && existing.info ? existing.info.last_updated : 0) || 0;
                const mixEnabled = (existing && existing.info && existing.info.mix_enabled !== undefined)
                    ? existing.info.mix_enabled
                    : !!CONFIG.LOCAL_MIX_ENABLED;
                return {
                    info: { name: cfg.name, avatar, origin_type: 'local', local_type: type, last_updated: resolvedLast, mix_enabled: mixEnabled },
                    works: Array.isArray(works) ? works : []
                };
            }

            async ensureLocalCreatorData(type, options = {}) {
                const cfg = this.getLocalMediaConfig(type);
                const all = await this.customManager.getAll();
                let data = all[cfg.name];
                const persistMissing = options.persistMissing !== false;
                let changed = false;
                if (!data) {
                    data = this.buildLocalCreatorData(type, [], 0);
                    data.isCustom = true;
                    if (persistMissing) { all[cfg.name] = data; changed = true; }
                } else {
                    data.info = data.info || {};
                    if (data.info.name !== cfg.name) { data.info.name = cfg.name; changed = true; }
                    if (!data.info.avatar) { data.info.avatar = this.getLocalMediaAvatar(type); changed = true; }
                    if (data.info.origin_type !== 'local') { data.info.origin_type = 'local'; changed = true; }
                    if (data.info.local_type !== type) { data.info.local_type = type; changed = true; }
                    if (data.info.mix_enabled === undefined) { data.info.mix_enabled = !!CONFIG.LOCAL_MIX_ENABLED; changed = true; }
                    if (!Array.isArray(data.works)) data.works = [];
                    data.isCustom = true;
                    all[cfg.name] = data;
                }
                if (changed) await this.customManager.saveAll(all);
                if (this.dataLoader && this.dataLoader.globalCreators) {
                    this.dataLoader.globalCreators[cfg.name] = data;
                }
                this.localMediaCache[type] = {
                    works: Array.isArray(data.works) ? data.works : [],
                    lastScan: data.info.last_updated || 0
                };
                return data;
            }

            async persistLocalCreatorData(type, works, lastScan) {
                const data = this.buildLocalCreatorData(type, works, lastScan);
                data.isCustom = true;
                const result = await this.customManager.save(data);
                if (!result || !result.success) this.interaction.showToast('本地缓存保存失败');
                if (this.dataLoader && this.dataLoader.globalCreators) {
                    this.dataLoader.globalCreators[data.info.name] = data;
                }
                this.localMediaCache[type] = { works: data.works, lastScan: data.info.last_updated || 0 };
                if (this.renderer) this.renderer.renderSidebar(this.dataLoader.globalCreators);
                return data;
            }

            async resetLocalMediaData(type) {
                return this.persistLocalCreatorData(type, [], 0);
            }

            syncLocalMediaCacheFromCreators(creators) {
                ['video', 'music'].forEach((type) => {
                    const cfg = this.getLocalMediaConfig(type);
                    const creator = creators && creators[cfg.name];
                    if (creator && Array.isArray(creator.works)) {
                        this.localMediaCache[type] = {
                            works: creator.works,
                            lastScan: (creator.info && creator.info.last_updated) ? creator.info.last_updated : 0
                        };
                    }
                });
            }

            async scanLocalMedia(type, options = {}) {
                const cfg = this.getLocalMediaConfig(type);
                const native = window.MediaScanner && typeof window.MediaScanner.getNative === 'function'
                    ? window.MediaScanner.getNative()
                    : null;
                const supportNative = window.MediaScanner && typeof window.MediaScanner.scanMedia === 'function' && native;
                const useMock = options.forceMock === true || !supportNative;
                if (useMock) {
                    this.interaction.showToast('当前环境使用模拟扫描数据');
                }
                const force = options.force === true;
                const cachedCreator = this.getLocalCreatorData(type);
                const cachedWorks = cachedCreator && Array.isArray(cachedCreator.works) ? cachedCreator.works : (this.localMediaCache[type].works || []);
                if (!force && cachedWorks && cachedWorks.length > 0) {
                    return cachedWorks;
                }
                if (this.localMediaScanStatus[type]) {
                    this.interaction.showToast(`正在扫描${cfg.name}...`);
                    return cachedWorks || [];
                }
                this.localMediaScanStatus[type] = true;
                try {
                    this.interaction.showToast(`正在扫描${cfg.name}...`);
                    let results = [];
                    if (useMock) {
                        results = this._mockLocalScan(type);
                        // 模拟进度
                        if (options.onProgress) options.onProgress({ scanned: results.length, path: 'mock://demo' });
                    } else {
                        const defaults = window.MediaScanner.defaults || {};
                        const minAudioSizeMb = Number(CONFIG.LOCAL_MIN_MUSIC_MB);
                        const minVideoSizeMb = Number(CONFIG.LOCAL_MIN_VIDEO_MB);
                        const minAudioSize = Number.isFinite(minAudioSizeMb) ? Math.max(0, minAudioSizeMb) * 1024 * 1024 : null;
                        const minVideoSize = Number.isFinite(minVideoSizeMb) ? Math.max(0, minVideoSizeMb) * 1024 * 1024 : null;
                        const scanOptions = {
                            recursive: true,
                            ignoreDirs: defaults.IGNORE_DIRS || [],
                            minAudioSize: minAudioSize !== null ? minAudioSize : (defaults.MIN_AUDIO_SIZE || 0),
                            minVideoSize: minVideoSize !== null ? minVideoSize : (defaults.MIN_VIDEO_SIZE || 0),
                            audioFormats: type === 'music' ? (defaults.AUDIO_FORMATS || []) : [],
                            videoFormats: type === 'video' ? (defaults.VIDEO_FORMATS || []) : [],
                            imageFormats: [],
                            documentFormats: [],
                            textFormats: [],
                            onItem: options.onItem,
                            onProgress: options.onProgress,
                            shouldPause: options.shouldPause,
                            shouldCancel: options.shouldCancel
                        };
                        const targets = this.getLocalScanTargets(type);
                        results = await window.MediaScanner.scanMedia(targets, scanOptions);
                    }
                    if (options.shouldCancel && options.shouldCancel()) return cachedWorks || [];
                    const works = this.buildLocalMediaWorks(results || [], type, cfg.name);
                    const lastScan = Date.now();
                    await this.persistLocalCreatorData(type, works, lastScan);
                    return works;
                } catch (e) {
                    console.warn('Local media scan failed', e);
                    return [];
                } finally {
                    this.localMediaScanStatus[type] = false;
                }
            }

            async runLocalScan(type, options = {}) {
                const cfg = this.getLocalMediaConfig(type);
                const force = options.force === true;
                const cachedCreator = this.getLocalCreatorData(type);
                const cachedWorks = cachedCreator && Array.isArray(cachedCreator.works)
                    ? cachedCreator.works
                    : (this.localMediaCache[type].works || []);
                if (!force && cachedWorks && cachedWorks.length > 0) {
                    this.interaction.showToast(`已读取缓存 ${cfg.name} · ${cachedWorks.length} 项`);
                    return cachedWorks;
                }
                if (this.localScanState && (this.localScanState.status === 'running' || this.localScanState.status === 'paused')) {
                    this.interaction.showToast(`正在扫描${cfg.name}...`);
                    return cachedWorks || [];
                }
                this.localScanState = {
                    status: 'running',
                    type,
                    scanned: 0,
                    lastPath: '',
                    startAt: Date.now()
                };
                this.updateLocalScanUI(`正在扫描${cfg.name}...`);
                const works = await this.scanLocalMedia(type, {
                    force: true,
                    forceMock: options.forceMock === true,
                    onProgress: (info) => {
                        if (!info) return;
                        this.localScanState.scanned = info.scanned || 0;
                        this.localScanState.lastPath = info.path || '';
                        const msg = `扫描中 ${cfg.name} · ${this.localScanState.scanned} 项`;
                        this.updateLocalScanUI(msg);
                        if (this.resourceManager) this.resourceManager.setLocalScanStatusText(msg);
                    },
                    shouldPause: () => this.localScanState && this.localScanState.status === 'paused',
                    shouldCancel: () => this.localScanState && this.localScanState.status === 'stopped'
                });
                if (this.localScanState && this.localScanState.status === 'stopped') {
                    this.updateLocalScanUI(`已停止扫描 ${cfg.name}`);
                    return works || [];
                }
                this.localScanState.status = 'idle';
                this.updateLocalScanUI(`扫描完成：${cfg.name} (${works.length} 项)`);
                return works;
            }

            pauseLocalScan() {
                if (!this.localScanState || this.localScanState.status !== 'running') return;
                this.localScanState.status = 'paused';
                this.updateLocalScanUI('已暂停扫描', true);
                this.interaction.showToast('扫描已暂停');
            }

            resumeLocalScan() {
                if (!this.localScanState || this.localScanState.status !== 'paused') return;
                this.localScanState.status = 'running';
                this.updateLocalScanUI('继续扫描中');
                this.interaction.showToast('继续扫描');
            }

            stopLocalScan() {
                if (!this.localScanState || (this.localScanState.status !== 'running' && this.localScanState.status !== 'paused')) return;
                if (confirm('确定要终止扫描吗？')) {
                    this.localScanState.status = 'stopped';
                    this.updateLocalScanUI('正在停止扫描...');
                }
            }

            updateLocalScanUI(msg, isPaused = false) {
                const active = this.localScanState && (this.localScanState.status === 'running' || this.localScanState.status === 'paused');
                if (this.resourceManager) {
                    this.resourceManager.renderLocalScanControls(msg, isPaused, active);
                }
                if (this.dataSystem && typeof this.dataSystem.renderScanControlBar === 'function') {
                    this.dataSystem.renderScanControlBar(msg, isPaused, active);
                }
            }

            getLocalScanStatusText() {
                if (!this.localScanState) return '';
                const type = this.localScanState.type || '';
                const cfg = this.getLocalMediaConfig(type) || {};
                const name = cfg.name || '本地资源';
                const scanned = this.localScanState.scanned || 0;
                if (this.localScanState.status === 'paused') return `已暂停 ${name} · ${scanned} 项`;
                if (this.localScanState.status === 'running') return `扫描中 ${name} · ${scanned} 项`;
                if (this.localScanState.status === 'stopped') return `已停止扫描 ${name}`;
                return `扫描完成 ${name} · ${scanned} 项`;
            }

            async openLocalMedia(type) {
                const cfg = this.getLocalMediaConfig(type);
                await this.ensureLocalCreatorData(type, { persistMissing: true });
                const creator = this.getLocalCreatorData(type);
                const works = creator && Array.isArray(creator.works) ? creator.works : [];
                if (works.length) {
                    this.loadCreator(cfg.name, 'recommend');
                    //this.interaction.showToast(`${cfg.name}已加载 ${works.length} 项`);
                } else {
                    if (this.resourceManager) this.resourceManager.openLocal(type);
                    this.interaction.showToast(`请在管理页扫描 ${cfg.name}`);
                }
            }

            async scanLocalFromStorage(type, options = {}) {
                if (!type) return [];
                const works = await this.runLocalScan(type, { force: options.force === true, forceMock: options.forceMock === true });
                if (this.dataSystem && this.dataSystem.currentTab === 'creators') {
                    this.dataSystem.renderList();
                }
                return works;
            }

            async quickLocalScan() {
                if (this.localScanState && (this.localScanState.status === 'running' || this.localScanState.status === 'paused')) {
                    this.interaction.showToast('已有扫描任务进行中');
                    return;
                }
                this.interaction.showToast('开始扫描本地视频与音乐...');
                try {
                    await this.runLocalScan('video', { force: true });
                    await this.runLocalScan('music', { force: true });
                    this.interaction.showToast('本地资源扫描完成');
                } catch (e) {
                    console.warn('Quick local scan failed', e);
                    this.interaction.showToast('本地扫描失败，请稍后重试');
                }
            }

            _mockLocalScan(type) {
                const now = Date.now();
                if (type === 'music') {
                    return [
                        { path: '/mock/music/LoFi_Study.mp3', name: 'LoFi_Study.mp3', type: 'audio', mtime: now },
                        { path: '/mock/music/Acoustic_Sunrise.flac', name: 'Acoustic_Sunrise.flac', type: 'audio', mtime: now - 3600 * 1000 },
                        { path: '/mock/music/Nightwalk.wav', name: 'Nightwalk.wav', type: 'audio', mtime: now - 7200 * 1000 }
                    ];
                }
                return [
                    { path: '/mock/video/City_Rain.mp4', name: 'City_Rain.mp4', type: 'video', mtime: now },
                    { path: '/mock/video/Mountain_Trail.mov', name: 'Mountain_Trail.mov', type: 'video', mtime: now - 3600 * 1000 },
                    { path: '/mock/video/Coding_Time.webm', name: 'Coding_Time.webm', type: 'video', mtime: now - 7200 * 1000 }
                ];
            }

            setupTopNav() {
                if (this.topNavInitialized) return;
                this.topNavInitialized = true;
                const navBar = document.getElementById('global-top-bar');
                const navBtn = document.getElementById('global-nav-btn');
                const navIcon = document.getElementById('global-nav-icon');
                const searchBtn = document.getElementById('global-search-btn');
                this.topNav = { navBar, navBtn, navIcon, searchBtn };

                if (navBtn) {
                    navBtn.addEventListener('click', (event) => {

                        event.stopPropagation();
                        if (this.isContextMode) {
                            history.back();
                        } else {
                            this.pageManager.openSidebarSafe();
                        }
                    }, { passive: true });
                }

                if (searchBtn) {
                    searchBtn.addEventListener('click', (event) => {

                        event.stopPropagation();
                        if (!this.isContextMode) {
                            this.pageManager.openSearch();
                        }
                    }, { passive: true });
                }

                this.updateTopNav();
                this.observePageLayers();
                this.updateTopBarVisibility();
            }

            updateTopNav() {
                const { navIcon, searchBtn } = this.topNav || {};
                if (navIcon) {
                    navIcon.classList.toggle('fa-bars', !this.isContextMode);
                    navIcon.classList.toggle('fa-chevron-left', this.isContextMode);
                    navIcon.setAttribute('aria-label', this.isContextMode ? '返回' : '菜单');
                }
                if (searchBtn) {
                    searchBtn.classList.toggle('top-nav-hidden', this.isContextMode);
                }
                if (this.topNav && this.topNav.navBar) {
                    this.topNav.navBar.classList.toggle('context-mode', this.isContextMode);
                }
            }

            setContextMode(value) {
                this.isContextMode = value;
                document.body.classList.toggle('context-mode', value);
                this.updateTopNav();
                this.updateTopBarVisibility();
            }

            observePageLayers() {
                if (this.pageLayerObserver) return;
                this.pageLayerObserver = new MutationObserver(() => this.updateTopBarVisibility());
                document.querySelectorAll('.page-layer').forEach((layer) => {
                    this.pageLayerObserver.observe(layer, { attributes: true, attributeFilter: ['class'] });
                });
            }

            hasActivePageLayer() {
                return !!document.querySelector('.page-layer.active');
            }

            updateTopBarVisibility() {
                if (!this.topNav || !this.topNav.navBar) return;
                const shouldHide = this.hasActivePageLayer();
                this.topNav.navBar.classList.toggle('top-bar-hidden', shouldHide);
            }

            safeOpenPage(e, fn) {
                if (typeof e === 'function') {
                    fn = e;
                    e = null;
                }
                if (e && e.cancelable) e.preventDefault();
                if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                this.lastOpenAt = Date.now();
                if (typeof fn === 'function') fn();
            }

            /**
 * 从多个镜像源尝试获取数据
 * @param {string} fileName 文件名 (如 'ad.json')
 */
            async fetchFromMirrors(fileName) {
                let lastError = null;
                for (const host of this.mirrorHosts) {
                    try {
                        // 添加时间戳防止强缓存
                        const url = `${host}/${fileName}?t=${Date.now()}`;
                        const res = await fetch(url, { cache: 'no-cache' });
                        if (res.ok) {
                            return await res.json();
                        }
                    } catch (e) {
                        console.warn(`[Mirror] 镜像源访问失败: ${host}`);
                        lastError = e;
                    }
                }
                throw lastError || new Error('所有镜像源均不可用');
            }
            async loadAdVideos() {
                try {
                    // 修改点：使用镜像获取方法替换硬编码的 GitHub 链接
                    this.adVideos = await this.fetchFromMirrors('advideos.json');
                    console.log(`[AdSystem] 成功从加速镜像加载了 ${this.adVideos.length} 条广告资源`);
                } catch (e) {
                    console.warn('[AdSystem] 加载广告视频资源失败 (所有镜像已尝试):', e);
                }
            }
            async init() {
                this.setupTopNav();
                this.initDoubleColumnScroll();
                this.initRecommendScroll();
                this.logger.info('App 启动中...');

                try {
                    // 第一步：立即初始化存储服务
                    await StorageService.init();

                    // 第二步：并行加载设置和本地数据（不等待网络请求）
                    // 核心目标：先让本地存过的内容或者默认 Mock 数据跑起来
                    await Promise.all([
                        this.settingsManager.init(),
                        this.userDataManager.init()
                    ]);

                    // 第三步：尝试从本地获取资源并立即渲染首屏
                    const creators = await this.dataLoader.init();
                    this.renderer.renderSidebar(creators);
                    if (!this.addCreatorEventsBound) {
                        this.bindAddCreatorEvents();
                        this.addCreatorEventsBound = true;
                    }

                    // 关键点：立即加载视频流，不等待广告和备份
                    const isDeepLinkHandled = await this.handleGlobalDeepLink();
                    if (!isDeepLinkHandled) {
                        // 立即渲染，不 await，防止被后续网络请求卡住
                        this.loadRandom();
                    }

                    // 第四步：后台执行非紧急任务（不需要 await）
                    this.backgroundTasks();

                    // 第五步：通知启动管理器
                    this.startManager.start();

                } catch (e) {
                    console.error("启动异常:", e);
                    this.logger.error(`Init failed: ${e.message}`);
                    this.startManager.start(); // 即使报错也尝试进入，防止死等
                }
            }

            // 新增：后台任务处理
            backgroundTasks() {
                // 异步加载广告，加载完后会自动更新侧边栏 UI，不阻塞主流程
                this.loadAdVideos().then(() => {
                    if (this.renderer) this.renderer.initSidebarAds();
                });

                // 初始化备份管理
                this.backupManager.init();

                // 圈子和激励任务
                this.circleManager.init();

                // 延时清理缓存
                setTimeout(() => { this.autoCleaner.run(); }, 5000);
            }
            initDoubleColumnScroll() {
                const view = document.getElementById('double-column-view');
                if (!view) return;

                view.addEventListener('scroll', () => {
                    if (this.feedMode !== 'double') return;
                    this.feedScrollPositions.double = view.scrollTop;

                    if (view.scrollTop + view.clientHeight >= view.scrollHeight - 200) {
                        this.renderDoubleColumn(false);
                    }
                }, { passive: true });
            }

            initRecommendScroll() {
                const view = document.getElementById('recommend-view');
                if (!view || this.recommendScrollInitialized) return;
                view.addEventListener('scroll', () => {
                    if (this.feedMode !== 'recommend') return;
                    this.feedScrollPositions.recommend = view.scrollTop;
                    if (view.scrollTop + view.clientHeight >= view.scrollHeight - 200) {
                        this.appendRecommendBatch();
                    }
                }, { passive: true });
                this.recommendScrollInitialized = true;
            }

            setupFeedSwipeHandlers() {
                const viewToFeed = {
                    'recommend-view': 'recommend',
                    'double-column-view': 'double'
                };

                Object.entries(viewToFeed).forEach(([layerId, feedKey]) => {
                    const layer = document.getElementById(layerId);
                    if (!layer) return;
                    const targets = (this.feedSwipeTargets && this.feedSwipeTargets[feedKey]) || {};
                    let startX = 0;
                    let startY = 0;
                    let tracking = false;

                    layer.addEventListener('touchstart', (e) => {
                        if (e.touches.length !== 1) return;
                        startX = e.touches[0].clientX;
                        startY = e.touches[0].clientY;
                        tracking = true;
                    }, { passive: true });

                    layer.addEventListener('touchend', (e) => {
                        if (!tracking) return;
                        tracking = false;
                        if (!e.changedTouches || e.changedTouches.length === 0) return;
                        const deltaX = e.changedTouches[0].clientX - startX;
                        const deltaY = e.changedTouches[0].clientY - startY;

                        if (Math.abs(deltaX) <= 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
                        if (document.querySelector('.modal-sheet.active, .comment-layer.active, .page-layer.active')) return;

                        const direction = deltaX > 0 ? 'right' : 'left';
                        const targetFeed = targets[direction];
                        if (targetFeed && targetFeed !== this.feedMode && typeof this.switchFeedMode === 'function') {
                            this.switchFeedMode(targetFeed);
                        }
                    }, { passive: true });
                });
            }

            applyFeedReturnPosition() {
                const pos = this.feedReturnPosition;
                if (!pos) return;
                if (pos.mode === 'recommend') {
                    const view = document.getElementById('recommend-view');
                    if (view) {
                        setTimeout(() => {
                            view.scrollTop = pos.scrollTop;
                            this.feedScrollPositions.recommend = pos.scrollTop;
                        }, 20);
                    }
                } else if (pos.mode === 'double') {
                    const container = document.getElementById('double-column-view');
                    if (container) {
                        setTimeout(() => {
                            container.scrollTop = pos.scrollTop;
                            this.feedScrollPositions.double = pos.scrollTop;
                        }, 20);
                    }
                }
                this.feedReturnPosition = null;
            }
            // 2. 页面遮挡行为监控器 (静音/暂停)
            initPageMuteObserver() {
                // 用于记录是否是由遮挡导致的暂停，以便恢复
                this.pausedByLayer = false;

                const observer = new MutationObserver(() => {
                    // --- 【核心修改】仅检测真正的全屏子页面 ---
                    // 排除项说明：
                    // 1. #music-manage-page: 音乐详情页（设计上需要继续播放音乐）
                    // 2. .left-side: 侧边栏（需求要求不暂停）
                    // 3. 移除了 .comment-layer.active (评论区、长按菜单)
                    // 4. 移除了 .modal-sheet.active (下载/分享/收藏面板)
                    const activePage = document.querySelector('.page-layer.active:not(#music-manage-page):not(.left-side)');

                    const media = this.mediaManager.currentMedia;
                    if (!media) return;

                    if (activePage) {
                        // === 状态：有全屏页面遮挡 (如设置、个人主页、搜索) ===

                        // 1. 处理暂停
                        if (CONFIG.PAUSE_ON_PAGE_OPEN) {
                            if (!media.paused) {
                                media.pause();
                                this.pausedByLayer = true; // 标记：是我暂停的
                                this.mediaManager.updatePlayBtnState(false);
                            }
                        }

                        // 2. 处理静音
                        if (CONFIG.MUTE_ON_PAGE_OPEN) {
                            media.muted = true;
                        }

                    } else {
                        // === 状态：无全屏遮挡 (即回到了首页，或者只打开了评论/菜单等半屏层) ===

                        // 1. 恢复静音状态 (恢复到全局设置)
                        if (CONFIG.MUTE_ON_PAGE_OPEN) {
                            media.muted = this.mediaManager.isGlobalMuted;
                        }

                        // 2. 恢复播放
                        if (CONFIG.PAUSE_ON_PAGE_OPEN && this.pausedByLayer) {
                            // 只有当之前是因为遮挡才暂停的，现在才恢复播放
                            media.play().catch(e => console.log('Resume failed', e));
                            this.pausedByLayer = false; // 重置标记
                            this.mediaManager.updatePlayBtnState(true);
                        }
                    }
                });

                // 监听目标：虽然逻辑上忽略了 comment/sheet，但为了代码健壮性，
                // 我们依然监听这些元素的变化，以防未来有全屏的 comment layer 需要处理
                // (或者你可以只监听 .page-layer 以提升极微小的性能，但保持现状更稳妥)
                const targets = [
                    ...document.querySelectorAll('.page-layer'),
                    ...document.querySelectorAll('.comment-layer'),
                    ...document.querySelectorAll('.modal-sheet')
                ];

                targets.forEach(el => {
                    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
                });
            }
            // 1. 【新增】统一的深度链接处理逻辑 (核心引擎)
            // params: URLSearchParams 对象
            async _executeDeepLink(params) {
                const type = params.get('share_type');

                // === 场景 A: Payload 数据包 (本地分享) ===
                if (type === 'payload') {
                    const dataStr = params.get('data');
                    if (!dataStr) return false;

                    try {
                        app.interaction.showToast('正在解析分享数据...');
                        const jsonStr = decodeURIComponent(escape(atob(dataStr)));
                        const miniData = JSON.parse(jsonStr);

                        const restoredWork = {
                            id: 'share_' + Date.now(),
                            title: miniData.t || '分享作品',
                            author: miniData.a || '未知用户',
                            url: miniData.u || '',
                            cover: miniData.c || '',
                            type: miniData.tp || '视频',
                            images: miniData.i || [],
                            like: 0,
                            comment: 0,
                            is_shared: true,
                            music_info: { title: '原声', author: '未知', url: '' }
                        };

                        // 如果当前已经在播放器视图，直接插入播放
                        // 如果在其他页面，先关闭所有层
                        this.pageManager.closeAll();

                        setTimeout(() => {
                            this.enterContextPlay([restoredWork], 0);
                            app.interaction.showToast('已加载分享的作品');
                        }, 300);

                        return true;
                    } catch (e) {
                        console.error('Payload parse failed', e);
                        app.interaction.showToast('链接数据已损坏');
                        return false;
                    }
                }

                // === 场景 B: 标准 ID/Index 定位 (网络资源) ===
                const authorName = decodeURIComponent(params.get('author') || '');
                const targetWorkId = params.get('work_id');
                const workIndex = parseInt(params.get('work_index'));

                if (!type || !authorName) return false;

                const creatorData = this.dataLoader.globalCreators[authorName];

                if (!creatorData) {
                    app.interaction.showToast(`本地未找到资源: ${authorName}`);
                    // 可选：这里可以触发自动联网搜索逻辑
                    return false;
                }

                // 关闭所有弹窗（如下载页、聊天室等），回到主视图
                this.pageManager.closeAll();

                // 跳转到资源主页
                if (type === 'profile') {
                    this.openProfile(authorName);
                    return true;
                }

                // 跳转到具体作品
                if (type === 'work') {
                    // 先打开 Profile 确保数据加载
                    this.openProfile(authorName);

                    setTimeout(() => {
                        let realIndex = 0;
                        // 优先 ID 匹配
                        if (targetWorkId) {
                            const idx = creatorData.works.findIndex(w => String(w.id) === String(targetWorkId));
                            if (idx !== -1) realIndex = idx;
                            else if (!isNaN(workIndex)) realIndex = workIndex;
                        } else if (!isNaN(workIndex)) {
                            realIndex = workIndex;
                        }

                        if (realIndex >= 0 && realIndex < creatorData.works.length) {
                            this.playFromProfile(realIndex);
                            app.interaction.showToast('已定位到分享的作品');
                        } else {
                            app.interaction.showToast('未找到指定作品');
                        }
                    }, 300); // 稍微延迟等待页面切换动画
                    return true;
                }

                return false;
            }
            // 2. 【更新】处理启动时的地址栏链接
            async handleGlobalDeepLink() {
                const params = new URLSearchParams(window.location.search);
                // 调用统一逻辑
                const result = await this._executeDeepLink(params);

                // 只有在启动时才清理 URL，聊天室点击不需要清理地址栏
                if (result) {
                    this.cleanUrlParams();
                }
                return result;
            }

            // 3. 【新增】处理聊天室点击的内部链接
            resolveSharedUrl(urlStr) {
                try {
                    // 将完整 URL 转换为 URL 对象以提取参数
                    const urlObj = new URL(urlStr);
                    const params = urlObj.searchParams;

                    // 调用统一逻辑
                    // 注意：这里不使用 await，让其在后台执行，直接返回 true 阻止默认跳转
                    this._executeDeepLink(params);
                    return true;
                } catch (e) {
                    console.error("链接解析失败", e);
                    return false;
                }
            }

            // 辅助：清除 URL 参数但保留页面
            cleanUrlParams() {
                const cleanUrl = window.location.href.split('?')[0];
                window.history.replaceState({}, document.title, cleanUrl);
            }
            bindAddCreatorEvents() {
                const randomNameGroup = document.getElementById('random-api-name-group');
                const randomUrlGroup = document.getElementById('random-api-url-group');

                document.querySelectorAll('input[name="add-method"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        const method = e.target.value;
                        const dyInputGroup = document.getElementById('dy-url-group');
                        const jsonInputGroup = document.getElementById('json-url-group');
                        const btn = document.getElementById('add-creator-btn');

                        const showDy = method === 'dy-url';
                        const showJson = method === 'json-url';
                        const showImport = method === 'import-file';
                        const showRandom = method === 'random-api';

                        dyInputGroup.style.display = showDy ? 'block' : 'none';
                        jsonInputGroup.style.display = showJson ? 'block' : 'none';

                        if (randomNameGroup) randomNameGroup.style.display = showRandom ? 'block' : 'none';
                        if (randomUrlGroup) randomUrlGroup.style.display = showRandom ? 'block' : 'none';

                        if (showDy) {
                            btn.textContent = '开始获取';
                        } else if (showJson) {
                            btn.textContent = '开始添加';
                        } else if (showRandom) {
                            btn.textContent = '添加随机API';
                        } else if (showImport) {
                            btn.textContent = '选择文件并导入';
                        }
                    });
                });
                // 初始化
                document.querySelector('input[name="add-method"][value="dy-url"]').dispatchEvent(new Event('change'));
            }

            initSwiper() {
                if (this.mainSwiper) this.mainSwiper.destroy(true, true);

                this.mainSwiper = new Swiper(".mySwiper", {
                    direction: "vertical",
                    speed: 400,            // 稍微调慢切换速度，增加阻尼感，显得更丝滑
                    resistanceRatio: 0.7,  // 边缘回弹阻力
                    mousewheel: true,
                    threshold: 5,          // 降低滑动阈值，响应更灵敏
                    slidesPerView: 1,      // 强制一页显示一个
                    preloadImages: false,  // 关闭原生预加载，我们自己接管
                    lazy: false,
                    on: {
                        init: (s) => {
                            this.initGallery();
                            // 初始化时立即加载
                            this.coordinator.handleSlideChange(s, false);
                            this.onChange(s);
                            this.checkUrlParamsAndJump(s);
                        },
                        touchStart: () => {
                            this.isSwiping = false;
                            this.swipeStartX = null;
                            this.swipeStartY = null;
                            this.swipeMoved = false;
                        },
                        touchMove: (e) => {
                            if (!e || !e.touches || e.touches.length !== 1) return;
                            const touch = e.touches[0];
                            if (this.swipeStartX === null || this.swipeStartY === null) {
                                this.swipeStartX = touch.clientX;
                                this.swipeStartY = touch.clientY;
                                return;
                            }
                            const dx = Math.abs(touch.clientX - this.swipeStartX);
                            const dy = Math.abs(touch.clientY - this.swipeStartY);
                            const moved = dx > 8 || dy > 8;
                            if (moved) {
                                this.swipeMoved = true;
                                this.isSwiping = true;
                                this.lastSwipeTime = Date.now();
                            }
                        },
                        // touchEnd is handled below once; duplicate object keys were removed during refactor.
                        // 开始切换时，立即停止当前播放，防止声音重叠
                        slideChangeTransitionStart: () => {
                            this.isSwiping = true;
                            this.lastSwipeTime = Date.now();
                            this.mediaManager.stop();
                        },
                        // 切换结束（核心优化）
                        slideChangeTransitionEnd: (s) => {
                            const now = Date.now();
                            // 节流阈值：250ms。如果两次滑动间隔小于此值，视为快速滑动
                            const isFastScroll = this.lastSlideTime && (now - this.lastSlideTime < 250);
                            this.lastSlideTime = now;
                            setTimeout(() => { this.isSwiping = false; }, 80);

                            // 调用协调器，传入节流标记
                            this.coordinator.handleSlideChange(s, isFastScroll);

                            if (!isFastScroll) {
                                this.onChange(s); // 只有慢速滑动才触发自动播放逻辑
                            } else {
                                console.log("快速滑动中... 跳过自动播放");
                                // 快速滑动结束后，如果用户停在当前页，延迟补一次完整激活。
                                // v5 中 fast 模式只执行 poster-only，导致视频不再被激活，主页面会一直 loading。
                                if (this.fastScrollSettleTimer) clearTimeout(this.fastScrollSettleTimer);
                                this.fastScrollSettleTimer = setTimeout(() => {
                                    if (!s || s.destroyed || !s.slides || !s.slides.length) return;
                                    const activeSlide = s.slides[s.activeIndex];
                                    if (!activeSlide || activeSlide.classList.contains('processed')) return;
                                    this.coordinator.handleSlideChange(s, false);
                                    this.onChange(s);
                                }, 260);
                            }

                            // 到底部预加载下一批
                            if (s.activeIndex >= s.slides.length - 2) {
                                this.appendNextBatch();
                            }

                            // 随机视频：提前拉取下一批，避免滑到尽头才开始加载
                            if ((this.randomFeedMode === 'api' || this.randomFeedMode === 'api-single' || this.randomFeedMode === 'mix-random') && !this.randomFeedExhausted) {
                                const remaining = this.fullPlaylist.length - (s.activeIndex + 1);
                                if (remaining <= 2) {
                                    if (this.randomFeedMode === 'mix-random') {
                                        this._loadMoreMixedRandomWorks();
                                    } else {
                                        this._loadMoreRandomWorks();
                                    }
                                }
                            }

                            // 到底提示自动回弹
                            const activeSlide = s.slides[s.activeIndex];
                            if (activeSlide && activeSlide.id === 'end-tip-slide') {
                                if (this.bounceTimer) clearTimeout(this.bounceTimer);
                                this.bounceTimer = setTimeout(() => {
                                    if (s.activeIndex === s.slides.length - 1) s.slidePrev();
                                }, 1500);
                            }
                        },
                        // 触摸释放时检测
                        touchEnd: (s) => {
                            // 如果是快速滑动后的停留，手动触发一次播放
                            if (this.swipeMoved) {
                                this.lastSwipeTime = Date.now();
                            }
                            setTimeout(() => { this.isSwiping = false; }, 120);
                            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);

                            this.scrollTimeout = setTimeout(() => {
                                // --- 【核心修复：增加存活检查】 ---
                                // 1. 检查 Swiper 实例是否存在且未销毁
                                if (!s || s.destroyed) return;

                                // 2. 检查 slides 数组是否存在且不为空
                                if (!s.slides || s.slides.length === 0) return;

                                // 3. 检查索引是否越界
                                const activeIndex = s.activeIndex;
                                if (activeIndex === undefined || activeIndex < 0 || activeIndex >= s.slides.length) return;

                                // 4. 安全获取当前 slide
                                const slide = s.slides[activeIndex];

                                // 5. 执行逻辑
                                if (slide && !slide.classList.contains('processed')) {
                                    this.coordinator.handleSlideChange(s, false); // 强制非快速模式加载
                                    this.onChange(s);
                                }
                            }, 300); // 300ms 无操作视为静止
                        }
                    }
                });
            }
            checkUrlParamsAndJump(swiper) {
                const urlParams = new URLSearchParams(window.location.search);
                const targetIndex = parseInt(urlParams.get('index'));

                if (!isNaN(targetIndex) && targetIndex >= 0) {
                    // 如果目标索引在当前已加载的范围内
                    if (targetIndex < this.fullPlaylist.length) {
                        // 这里可能需要先 append 足够的数据如果懒加载还没到那里
                        // 简单起见，假设直接跳转
                        console.log("跳转到分享位置:", targetIndex);

                        // 如果目标索引大于当前渲染的 slides 数量，可能需要追加数据
                        // 这里假设数据已经通过 resetPlaylist 加载进内存了
                        if (targetIndex >= swiper.slides.length) {
                            // 强制加载到目标位置 (简单扩充)
                            this.appendNextBatch(); // 可能需要循环调用直到满足
                            // 实际生产环境需要更复杂的跳转加载逻辑，这里做个简单处理
                        }

                        // 执行跳转，不带动画
                        swiper.slideTo(targetIndex, 0);

                        // 提示用户
                        app.interaction.showToast(`已跳转到第 ${targetIndex + 1} 个作品`);

                        // 清除 URL 参数，避免刷新后还在那个位置
                        const newUrl = window.location.href.split('?')[0];
                        window.history.replaceState({}, document.title, newUrl);
                    }
                }
            }
            initGallery() {
                document.querySelectorAll('.gallery-swiper').forEach(el => {
                    if (el.swiper && el.swiper.params && el.swiper.params.loop) {
                        el.swiper.destroy(true, true);
                    }
                    if (!el.swiper) {
                        const slides = el.querySelectorAll('.swiper-slide');
                        const canLoop = slides.length > 1;
                        let galleryTouchStartX = 0;
                        let galleryTouchStartY = 0;
                        const scheduleGalleryAutoNext = (s) => {
                            if (el.dataset.waitingAutoNext === 'true') return;
                            if (app.galleryNextTimer) {
                                clearTimeout(app.galleryNextTimer);
                                app.galleryNextTimer = null;
                            }
                            if (s && s.autoplay && s.autoplay.running) {
                                s.autoplay.stop();
                            }
                            el.dataset.waitingAutoNext = 'true';
                            app.handleGalleryEnded(s, 3000);
                        };
                        const swiper = new Swiper(el, {
                            nested: true,
                            loop: canLoop,
                            rewind: false,
                            speed: 300,       // 稍微加快切换速度
                            effect: 'slide',   // 建议：图集使用 fade 效果通常比 slide 更顺滑且不易穿帮
                            fadeEffect: { crossFade: true },
                            // 由 MediaManager 启动；禁止最后一张自动回到第一张
                            autoplay: false,
                            pagination: {
                                el: `.gallery-pagination-${el.classList[2].split('-')[1]}`,
                                clickable: true // <--- 必须加上这一行，点击才会有反应
                            },
                            on: {
                                reachEnd: (s) => {
                                    if (Number(CONFIG.GALLERY_AUTOPLAY_DELAY) <= 0) return;
                                    scheduleGalleryAutoNext(s);
                                },
                                // 1. 资源协调器
                                slideChange: (s) => {
                                    app.coordinator.onGallerySlideChange(s);
                                    // 任务17：菜单打开时切换图片更新信息
                                    if (document.getElementById('work-settings-sheet').classList.contains('active')) {
                                        const slide = s.el.closest('.swiper-slide'); // 获取外层 Slide
                                        const data = app.fullPlaylist[app.mainSwiper.activeIndex];
                                        if (app.menuManager) app.menuManager._analyzeMedia(slide, data);
                                    }

                                    // 自动连播下一作品逻辑
                                    if (Number(CONFIG.GALLERY_AUTOPLAY_DELAY) > 0) {
                                        if (app.galleryNextTimer) {
                                            clearTimeout(app.galleryNextTimer);
                                            app.galleryNextTimer = null;
                                        }
                                        el.dataset.waitingAutoNext = 'false';
                                        // 计算真实数量
                                        const totalReal = el.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)').length;

                                        if (s.realIndex === totalReal - 1) {
                                            scheduleGalleryAutoNext(s);
                                        } else if (app.mediaManager) {
                                            app.mediaManager.resumeGalleryAfterInteraction(s);
                                        }
                                    } else if (app.mediaManager) {
                                        app.mediaManager.resumeGalleryAfterInteraction(s);
                                    }
                                },
                                // 2. 触摸开始
                                touchStart: (s, event) => {
                                    const touch = event && event.touches ? event.touches[0] : null;
                                    galleryTouchStartX = touch ? touch.clientX : 0;
                                    galleryTouchStartY = touch ? touch.clientY : 0;
                                    if (swiper.autoplay && swiper.autoplay.running) {
                                        swiper.autoplay.stop();
                                    }
                                    if (el.restartAutoPlayTimer) {
                                        clearTimeout(el.restartAutoPlayTimer);
                                        el.restartAutoPlayTimer = null;
                                    }
                                    el.dataset.isManualInteracting = 'true';
                                    if (app.galleryNextTimer) {
                                        clearTimeout(app.galleryNextTimer);
                                        app.galleryNextTimer = null;
                                    }
                                },
                                // 3. 触摸结束 (修复点)
                                touchEnd: (s, event) => {
                                    const totalReal = el.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)').length;
                                    const touch = event && event.changedTouches ? event.changedTouches[0] : null;
                                    const dx = touch ? touch.clientX - galleryTouchStartX : 0;
                                    const dy = touch ? touch.clientY - galleryTouchStartY : 0;
                                    const isLooping = !!swiper.params?.loop;
                                    const isManualNextAtEnd = !isLooping && swiper.realIndex === totalReal - 1 && dx < -45 && Math.abs(dx) > Math.abs(dy) * 1.2;
                                    const isManualPrevAtStart = !isLooping && swiper.realIndex === 0 && dx > 45 && Math.abs(dx) > Math.abs(dy) * 1.2;
                                    if (isManualNextAtEnd) {
                                        if (app.galleryNextTimer) {
                                            clearTimeout(app.galleryNextTimer);
                                            app.galleryNextTimer = null;
                                        }
                                        el.dataset.waitingAutoNext = 'false';
                                        swiper.slideTo(0, 300);
                                        if (app.mediaManager) app.mediaManager.resumeGalleryAfterInteraction(swiper, 3000);
                                        setTimeout(() => {
                                            el.dataset.isManualInteracting = 'false';
                                        }, 500);
                                        return;
                                    }
                                    if (isManualPrevAtStart) {
                                        if (app.galleryNextTimer) {
                                            clearTimeout(app.galleryNextTimer);
                                            app.galleryNextTimer = null;
                                        }
                                        el.dataset.waitingAutoNext = 'false';
                                        swiper.slideTo(totalReal - 1, 300);
                                        if (app.mediaManager) app.mediaManager.resumeGalleryAfterInteraction(swiper, 3000);
                                        setTimeout(() => {
                                            el.dataset.isManualInteracting = 'false';
                                        }, 500);
                                        return;
                                    }
                                    if (Number(CONFIG.GALLERY_AUTOPLAY_DELAY) > 0 && swiper.realIndex === totalReal - 1) {
                                        el.dataset.waitingAutoNext = 'false';
                                        scheduleGalleryAutoNext(swiper);
                                        setTimeout(() => {
                                            el.dataset.isManualInteracting = 'false';
                                        }, 500);
                                        return;
                                    }
                                    if (CONFIG.GALLERY_AUTOPLAY_DELAY > 0) {
                                        el.restartAutoPlayTimer = setTimeout(() => {
                                            const parentSlide = el.closest('.swiper-slide');
                                            if (el.swiper && !el.swiper.destroyed && parentSlide && parentSlide.classList.contains('swiper-slide-active')) {
                                                app.mediaManager?.resumeGalleryAfterInteraction(swiper, 0);
                                            }
                                        }, 3000);
                                    }
                                    setTimeout(() => {
                                        el.dataset.isManualInteracting = 'false';
                                    }, 500);
                                },
                                // ★ 新增：在 Swiper 初始化后，拦截分页器的点击事件冒泡 ★
                                afterInit: (s) => {
                                    if (s.pagination && s.pagination.el) {
                                        // 阻止分页器区域的点击事件向上冒泡到 InteractionManager
                                        s.pagination.el.addEventListener('click', (e) => {
                                            e.stopPropagation();
                                        }, { passive: false });

                                        // 同样阻止触摸事件，防止触发视频的 touchstart 逻辑
                                        s.pagination.el.addEventListener('touchstart', (e) => {
                                            e.stopPropagation();
                                        }, { passive: true });
                                    }
                                },
                            }
                        });

                        if (swiper.autoplay && CONFIG.GALLERY_AUTOPLAY_DELAY === -1) {
                            swiper.autoplay.stop();
                        }
                    }
                });
            }


            resetPlaylist(dataList, targetIndex = 0, options = {}) {
                this.fullPlaylist = dataList;
                this.renderedCount = 0;
                document.getElementById('video-list').innerHTML = '';
                if (!options.preserveHomeViews) {
                    this.recommendViewInitialized = false;
                    this.doubleViewInitialized = false;
                    this.feedScrollPositions.recommend = 0;
                    this.feedScrollPositions.double = 0;
                }
                // 传入 targetIndex，确保首次渲染足够多的 Slide
                this.appendNextBatch(true, targetIndex);
                if (this.pageManager && this.fullPlaylist.length > 0) {
                    const safeIndex = Math.max(0, Math.min(targetIndex, this.fullPlaylist.length - 1));
                    this.pageManager.updateMusicMiniPlayer(this.fullPlaylist[safeIndex], { preferDom: false });
                }
            }
            appendNextBatch(isInitial = false, targetIndex = 0) {
                if (this.isLoadingMore) return;

                if (this.renderedCount >= this.fullPlaylist.length) {
                    if (this.randomFeedMode === 'api' || this.randomFeedMode === 'api-single') {
                        this._loadMoreRandomWorks();
                        return;
                    }
                    if (this.randomFeedMode === 'mix-random') {
                        this._loadMoreMixedRandomWorks();
                        return;
                    }
                    this.appendEndTipSlide();
                    return;
                }

                this.isLoadingMore = true;
                const start = this.renderedCount;

                // --- 【核心修改】计算本次加载数量 ---
                let batchCount = CONFIG.BATCH_SIZE;

                // 如果是初始化且有跳转目标，必须确保加载到目标位置
                if (isInitial && targetIndex > 0) {
                    // 比如点第10个，我们需要加载 0~10，再加上 2 个预加载，共加载 targetIndex + 3 条
                    const needed = targetIndex + 3;
                    if (needed > batchCount) {
                        batchCount = needed;
                    }
                }

                const end = Math.min(start + batchCount, this.fullPlaylist.length);
                const batchData = this.fullPlaylist.slice(start, end);
                const slidesHtml = [];

                batchData.forEach((item, i) => {
                    slidesHtml.push(`<div class="swiper-slide">${this.renderer.createSlideHtml(item, start + i)}</div>`);
                });

                this.renderedCount = end;

                if (isInitial) {
                    document.getElementById('video-list').innerHTML = slidesHtml.join('');
                    this.initSwiper();
                } else {
                    this.mainSwiper.appendSlide(slidesHtml);
                    this.initGallery();
                }
                if (this.feedMode === 'double') {
                    this.renderDoubleColumn();
                }
                if (this.feedMode === 'recommend') {
                    this.appendRecommendBatch();
                }
                this.isLoadingMore = false;
            }

            async _loadMoreRandomWorks() {
                if (!this.randomVideoLoader || this.randomFeedLoading || this.randomFeedExhausted) return;
                this.randomFeedLoading = true;
                try {
                    const batchSize = CONFIG.BATCH_SIZE;
                    const loadMore = (this.randomFeedMode === 'api-single' && this.randomFeedApi)
                        ? this.randomVideoLoader.loadBatchFromApi(this.randomFeedApi, batchSize)
                        : this.randomVideoLoader.loadBatch(batchSize);

                    let newWorks = await loadMore;

                    if (!newWorks || newWorks.length === 0) {
                        this.randomFeedExhausted = true;
                        this.appendEndTipSlide();
                        return;
                    }

                    // --- 核心修复：为纯 API 视频流注入广告 ---
                    const processedWorks = this._injectAds(newWorks, 12);
                    this.fullPlaylist = this.fullPlaylist.concat(processedWorks);
                    this.appendNextBatch();
                } catch (err) {
                    console.error('随机视频载入失败', err);
                    this.randomFeedExhausted = true;
                    this.appendEndTipSlide();
                } finally {
                    this.randomFeedLoading = false;
                }
            }

            async _loadMoreMixedRandomWorks() {
                if (!this.randomVideoLoader || this.randomFeedLoading || this.randomFeedExhausted) return;
                if (!Array.isArray(this.randomFeedApis) || this.randomFeedApis.length === 0) return;

                this.randomFeedLoading = true;
                try {
                    const batchSize = CONFIG.BATCH_SIZE;
                    const newWorks = await this.randomVideoLoader.loadBatchFromApis(this.randomFeedApis, batchSize);

                    if (!newWorks || newWorks.length === 0) {
                        this.randomFeedExhausted = false;
                        return;
                    }

                    // 1. 先进行动态混淆
                    let mixedWorks = this._mixWorksByAuthorWindow(newWorks, 12);

                    const processedWorks = this._injectAds(mixedWorks, 10);

                    this.fullPlaylist = this.fullPlaylist.concat(processedWorks);
                    this.appendNextBatch();
                } catch (err) {
                    console.error('动态混合加载失败', err);
                    this.randomFeedExhausted = false;
                } finally {
                    this.randomFeedLoading = false;
                }
            }

            appendEndTipSlide() {
                if (!this.mainSwiper) return;
                if (document.getElementById('end-tip-slide')) return;
                const endHtml = `
            <div class="swiper-slide" id="end-tip-slide" style="height: 15vh !important; background: transparent; display: flex; justify-content: center; align-items: flex-start; padding-top: 20px; color: #888; font-size: 13px; letter-spacing: 1px;">
                - 到底了 -
            </div>`;
                this.mainSwiper.appendSlide(endHtml);
                this.mainSwiper.update();
            }

            _shuffleWorksWeightedByRecency(list) {
                const weighted = list.map((item) => {
                    const ts = Number(item.timestamp) || 0;
                    const time = Number(item.time) || 0;
                    const created = Number(item.create_time) || 0;
                    const weight = Math.max(1, ts || time || created || 1);
                    return { item, key: Math.random() ** (1 / weight) };
                });
                weighted.sort((a, b) => b.key - a.key);
                return weighted.map(w => w.item);
            }

            loadCreator(name, targetFeed = 'single') {
                const c = this.dataLoader.globalCreators[name];
                if (c) {
                    if (c.info && c.info.origin_type === 'random_api') {
                        this.currentCreatorName = name;
                        if (this.renderer) {
                            this.renderer.renderSidebar(this.dataLoader ? this.dataLoader.globalCreators : {});
                        }
                        this.loadRandomFromSingleApi(c);
                        return;
                    }
                    // 检查过期
                    if (c.info.source_url && c.info.last_updated) {
                        const days = (Date.now() - c.info.last_updated) / (1000 * 60 * 60 * 24);
                        if (days > 3) {
                            // 提示用户更新，或者静默更新
                            app.interaction.showToast('数据较旧，建议在数据管理中更新');
                        }
                    }
                    this.currentCreatorName = name;
                    let works = this._shuffleWorksWeightedByRecency([...(c.works || [])]);
                    //this.adInjectionCounter = 0; // 切换博主时可以考虑重置或不重置
                    works = this._injectAds(works, 12); // 每12条一个广告

                    this.resetPlaylist(works);
                    const normalizedFeed = (targetFeed || '').toLowerCase();
                    const candidateFeeds = ['single', 'recommend', 'double'];
                    const nextFeed = candidateFeeds.includes(normalizedFeed) ? normalizedFeed : 'single';
                    this.switchFeedMode(nextFeed, { skipAutoPlay: true });
                    if (this.renderer) this.renderer.renderSidebar(this.dataLoader.globalCreators);
                    this.pageManager.closeAll();
                    this.switchFeedMode('single');
                }
            }

            _shuffleWorks(list) {
                for (let i = list.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [list[i], list[j]] = [list[j], list[i]];
                }
                return list;
            }

            _mixWorksByAuthorWindow(list, windowSize = 12) {
                const groupsMap = new Map();
                list.forEach((w) => {
                    const key = w.author || '未知';
                    if (!groupsMap.has(key)) groupsMap.set(key, []);
                    groupsMap.get(key).push(w);
                });

                const authors = Array.from(groupsMap.keys());
                this._shuffleWorks(authors);
                authors.forEach((author) => this._shuffleWorks(groupsMap.get(author)));

                const mixed = [];
                let start = 0;
                const totalAuthors = authors.length;

                while (mixed.length < list.length && totalAuthors > 0) {
                    const windowAuthors = [];
                    for (let i = 0; i < Math.min(windowSize, totalAuthors); i++) {
                        const idx = (start + i) % totalAuthors;
                        const author = authors[idx];
                        const remaining = groupsMap.get(author).length;
                        if (remaining > 0) windowAuthors.push({ author, weight: remaining });
                    }

                    if (windowAuthors.length === 0) {
                        start = (start + 1) % totalAuthors;
                        continue;
                    }

                    // 插值法：窗口内按顺序轮询取作品，不再按数量权重随机
                    const windowIdx = (mixed.length + start) % windowAuthors.length;
                    const chosen = windowAuthors[windowIdx].author;

                    const bucket = groupsMap.get(chosen);
                    mixed.push(bucket.pop());
                    start = (start + 1) % totalAuthors;
                }

                return mixed;
            }
            _injectAdsIntoBatch(newWorks) {
                if (!this.adVideos || this.adVideos.length === 0) return newWorks;

                const result = [];
                const adProb = 0.1; // 10% 的概率在每条新数据后插入广告

                newWorks.forEach(work => {
                    result.push(work);
                    if (Math.random() < adProb) {
                        const randomAd = JSON.parse(JSON.stringify(this.adVideos[Math.floor(Math.random() * this.adVideos.length)]));
                        randomAd.is_ad = true;
                        result.push(randomAd);
                    }
                });
                return result;
            }
            // 统一广告注入逻辑
            _injectAds(list, interval = 10) {
                // 安全检查：如果没有广告数据或列表为空，直接返回
                if (!this.adVideos || this.adVideos.length === 0 || !list || list.length === 0) return list;

                const result = [];
                list.forEach((item) => {
                    result.push(item);

                    // 只有非广告内容才计入计数器（防止广告连排）
                    if (!item.is_ad) {
                        this.adInjectionCounter++;
                    }

                    // 达到设定的间隔值
                    if (this.adInjectionCounter >= interval) {
                        const randomIndex = Math.floor(Math.random() * this.adVideos.length);
                        const ad = JSON.parse(JSON.stringify(this.adVideos[randomIndex]));
                        ad.is_ad = true;
                        ad.id = "ad_" + Date.now() + "_" + Math.random().toString(36).slice(-5);

                        result.push(ad);
                        this.adInjectionCounter = 0; // 插入广告后重置计数器

                    }
                });
                return result;
            }
            async loadRandom() {
                this.randomFeedMode = null;
                this.isRandomFeedActive = false;
                this.randomFeedExhausted = false;
                this.randomFeedLoading = false;
                this.randomFeedApi = null;
                this.randomFeedApis = [];

                let creators = this.dataLoader.globalCreators || {};
                const collection = (this.renderer && this.renderer.sidebarCollection) ? this.renderer.sidebarCollection : 'all';

                if (collection && collection !== 'all' && this.dataSystem && typeof this.dataSystem.getCollectionData === 'function') {
                    const collectionData = await this.dataSystem.getCollectionData();
                    const assignments = collectionData.assignments || {};
                    const keys = Object.keys(creators).filter((k) => assignments[k] === collection);
                    if (keys.length > 0) {
                        const filtered = {};
                        keys.forEach((k) => { filtered[k] = creators[k]; });
                        creators = filtered;
                    }
                }

                const mixCreators = Object.values(creators).filter((c) => {
                    if (!c || !c.info) return true;
                    return !(c.info.origin_type === 'local' && c.info.mix_enabled === false);
                });

                let works = [];
                mixCreators.forEach(c => {
                    if (c && Array.isArray(c.works)) works = works.concat(c.works);
                });

                // 如果过滤后没有任何作品，强制使用兜底数据
                if (works.length === 0) {
                    const fallback = this.dataLoader.getFallbackCreators();
                    Object.values(fallback).forEach(c => { works = works.concat(c.works); });
                }
                const windowSize = Math.max(4, Math.min(30, CONFIG.RANDOM_AUTHOR_WINDOW || 14));

                // 混合播放也尝试注入随机 API 作品，但不阻塞首屏渲染
                if (this.randomVideoLoader) {
                    const randomApis = mixCreators.filter(c => c && c.info && c.info.origin_type === 'random_api' && c.info.source_url);
                    if (randomApis.length > 0) {
                        this.randomFeedMode = 'mix-random';
                        this.randomFeedApis = randomApis;
                        this.randomFeedExhausted = false;
                        this.randomFeedLoading = false;
                        this.randomVideoLoader.setActiveApi(null);
                        setTimeout(() => {
                            this._loadMoreMixedRandomWorks();
                        }, 0);
                    }
                }
                works = this._mixWorksByAuthorWindow(works, windowSize);
                this.adInjectionCounter = 0; // 首屏开始前清零
                works = this._injectAds(works, 12);

                if (!works.length) {
                    this.interaction?.showToast?.('暂无可播放的混合推荐作品');
                    return;
                }

                this.currentCreatorName = '';
                if (this.renderer) {
                    this.renderer.renderSidebar(this.dataLoader.globalCreators);
                }

                // 4. 重置播放列表 
                this.resetPlaylist(works);
                this.pageManager.closeAll();
                this.switchFeedMode('single');
            }

            async loadRandomFromRandomApis() {
                if (!this.randomVideoLoader) return false;
                const hasApis = await this.randomVideoLoader.hasApis();
                if (!hasApis) return false;

                try {
                    if (this.randomVideoLoader) {
                        this.randomVideoLoader.setActiveApi(null);
                    }
                    const apiBatchSize = CONFIG.BATCH_SIZE;
                    const works = await this.randomVideoLoader.loadBatch(apiBatchSize);
                    if (!works.length) {
                        this.interaction.showToast('未从随机接口获取到视频');
                        return false;
                    }
                    const processedWorks = this._injectAds(works, 12); // 每12条插一个广告
                    this.randomFeedMode = 'api';
                    this.isRandomFeedActive = true;
                    this.randomFeedExhausted = false;
                    this.randomFeedLoading = false;
                    this.randomFeedApi = null;
                    this.randomFeedApis = [];
                    this.currentCreatorName = '';
                    this.resetPlaylist(processedWorks);
                    this.pageManager.closeAll();
                    return true;
                } catch (error) {
                    console.error('随机视频接口失败', error);
                    this.interaction.showToast('随机接口暂不可用');
                    return false;
                }
                this.switchFeedMode('single');
            }

            async loadCreatorWithPreload(name) {
                const c = this.dataLoader.globalCreators[name];
                if (!c) return;

                // 如果是随机API，立即开始预加载
                if (c.info && c.info.origin_type === 'random_api') {
                    // 立即开始预加载
                    setTimeout(() => {
                        if (this.randomVideoLoader) {
                            this.randomVideoLoader.setActiveApi(c);
                            this.randomVideoLoader.fillPrefetchQueueFromApi(c, CONFIG.BATCH_SIZE * 2);
                        }
                    }, 50);

                    // 然后调用原有的加载逻辑
                    this.loadRandomFromSingleApi(c);
                    return;
                }

                // 普通资源使用原有逻辑
                this.loadCreator(name, 'recommend');
            }

            async loadRandomFromSingleApi(apiData) {
                if (!this.randomVideoLoader || !apiData || !apiData.info || !apiData.info.source_url) return;

                // 显示加载提示
                this.interaction.showToast('正在从接口获取视频...', 2000);

                try {
                    this.randomVideoLoader.setActiveApi(apiData);
                    const apiBatchSize = CONFIG.BATCH_SIZE;

                    // 先加载首屏，避免侧边栏点击后等待预加载阻塞；首屏完成后再后台补队列。
                    const works = await this.randomVideoLoader.loadBatchFromApi(apiData, apiBatchSize);

                    if (!works.length) {
                        this.interaction.showToast('未从接口获取到视频');
                        return;
                    }

                    const processedWorks = this._injectAds(works, 12);
                    this.randomFeedMode = 'api-single';
                    this.isRandomFeedActive = true;
                    this.randomFeedExhausted = false;
                    this.randomFeedLoading = false;
                    this.randomFeedApi = apiData;
                    this.randomFeedApis = [];
                    this.currentCreatorName = apiData.info.name || '';
                    apiData.works = processedWorks;
                    apiData.info.last_updated = Date.now();

                    this.resetPlaylist(processedWorks);
                    this.pageManager.closeAll();
                    this.switchFeedMode('single');

                    // 优化：显示成功提示
                    this.interaction.showToast(`已加载 ${works.length} 个视频`);

                    // 优化：继续预加载更多视频
                    setTimeout(() => {
                        this.randomVideoLoader.fillPrefetchQueueFromApi(apiData, apiBatchSize * 3);
                    }, 500);

                } catch (error) {
                    console.error('随机接口加载失败', error);
                    this.interaction.showToast('随机接口暂不可用');
                }

            }


            onChange(s) {
                const slide = s.slides[s.activeIndex];
                const data = this.fullPlaylist[s.activeIndex];

                // 1. 播放媒体 (视频/音乐)
                if (slide) {
                    this.mediaManager.manualPauseOverlay = false;
                    this.mediaManager.play(slide);
                    this.mediaManager.updatePlayOverlay(true, slide);
                }

                // 2. 核心：切换作品时，立即刷新音乐页面的信息
                // 这包括：歌名、歌手、重置进度条为0、从 JSON 读取并显示总时长
                // 只有当音乐页面处于打开状态(active)时，此方法才会生效更新 DOM
                const musicPage = document.getElementById('music-manage-page');
                const isMusicPageActive = musicPage && musicPage.classList.contains('active');
                if (!isMusicPageActive && this.pageManager) {
                    const useDom = !!(this.randomFeedMode && data && data.type === '视频');
                    this.pageManager.updateMusicMiniPlayer(data, { preferDom: useDom });
                }
                this.pageManager.refreshMusicInfo(data);
            }

            detectLandscapeBtnForSlide(slide) {
                if (!slide) return;
                const btn = slide.querySelector('.landscape-toggle-btn');
                if (!btn) return;

                const video = slide.querySelector('video');
                if (!video) {
                    btn.style.display = 'none';
                    return;
                }

                const parent = slide.parentElement;
                const index = parent ? Array.from(parent.children).indexOf(slide) : -1;
                const data = (index >= 0 && index < this.fullPlaylist.length) ? this.fullPlaylist[index] : null;
                if (!data || data.type !== '视频') {
                    btn.style.display = 'none';
                    return;
                }

                const apply = (w, h) => {
                    if (!w || !h) {
                        btn.style.display = 'none';
                        return;
                    }
                    btn.style.display = (w / h) >= 1.5 ? 'flex' : 'none';
                };

                if (data.width && data.height) {
                    apply(data.width, data.height);
                    return;
                }

                if (video.videoWidth && video.videoHeight) {
                    data.width = video.videoWidth;
                    data.height = video.videoHeight;
                    apply(video.videoWidth, video.videoHeight);
                    return;
                }

                const onMeta = () => {
                    const vw = video.videoWidth;
                    const vh = video.videoHeight;
                    if (vw && vh) {
                        data.width = vw;
                        data.height = vh;
                        apply(vw, vh);
                    } else {
                        btn.style.display = 'none';
                    }
                };

                const onError = () => {
                    btn.style.display = 'none';
                };

                video.addEventListener('loadedmetadata', onMeta, { once: true });
                video.addEventListener('loadeddata', onMeta, { once: true });
                video.addEventListener('error', onError, { once: true });

                if (video.readyState >= 1) {
                    onMeta();
                }
            }

            adjustLayout(element) {
                const container = element.closest('.media-container');
                const slide = element.closest('.swiper-slide');
                let data = null;

                // --- 1. 获取宽高 (数据优先 -> DOM兜底) ---
                let w = 0;
                let h = 0;

                // 尝试从数据源获取准确尺寸
                if (slide && slide.parentElement) {
                    // 注意：这里要处理 gallery-swiper 的情况
                    if (slide.closest('.gallery-swiper')) {
                        // 如果是图集内的图片
                        // 暂时无法直接精确对应到该图集内具体哪张图的尺寸数据(除非数据结构极细)
                        // 所以图集图片主要依赖 DOM 的 naturalWidth
                    } else {
                        // 如果是主滑块的视频/封面
                        const index = Array.from(slide.parentElement.children).indexOf(slide);
                        data = this.fullPlaylist[index];
                        if (data) {
                            if (!data.is_random_api) {
                                w = data.width;
                                h = data.height;
                            }
                        }
                    }
                }

                // 如果数据源没有尺寸，读取 DOM 真实尺寸
                if (!w || !h) {
                    w = element.videoWidth || element.naturalWidth;
                    h = element.videoHeight || element.naturalHeight;
                }

                // --- 2. UI 状态重置 ---
                if (container) {
                    const loader = container.querySelector('.loader');
                    if (loader) loader.style.display = 'none';
                    const err = container.querySelector('.video-error');
                    if (err) err.style.display = 'none';
                    container.style.backgroundColor = 'black'; // 保持黑底
                }

                if (!w || !h) return; // 尺寸未就绪，暂不处理
                if (data && data.type === '视频' && (data.is_random_api || !data.width || !data.height)) {
                    data.width = w;
                    data.height = h;
                }

                // --- 3. 核心修复：布局对齐逻辑 ---
                element.style.opacity = 1;
                const hwRatio = h / w;

                if (container) {
                    // 默认全部垂直居中、水平居中 (修复横屏图片靠上的问题)
                    container.style.display = 'flex';
                    container.style.justifyContent = 'center';
                    container.style.alignItems = 'center';

                    // 图片/视频样式重置
                    element.style.width = '100%';
                    element.style.height = '100%';
                    element.style.objectFit = 'contain';
                    element.style.objectPosition = 'center';

                    // --- 特殊处理：超长图 (长宽比 > 3) ---
                    // 只有超长图才需要顶对齐，方便用户从头开始看，或者配合缩放查看
                    if (element.tagName === 'IMG' && hwRatio > 3) {
                        // 这里保持 contain，但允许用户通过手势放大（Zoom logic）
                        // 如果你想让长图默认铺满宽度（会看不全下面），可以用 cover
                        // 但通常播放器模式下，contain 居中是最安全的

                        // 如果你确实希望长图顶对齐：
                        // container.style.alignItems = 'flex-start';
                        // element.style.objectPosition = 'top';
                    }
                }

                // --- 4. 计算横屏按钮位置 ---
                // 获取宽高比
                const ratioVal = (w / h).toFixed(2);
                const videoRatio = parseFloat(ratioVal);

                if (slide) {
                    const btn = slide.querySelector('.landscape-toggle-btn');

                    if (btn && !isNaN(videoRatio)) {
                        // 只要是横屏 (宽 > 高)，就显示全屏按钮
                        if (videoRatio >= 1.5) { // 1.5 以上才显示
                            const screenW = window.innerWidth;
                            const screenH = window.innerHeight;

                            // 计算视频实际渲染高度
                            const visualHeight = screenW / videoRatio;
                            // 计算黑边高度
                            const blackBarHeight = (screenH - visualHeight) / 2;
                            // 按钮位置：黑边高度 - 调整值
                            let visualBottomOffset = Math.max(120, blackBarHeight - 10);

                            // 如果黑边太小，强制底边距
                            if (blackBarHeight < 120) visualBottomOffset = 120;

                            btn.style.bottom = `${visualBottomOffset}px`;
                            btn.style.display = 'flex';
                        } else {
                            btn.style.display = 'none';
                        }
                    }
                }
            }
            syncVideoSrcWithData(videoEl) {
                if (!videoEl) return;
                const src = videoEl.currentSrc || videoEl.src || '';
                const slide = videoEl.closest('.swiper-slide');
                if (!slide || slide.closest('.gallery-swiper')) return;
                const parent = slide.parentElement;
                if (!parent) return;
                const index = Array.from(parent.children).indexOf(slide);
                if (index < 0 || index >= this.fullPlaylist.length) return;
                const data = this.fullPlaylist[index];
                if (!data || data.type !== '视频') return;
                const isHttpSrc = src && src.startsWith('http');
                const finalUrl = isHttpSrc ? src : (data.url || '');
                if (isHttpSrc && data.url !== src) data.url = src;
                if (data.is_random_api) {
                    if (finalUrl && data._last_logged_url !== finalUrl) {
                        console.log(`[RandomVideo] final url: ${finalUrl} (${data.source_api || 'api'})`);
                        data._last_logged_url = finalUrl;
                    }
                }
                if (data.url === src) {
                    // keep
                }
                if (this.pageManager) {
                    this.pageManager.updateMusicMiniPlayer(data, { preferDom: true });
                }
            }
            // 2. 个人主页逻辑：识别置顶作品
            openProfile(name) {
                if (!name && this.fullPlaylist.length > 0) {
                    name = this.fullPlaylist[this.mainSwiper.activeIndex].author;
                }
                const c = this.dataLoader.globalCreators[name];

                // 获取原始列表
                let works = c ? [...c.works] : this.fullPlaylist.filter(i => i.author === name);
                const avatar = c ? c.info.avatar : '';

                // --- 置顶识别算法 ---
                // 逻辑：如果列表顺序与按时间倒序排列的顺序不一致，且该作品位于列表头部但时间较旧，则判定为置顶

                // 1. 创建一个按时间倒序排列的副本 (最新的在前)
                // 注意：过滤掉 timestamp 为 0 的数据干扰
                const sortedByTime = [...works].sort((a, b) => {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });

                // 2. 遍历原始列表，标记置顶
                // 我们假设置顶通常在最前面 (前3个)
                for (let i = 0; i < Math.min(works.length, 3); i++) {
                    const originalWork = works[i];

                    // 如果该位置的原始作品 ID 不等于 时间排序后该位置的作品 ID
                    // 且该原始作品的时间 比 时间排序后该位置的作品时间 要早 (说明它是旧作品被提上来了)
                    // 注意：这里简化逻辑，只要它不是时间序的第一名，且它排在原始列表第一位，就有极大可能是置顶

                    // 简单算法：直接对比 ID。如果 works[0] 的 ID 不等于 sortedByTime[0] 的 ID，说明 works[0] 被人为置顶了。
                    // 但如果前两个都是置顶呢？

                    // 更稳健的算法：检查当前作品在 sortedByTime 中的索引。
                    const naturalIndex = sortedByTime.findIndex(w => w.id === originalWork.id);

                    // 如果它在原始列表的 index (i) 小于它在自然时间列表中的 index (naturalIndex)
                    // 说明它被提前了 -> 置顶
                    if (naturalIndex > i) {
                        originalWork.isTop = true;
                    } else {
                        originalWork.isTop = false;
                    }
                }

                this.currentProfileWorks = works; // 这里保存的是包含 isTop 标记的原始顺序列表
                this.currentProfileName = name || '';

                this.renderer.renderProfileHeader(name, works.length, avatar);
                this.profileLoader.reset(works);
                this.pageManager.openProfile();
            }

            switchProfileView(mode) {
                this.profileLoader.changeView(mode);
            }
            // --- 新增：同步作品数据 (从全局最新数据源刷新当前对象) ---
            syncWorkData(work) {
                if (!work || !work.author) return;

                // 尝试从全局缓存中找到这个资源
                const globalCreator = this.dataLoader.globalCreators[work.author];
                if (globalCreator && globalCreator.works) {
                    // 在资源的最新作品列表中查找当前作品
                    const freshWork = globalCreator.works.find(w => {
                        // 匹配逻辑：视频比对URL，图集比对第一张图
                        if (work.type === '视频') return w.url === work.url;
                        // 兼容图集的不同存储格式
                        const wImg = w.images ? (Array.isArray(w.images[0]) ? w.images[0][0] : w.images[0]) : '';
                        const myImg = work.images ? (Array.isArray(work.images[0]) ? work.images[0][0] : work.images[0]) : '';
                        return wImg === myImg;
                    });

                    // 如果找到了更新的数据，同步属性
                    if (freshWork) {
                        work.like = freshWork.like;       // 同步最新点赞数
                        work.comment = freshWork.comment; // 同步最新评论数
                        work.cover = freshWork.cover;     // 同步最新封面
                        work.title = freshWork.title;     // 同步标题

                        // 注意：如果用户已点赞，renderer 渲染时会自动把心变红
                        // 我们只需要确保基础数值是最新的即可
                    }
                }
            }

            playFromMyMusic(idx) {
                const musicEntry = app.userDataManager.music[idx];
                if (!musicEntry || !musicEntry.url) {
                    app.interaction.showToast('无效的音乐链接');
                    return;
                }

                const coverUrl = (musicEntry.source_work && musicEntry.source_work.cover)
                    ? musicEntry.source_work.cover
                    : getDiceBearAvatar(musicEntry.author || 'Guest');

                // 构造纯音乐对象，关键是 type 不要包含 '视频'
                const dummyWork = {
                    type: '音乐', // 显式标记为音乐，Renderer需要处理
                    title: musicEntry.title || '纯音乐模式',
                    author: musicEntry.author || '未知艺术家',
                    cover: coverUrl,
                    images: [coverUrl], // 必须有图片数组以通过 createSlideHtml 的图集检查
                    music_info: { title: musicEntry.title, author: musicEntry.author, url: musicEntry.url },
                    duration: musicEntry.duration
                };

                // 进入播放
                this.enterContextPlay([dummyWork], 0);
                this.isMusicMode = true;

                setTimeout(() => {
                    app.pageManager.openMusicManage();
                    // 强制播放音频
                    const activeSlide = this.mainSwiper.slides[0];
                    if (activeSlide) {
                        // 确保没有视频元素干扰
                        const v = activeSlide.querySelector('video');
                        if (v) v.remove();

                        this.mediaManager.play(activeSlide);
                    }
                    app.interaction.showToast(`正在播放: ${musicEntry.title}`);
                }, 300);
            }

            // 1. 删除我的音乐 (列表操作)
            deleteMyMusic(e, index) {
                // 1. 阻止事件冒泡 (非常重要，否则会触发 item 的 onclick 导致跳转播放)
                if (e) e.stopPropagation();

                // 2. 获取数据
                const list = app.userDataManager.music;
                if (!list || !list[index]) return;

                const targetMusic = list[index];

                // 3. 确认删除 (可选)
                // if (!confirm(`确定要移除音乐 "${targetMusic.title}" 吗？`)) return;

                // 4. 执行删除
                // toggleMusic 会根据 ID 自动查找并删除，所以传入对象即可
                const newState = app.userDataManager.toggleMusic(targetMusic);

                // 理论上 newState 应该是 false (已移除)

                // 5. 刷新 UI
                // A. 重新渲染列表 (数据源已经在 toggleMusic 中被修改了)
                app.pageManager.renderMyMusic(app.userDataManager.music);

                // B. 更新顶部的统计数字
                app.pageManager.updateMyStats();

                // C. 检查是否为空，如果为空显示“暂无记录”
                if (app.userDataManager.music.length === 0) {
                    document.getElementById('my-empty-tip').style.display = 'block';
                    document.getElementById('my-music-list').style.display = 'none';
                }

                app.interaction.showToast('已取消收藏');
            }
            playFromProfile(idx) {
                this.enterContextPlay(this.currentProfileWorks, idx);
            }
            playFromFavDetail(idx) {
                if (!this.currentFavContext) return;

                this.currentFavContext.forEach(item => this.syncWorkData(item));

                // --- 修复 Task 2: 传入副本 ---
                this.enterContextPlay([...this.currentFavContext], idx);
            }
            playFromMyLikes(idx) {
                const list = app.userDataManager.likes;
                if (!list || list.length === 0) return;

                // 同步数据
                list.forEach(item => this.syncWorkData(item));

                // --- 修复 Task 2: 传入副本 ---
                // 使用 [...list] 创建一个新的数组，这样即使原数组删除了元素，
                // 播放列表里的顺序和索引也不会变，用户依然可以对当前视频进行操作
                this.enterContextPlay([...list], idx);
            }
            shareProfile() {
                const name = document.getElementById('profile-name').innerText;
                const count = document.getElementById('profile-count').innerText;

                // 构造带参数的链接
                const baseUrl = window.location.href.split('?')[0];
                const shareUrl = `${baseUrl}?share_type=profile&author=${encodeURIComponent(name)}`;

                const shareText = `【抖咻咻】推荐资源 @${name}\n${count}\n点击链接查看主页：\n${shareUrl}`;

                if (navigator.share) {
                    navigator.share({
                        title: `关注 ${name}`,
                        text: shareText,
                        url: shareUrl
                    }).catch(() => {
                        this.interaction.copyText({ innerText: shareText }); // 降级处理
                        this.interaction.showToast('链接已复制');
                    });
                } else {
                    // 纯复制
                    const input = document.createElement('textarea');
                    input.value = shareText;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    this.interaction.showToast(`已复制博主主页链接`);
                }
            }

            addNewCreator() {
                const method = document.querySelector('input[name="add-method"]:checked').value;

                if (method === 'dy-url') {
                    this.addCreatorFromDyUrl();
                } else if (method === 'json-url') {
                    this.addCreatorFromJsonUrl();
                } else if (method === 'import-file') {
                    // 触发隐藏的文件输入框
                    document.getElementById('import-file-input').click();
                } else if (method === 'random-api') {
                    this.addRandomVideoApi();
                }
            }
            // 【新增】切换添加方式 Tab 样式
            switchAddTab(labelEl) {
                // 移除所有 active
                document.querySelectorAll('.add-method-label').forEach(el => el.classList.remove('active'));
                // 激活当前
                labelEl.classList.add('active');

                // 触发原有的 change 事件逻辑 (为了显示/隐藏对应输入框)
                const radio = labelEl.querySelector('input');
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            // --- 修复版：资源重名检查工具函数 ---
            async checkDuplicateAndSave(data, originType) {
                if (!data || !data.info || !data.info.name) {
                    return { success: false, message: '数据无效' };
                }

                const name = data.info.name;
                // 使用 this.customManager 更加稳妥
                const existing = this.customManager.getAll()[name];

                if (existing) {
                    // 发现重名
                    // 使用 setTimeout 确保 confirm 弹窗不会阻塞 UI 渲染（稍微延迟一点点）
                    await new Promise(resolve => setTimeout(resolve, 50));

                    const choice = confirm(`检测到资源 "${name}" 已存在！\n\n[确定] 覆盖旧数据\n[取消] 重命名并保存为新资源`);

                    if (!choice) {
                        // 选择取消 -> 重命名
                        const newName = prompt("请输入新的资源名称：", name + "_副本");
                        if (!newName || !newName.trim()) {
                            app.interaction.showToast('操作取消');
                            return { success: false, message: '用户取消操作' };
                        }
                        data.info.name = newName.trim();
                    }
                    // 选择确定 -> 直接覆盖 (保持原名)
                }

                // 强制设置来源类型
                data.info.origin_type = originType;

                return this.customManager.save(data);
            }


            // --- 删除资源 ---
            async deleteCreator(e, name) {
                e.preventDefault(); // 阻止默认菜单
                const creator = this.dataLoader && this.dataLoader.globalCreators ? this.dataLoader.globalCreators[name] : null;
                const isLocal = creator && creator.info && creator.info.origin_type === 'local';
                if (isLocal) {
                    if (!confirm(`确定清除 "${name}" 的扫描记录吗？`)) return;
                    const type = creator.info.local_type || (name === LOCAL_MEDIA_CONFIG.video.name ? 'video' : 'music');
                    await this.resetLocalMediaData(type);
                    if (this.renderer) this.renderer.renderSidebar(this.dataLoader.globalCreators);
                    if (this.dataSystem && this.dataSystem.currentTab === 'creators') this.dataSystem.renderList();
                    if (this.resourceManager && this.resourceManager.currentName === name) {
                        this.resourceManager.data = this.dataLoader.globalCreators[name];
                        this.resourceManager.renderWorks();
                        this.resourceManager.refreshLocalScanStatus();
                        this.resourceManager.refreshLocalMixToggle();
                    }
                    this.refreshStats();
                    this.interaction.showToast('扫描记录已清除');
                    return;
                }
                if (confirm(`确定要删除资源合集 "${name}" 及其所有已保存的数据吗？`)) {
                    const success = await this.customManager.delete(name);
                    if (success) {
                        delete this.dataLoader.globalCreators[name];
                        this.renderer.renderSidebar(this.dataLoader.globalCreators);
                        this.refreshStats();
                        this.renderList();
                        alert('删除成功');
                    } else {
                        alert('无法删除内置资源');
                    }
                }
            }
            // --- 修复版：支持立即停止 (AbortController) ---
            async addCreatorFromDyUrl() {
                const btn = document.getElementById('add-creator-btn');
                const dyUrlInput = document.getElementById('dy-profile-url');

                // 1. 提取链接
                let rawUrl = dyUrlInput.value.trim();
                const urlMatch = rawUrl.match(/(https?:\/\/[^\s]+)/);
                const dyUrl = urlMatch ? urlMatch[0] : rawUrl;

                const progress = document.getElementById('add-progress');
                const progressText = document.getElementById('progress-text');
                const progressDetail = document.getElementById('progress-detail');

                // ------------------ 停止逻辑 ------------------
                if (this.isFetching) {
                    console.log("用户点击停止...");
                    this.isFetching = false;

                    // 【关键修复】强制中止当前的 fetch 请求
                    if (this.abortController) {
                        this.abortController.abort();
                    }

                    btn.textContent = '正在保存...';
                    btn.disabled = true;
                    return;
                }
                // ---------------------------------------------

                if (!dyUrl) {
                    this.showAddResult('error', '请输入抖音主页分享链接');
                    return;
                }

                // 3. 初始化状态
                this.isFetching = true;
                this.abortController = new AbortController(); // 【关键】初始化控制器

                progress.style.display = 'block';
                btn.textContent = '停止并保存';
                btn.style.backgroundColor = '#ff4d4f';
                dyUrlInput.disabled = true;

                try {
                    // 使用新的通用获取函数
                    const result = await this.dataSystem.fetchCreatorDataFromUrl(dyUrl, (page, count) => {
                        progressText.textContent = `正在获取第 ${page} 页...`;
                        progressDetail.innerHTML = `已获取: ${count} 条`;
                    }, this.abortController);

                    this.fetchedWorksBuffer = result.data;

                    // 检查是否被停止
                    if (result.aborted) {
                        // 如果被终止但有数据，仍然保存
                        if (this.fetchedWorksBuffer.length > 0) {
                            this.showAddResult('success', `已终止，但保存了 ${this.fetchedWorksBuffer.length} 条已获取数据`);
                            this.finishFetchingAndSave();
                        } else {
                            this.showAddResult('error', '获取已停止，无数据可保存');
                            this.resetAddFormState();
                        }
                        return;
                    }

                    // 正常完成
                    this.finishFetchingAndSave();

                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.error('流程错误:', error);
                        this.showAddResult('error', `错误: ${error.message}`);
                        this.resetAddFormState();
                        this.logger.error(`Fetch API Error: ${error.message}`);
                    }
                }
            }
            // --- 辅助：结束抓取并保存 (修复版) ---
            async finishFetchingAndSave() {
                const progressText = document.getElementById('progress-text');
                const progressDetail = document.getElementById('progress-detail');

                this.isFetching = false;

                if (this.fetchedWorksBuffer.length === 0) {
                    this.showAddResult('error', '未获取到任何有效作品');
                    this.resetAddFormState();
                    return;
                }

                progressText.textContent = '正在保存数据...';
                progressDetail.textContent = `共获取 ${this.fetchedWorksBuffer.length} 个作品`;

                // 获取当前输入的 URL (需要保存下来)
                const dyUrlInput = document.getElementById('dy-profile-url');
                let rawUrl = dyUrlInput.value.trim();
                const urlMatch = rawUrl.match(/(https?:\/\/[^\s]+)/);
                const sourceUrl = urlMatch ? urlMatch[0] : rawUrl;

                try {
                    const creatorData = this.convertDyDataToCreator(this.fetchedWorksBuffer, { source_url: sourceUrl });

                    // 【核心修复 2】必须加 await！
                    // 之前的错误原因：没有 await，result 拿到的是 Promise 对象
                    // if (Promise) 永远为 true，但 Promise.success 是 undefined
                    // 所以代码会抛出 "undefined" 错误，提示保存失败
                    const result = await this.checkDuplicateAndSave(creatorData, 'network');

                    if (result.success) {
                        this.showAddResult('success', `成功导入: ${creatorData.info.name}`, {
                            filename: 'Local Storage',
                            works_count: creatorData.works.length
                        });

                        if (this.pendingAddCollection && app.dataSystem) {
                            await app.dataSystem.setCreatorCollection(creatorData.info.name, this.pendingAddCollection);
                        }
                        // 更新侧边栏
                        this.dataLoader.globalCreators[creatorData.info.name] = creatorData;
                        this.renderer.renderSidebar(this.dataLoader.globalCreators);
                        if (this.randomVideoLoader) {
                            this.randomVideoLoader.refreshApis();
                        }

                        // 延迟关闭
                        setTimeout(() => {
                            this.pageManager.closePage('add-creator-page');
                            this.resetAddForm();
                        }, 2000);
                    } else {
                        // 如果是用户取消或者出错，抛出错误信息
                        throw new Error(result.message || '保存流程中断');
                    }
                } catch (e) {
                    // 如果是用户主动取消，不显示错误红字，而是提示取消
                    if (e.message === '用户取消操作') {
                        this.showAddResult('error', '用户已取消保存');
                    } else {
                        this.showAddResult('error', `保存失败: ${e.message}`);
                    }
                    this.resetAddFormState();
                }
            }



            async addCreatorFromJsonUrl() {
                const input = document.getElementById('creator-url-input');
                const url = input.value.trim();

                if (url === 'demo') { this.addDemoCreator(); return; }
                if (!url) { this.showAddResult('error', "请输入链接"); return; }

                const progressText = document.getElementById('progress-text');

                try {
                    progressText.textContent = '获取JSON数据...';
                    // === 修改：使用 Api.getJson ===
                    const data = await Api.getJson(url);

                    if (!data.info || !data.works) throw new Error("JSON格式不正确");

                    const result = await this.customManager.save(data); // 记得加 await

                    if (result.success) {
                        this.showAddResult('success', "添加成功", { filename: 'Local', works_count: data.works.length });
                        if (this.pendingAddCollection && app.dataSystem) {
                            await app.dataSystem.setCreatorCollection(data.info.name, this.pendingAddCollection);
                        }
                        this.dataLoader.globalCreators[data.info.name] = data;
                        this.renderer.renderSidebar(this.dataLoader.globalCreators);
                        setTimeout(() => { this.pageManager.closePage('add-creator-page'); this.resetAddForm(); }, 1500);
                    } else {
                        throw new Error(result.message);
                    }

                } catch (error) {
                    this.showAddResult('error', `添加失败: ${error.message}`);
                }
            }

            async addRandomVideoApi() {
                const btn = document.getElementById('add-creator-btn');
                const nameInput = document.getElementById('random-api-name');
                const urlInput = document.getElementById('random-api-url');
                const progress = document.getElementById('add-progress');
                const progressText = document.getElementById('progress-text');
                const progressDetail = document.getElementById('progress-detail');

                const apiName = nameInput ? nameInput.value.trim() : '';
                const apiUrl = urlInput ? urlInput.value.trim() : '';

                if (progress) {
                    progress.style.display = 'block';
                    progressText.textContent = '正在添加随机视频API...';
                    progressDetail.textContent = '正在保存接口配置...';
                }

                btn.disabled = true;
                btn.textContent = '添加中...';

                if (!apiName) {
                    this.showAddResult('error', '请输入接口名');
                    btn.disabled = false;
                    this.resetAddFormState();
                    return;
                }
                if (!apiUrl) {
                    this.showAddResult('error', '请输入接口地址');
                    btn.disabled = false;
                    this.resetAddFormState();
                    return;
                }

                const creatorData = {
                    info: {
                        name: apiName,
                        avatar: getDiceBearAvatar(apiName),
                        source_url: apiUrl,
                        last_updated: Date.now()
                    },
                    works: []
                };

                try {
                    const result = await this.checkDuplicateAndSave(creatorData, 'random_api');
                    if (!result.success) throw new Error(result.message || '保存失败');

                    this.dataLoader.globalCreators[apiName] = creatorData;
                    this.renderer.renderSidebar(this.dataLoader.globalCreators);
                    if (this.randomVideoLoader) {
                        this.randomVideoLoader.refreshApis();
                    }
                    if (this.dataSystem && this.dataSystem.currentTab === 'creators') {
                        this.dataSystem.renderList();
                    }

                    if (this.pendingAddCollection && app.dataSystem && typeof app.dataSystem.setCreatorCollection === 'function') {
                        await app.dataSystem.setCreatorCollection(apiName, this.pendingAddCollection);
                    }

                    this.showAddResult('success', `接口 "${apiName}" 已保存`, {
                        filename: 'Local Storage',
                        works_count: creatorData.works.length
                    });

                    setTimeout(() => {
                        this.pageManager.closePage('add-creator-page');
                        this.resetAddForm();
                    }, 1500);
                } catch (error) {
                    this.showAddResult('error', `添加失败: ${error.message}`);
                } finally {
                    btn.disabled = false;
                    this.resetAddFormState();
                }
            }

            // --- 修复版：处理文件导入 ---
            async handleFileSelect(input) {
                const file = input?.files?.[0];
                if (!file) return;

                const progress = document.getElementById('add-progress');
                const progressText = document.getElementById('progress-text');
                const progressDetail = document.getElementById('progress-detail');

                if (progress) progress.style.display = 'block';
                if (progressText) progressText.textContent = '正在读取文件...';
                if (progressDetail) progressDetail.textContent = `文件名: ${file.name}`;

                try {
                    const result = await readJsonFileFromInput(input);
                    if (!result) return;
                    const data = result.data;

                    if (!data.info || !data.works || !Array.isArray(data.works)) {
                        throw new Error('JSON格式不正确，缺少 info 或 works 字段');
                    }
                    if (!data.info.name) {
                        throw new Error('数据缺少资源名称 (info.name)');
                    }

                    if (progressText) progressText.textContent = '正在保存...';
                    const saveResult = await this.checkDuplicateAndSave(data, 'local');

                    if (saveResult.success) {
                        this.showAddResult('success', `导入成功: ${data.info.name}`, {
                            filename: file.name,
                            works_count: data.works.length
                        });

                        if (this.pendingAddCollection && app.dataSystem) {
                            await app.dataSystem.setCreatorCollection(data.info.name, this.pendingAddCollection);
                        }
                        this.dataLoader.globalCreators[data.info.name] = data;
                        this.renderer.renderSidebar(this.dataLoader.globalCreators);

                        setTimeout(() => {
                            this.pageManager.closePage('add-creator-page');
                            this.resetAddForm();
                        }, 1500);
                    } else {
                        throw new Error(saveResult.message || '保存失败');
                    }
                } catch (err) {
                    console.error('导入流程异常:', err);
                    this.showAddResult('error', `导入失败: ${err.message}`);
                    input.value = '';
                }
            }

            // 1. 数据解析：增加 id 和 time 的解析
            convertDyDataToCreator(dyData, extraInfo = {}) {
                if (!Array.isArray(dyData) || dyData.length === 0) {
                    throw new Error('数据为空');
                }

                const fieldMap = CONFIG.API_FIELD_MAP || {};
                const resolveItemData = (item) => {
                    const mapped = getValueByPath(item, CONFIG.API_ITEM_DATA_PATH);
                    if (mapped && typeof mapped === 'object') return mapped;
                    return item.data || item;
                };
                const getField = (obj, key, fallback) => {
                    const val = getMappedValue(obj, fieldMap, key, undefined);
                    if (val !== undefined && val !== null && val !== '') return val;
                    return fallback;
                };
                const pick = (item, key, fallback) => {
                    const d = resolveItemData(item);
                    const val = getField(d, key, undefined);
                    if (val !== undefined && val !== null && val !== '') return val;
                    const fallbackVal = getField(item, key, undefined);
                    if (fallbackVal !== undefined && fallbackVal !== null && fallbackVal !== '') return fallbackVal;
                    return fallback;
                };

                // 获取作者信息
                const firstItem = dyData[0];
                const firstWorkData = resolveItemData(firstItem);
                const authorName = pick(firstItem, 'author', firstWorkData.nickname || firstWorkData.author || '未知资源');
                const avatar = pick(firstItem, 'avatar', firstWorkData.avatar || getDiceBearAvatar(authorName || 'Guest'));
                const secUid = pick(firstItem, 'sec_uid', firstWorkData.sec_uid || '');

                const creatorInfo = {
                    name: authorName,
                    avatar: avatar,
                    signature: '来自一键导入',
                    uid: secUid || '',
                    source_url: extraInfo.source_url || '',
                    last_updated: Date.now(),
                    // 继承传入的 origin_type
                    origin_type: extraInfo.origin_type || 'network',
                    // 新增：记录抖音主页链接，便于后续更新数据
                    dy_profile_url: extraInfo.source_url || ''
                };

                const works = dyData.map(item => {
                    const d = resolveItemData(item);
                    const music = pick(item, 'music_info', item.music_info || d.music_info || {});

                    // 判断类型
                    const typeRaw = pick(item, 'type', d.type);
                    const isVideo = (typeRaw === '视频' || typeRaw === 'video' || typeRaw === 1 || pick(item, 'video_url', null) || pick(item, 'play_addr', null) || d.video_url || d.play_addr || d.video);
                    const type = isVideo ? '视频' : '图集';

                    const dims = this._getDimensions(item, type);

                    // --- 时间解析逻辑 ---
                    let timeStr = pick(item, 'time', item.time || d.time || ''); // API 返回如 "2025-11-29"
                    let timestamp = 0;
                    if (timeStr) {
                        // 尝试解析时间字符串为时间戳
                        timestamp = new Date(timeStr.replace(/-/g, '/')).getTime();
                        if (isNaN(timestamp)) timestamp = 0;
                    }
                    // 如果没有时间，使用当前时间作为占位，或者留空
                    if (!timeStr) timeStr = '未知时间';

                    const workId = pick(item, 'id', pick(item, 'aweme_id', d.aweme_id || d.id || ('local_' + Date.now() + Math.random())));
                    const work = {
                        // 1. 核心ID
                        id: workId,

                        // 2. 发布时间
                        create_time: timeStr,
                        timestamp: timestamp, //用于排序

                        title: pick(item, 'title', pick(item, 'desc', d.title || d.desc || '')),
                        author: authorName,
                        type: type,
                        like: Number(pick(item, 'like', pick(item, 'digg_count', d.like || d.digg_count || 0))) || 0,
                        comment: Number(pick(item, 'comment', pick(item, 'comment_count', d.comment || d.comment_count || 0))) || 0,
                        width: dims.w,
                        height: dims.h,
                        music_info: {
                            title: pick(item, 'music_title', music.title || '原声'),
                            author: pick(item, 'music_author', music.author || authorName),
                            url: pick(item, 'music_url', music.url || music.play_url || '')
                        }
                    };

                    // 提取 Duration 
                    const duration = pick(item, 'duration', d.duration || (d.video ? d.video.duration : 0));
                    if (duration) {
                        work.duration = duration;
                    }

                    // 提取 URL 和 Cover 
                    if (work.type === '视频') {
                        work.url = pick(item, 'video_url', pick(item, 'play_addr', (item.video_info && item.video_info.url) || d.video_url || d.play_addr || ''));
                        work.cover = pick(item, 'cover', pick(item, 'pic', d.pic || d.cover || ''));
                        if (!work.cover && d.video) {
                            work.cover = (d.video.cover && d.video.cover.url_list && d.video.cover.url_list[0]) || '';
                        }
                    } else {
                        let imgs = [];
                        const mappedImagesInfo = pick(item, 'images_info', null);
                        const mappedImages = pick(item, 'images', null);
                        if (mappedImagesInfo && Array.isArray(mappedImagesInfo)) {
                            imgs = mappedImagesInfo.map(img => Array.isArray(img) ? img[0] : (img.url_list ? img.url_list[0] : img.url || img));
                        } else if (mappedImages && Array.isArray(mappedImages)) {
                            imgs = mappedImages;
                        } else if (item.images_info && item.images_info.images) {
                            imgs = item.images_info.images.map(img => Array.isArray(img) ? img[0] : (img.url_list ? img.url_list[0] : img.url || img));
                        } else if (d.images) {
                            imgs = d.images;
                        }
                        work.images = imgs;
                        work.cover = pick(item, 'cover', pick(item, 'pic', d.pic || (imgs.length > 0 ? imgs[0] : '')));
                    }
                    return work;
                });

                return {
                    info: creatorInfo,
                    works: works
                };
            }


            // --- 新增：专用尺寸提取函数，提升准确率 ---
            _getDimensions(item, type) {
                const d = item.data || item;
                let w = 0;
                let h = 0;

                // 辅助检测函数：强制转数字并校验
                const check = (obj) => {
                    if (!obj) return false;

                    // 情况1: 对象包含 width/height 属性
                    if (obj.width !== undefined && obj.height !== undefined) {
                        const tw = parseInt(obj.width);
                        const th = parseInt(obj.height);
                        if (!isNaN(tw) && !isNaN(th) && tw > 0 && th > 0) {
                            w = tw;
                            h = th;
                            return true;
                        }
                    }

                    // 情况2: 数组格式 [url, width, height] (常见于 url_list)
                    if (Array.isArray(obj) && obj.length >= 3) {
                        const tw = parseInt(obj[1]);
                        const th = parseInt(obj[2]);
                        if (!isNaN(tw) && !isNaN(th) && tw > 0 && th > 0) {
                            w = tw;
                            h = th;
                            return true;
                        }
                    }
                    return false;
                };

                if (type === '视频') {
                    // 1. 最高优先级：video_info (通常是解析接口直接返回的元数据)
                    if (item.video_info && check(item.video_info)) return { w, h };

                    // 2. 原生 video 对象
                    if (d.video) {
                        if (check(d.video)) return { w, h };
                        if (check(d.video.play_addr)) return { w, h };
                        if (check(d.video.download_addr)) return { w, h };
                        // 3. 尝试从封面图获取 (通常视频封面比例与视频一致)
                        if (check(d.video.origin_cover)) return { w, h };
                        if (check(d.video.cover)) return { w, h };
                    }

                    // 4. 尝试顶层属性
                    if (check(d)) return { w, h };
                } else {
                    // 图集处理
                    let images = [];
                    // 结构 A: images_info.images
                    if (item.images_info && Array.isArray(item.images_info.images)) {
                        images = item.images_info.images;
                    }
                    // 结构 B: data.images
                    else if (Array.isArray(d.images)) {
                        images = d.images;
                    }

                    // 遍历寻找第一个有效的宽高
                    for (let img of images) {
                        // 检查图片对象本身
                        if (check(img)) break;

                        // 检查嵌套的 url_list
                        if (img.url_list && Array.isArray(img.url_list)) {
                            // 有些接口把宽高放在 url_list 的元素里，有些放在 img 本身
                            // 这里我们假设如果 img 本身没宽高，去 url_list 里的第一个元素看看
                            if (img.url_list.length > 0 && check(img.url_list[0])) break;
                        }
                    }
                }

                // 最后的兜底：如果完全没找到，返回 0, 0，交由 DOM 加载后的 adjustLayout 处理
                return { w, h };
            }

            // 显示添加结果
            showAddResult(type, message, data = null) {
                const progressText = document.getElementById('progress-text');
                const progressDetail = document.getElementById('progress-detail');
                const addBtn = document.getElementById('add-creator-btn');

                if (type === 'success') {
                    progressText.innerHTML = `<span style="color: #52c41a;">? ${message}</span>`;
                    if (data) {
                        progressDetail.innerHTML = `
                    <div style="color: #52c41a;">
                        <div>文件名: ${data.filename}</div>
                        <div>作品数量: ${data.works_count}</div>
                    </div>
                `;
                    }
                } else {
                    progressText.innerHTML = `<span style="color: #ff4d4f;">? ${message}</span>`;
                    progressDetail.textContent = '请检查输入后重试';
                }

                addBtn.disabled = false;
            }

            // --- 辅助：重置表单 UI 状态 ---
            resetAddFormState() {
                const btn = document.getElementById('add-creator-btn');
                const dyUrlInput = document.getElementById('dy-profile-url');
                const currentMethod = document.querySelector('input[name="add-method"]:checked');

                btn.disabled = false;
                if (currentMethod) {
                    if (currentMethod.value === 'dy-url') btn.textContent = '开始获取';
                    else if (currentMethod.value === 'json-url') btn.textContent = '开始添加';
                    else if (currentMethod.value === 'import-file') btn.textContent = '选择文件并导入';
                    else if (currentMethod.value === 'random-api') btn.textContent = '添加随机API';
                } else {
                    btn.textContent = '开始添加';
                }
                btn.style.backgroundColor = ''; // 恢复默认颜色
                dyUrlInput.disabled = false;
                this.isFetching = false;
            }

            resetAddForm() {
                // 1. 清空输入框内容
                document.getElementById('dy-profile-url').value = '';
                document.getElementById('creator-url-input').value = '';
                const randomNameInput = document.getElementById('random-api-name');
                const randomUrlInput = document.getElementById('random-api-url');
                if (randomNameInput) randomNameInput.value = '';
                if (randomUrlInput) randomUrlInput.value = '';

                // 2. 隐藏进度条
                const progress = document.getElementById('add-progress');
                if (progress) progress.style.display = 'none';

                // 3. 重置按钮可用状态 (解除 disabled)
                this.resetAddFormState();

                document.querySelectorAll('.random-api-group').forEach(el => el.style.display = 'none');

                // 4. 【核心修改】保持当前选中的 Tab，并同步 UI
                const currentRadio = document.querySelector('input[name="add-method"]:checked');

                if (currentRadio) {
                    // A. 触发 change 事件，让 bindAddCreatorEvents 中的监听器自动更新按钮文字和输入框显隐
                    currentRadio.dispatchEvent(new Event('change', { bubbles: true }));

                    // B. 同步 Tab 的高亮样式 (.active 类)
                    const label = currentRadio.closest('label'); // 或者是 .add-method-label
                    if (label) {
                        document.querySelectorAll('.add-method-label').forEach(el => el.classList.remove('active'));
                        label.classList.add('active');
                    }
                } else {
                    // 兜底：如果没有选中项（极少情况），则默认选中第一个
                    const first = document.querySelector('input[name="add-method"][value="dy-url"]');
                    if (first) {
                        first.checked = true;
                        first.dispatchEvent(new Event('change', { bubbles: true }));
                        first.parentElement.classList.add('active');
                    }
                }
            }

            async downloadMusic(url, title, author) {
                // --- 积分检查 (修改) ---
                if (!app.quotaManager.consume(1)) {
                    // 替换为新的专用提示
                    return app.interaction.showQuotaAlert();
                }

                if (!url) return app.interaction.showToast('没有音乐文件');

                app.interaction.showToast('开始下载音乐...');

                // 拼接文件名：标题 - 作者.mp3
                const cleanTitle = (title || '原声').replace(/[\\/:*?"<>|]/g, '');
                const cleanAuthor = (author || '未知').replace(/[\\/:*?"<>|]/g, '');
                const filename = `${cleanTitle} - ${cleanAuthor}.mp3`;

                try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    saveAs(blob, filename);

                    app.userDataManager.addDownloadLog('music', filename, url);
                    // 成功提示
                    app.interaction.showToast('音乐下载已开始');
                } catch (e) {
                    console.error("Music download failed", e);
                    // 失败回退：直接打开链接
                    window.open(url, '_blank');
                }
            }

            prepareDownload(idx) {
                const data = this.fullPlaylist[idx];
                const assets = this.downloadMgr.prepareAssets(data);
                this.renderer.renderDownloadGrid(assets);
                document.getElementById('download-sheet').classList.add('active');
            }
            executeDownload() {
                const selected = [];
                document.querySelectorAll('.dl-item.selected').forEach(el => selected.push(parseInt(el.querySelector('.dl-checkbox').dataset.index)));
                if (selected.length === 0) return alert("未选择");
                this.downloadMgr.downloadZip(selected);
            }
            executeDirectDownload() {
                const selected = [];
                document.querySelectorAll('.dl-item.selected').forEach(el => selected.push(parseInt(el.querySelector('.dl-checkbox').dataset.index)));
                if (selected.length === 0) return alert("未选择");
                this.downloadMgr.downloadDirect(selected);
            }
            executeCopyLinks() {
                const selected = [];
                document.querySelectorAll('.dl-item.selected').forEach(el => selected.push(parseInt(el.querySelector('.dl-checkbox').dataset.index)));
                if (selected.length === 0) return alert("未选择");
                navigator.clipboard.writeText(this.downloadMgr.getLinks(selected)).then(() => alert("链接已复制"));
            }
            getGalleryAutoNextDelay(gallerySwiper, baseDelayMs) {
                if (this.mediaManager && typeof this.mediaManager.getGalleryMusicWait === 'function') {
                    return this.mediaManager.getGalleryMusicWait(gallerySwiper, baseDelayMs);
                }
                const slide = gallerySwiper && gallerySwiper.el ? gallerySwiper.el.closest('.swiper-slide') : null;
                const audio = slide ? slide.querySelector('.bgm-audio') : null;
                if (!audio || audio.paused) return baseDelayMs;

                const duration = audio.duration;
                if (!isFinite(duration) || isNaN(duration) || duration <= 0) return baseDelayMs;

                const remainingMs = Math.max(0, (duration - audio.currentTime) * 1000);
                return Math.max(baseDelayMs, remainingMs);
            }
            handleGalleryEnded(gallerySwiper, delay = 2500) {
                // 双重保险：清除旧定时器
                if (this.galleryNextTimer) clearTimeout(this.galleryNextTimer);

                const finalDelay = this.getGalleryAutoNextDelay(gallerySwiper, delay);
                this.galleryNextTimer = setTimeout(() => {
                    // 再次检查条件：
                    // 1. 自动连播是否还开启
                    // 2. 页面是否还在最上层 (没有打开评论区等)
                    const isTopLayer = !document.querySelector('.page-layer.active') && !document.querySelector('.comment-layer.active');
                    const parentSlide = gallerySwiper && gallerySwiper.el ? gallerySwiper.el.closest('.swiper-slide') : null;
                    const totalReal = gallerySwiper && gallerySwiper.el
                        ? gallerySwiper.el.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)').length
                        : 0;
                    const stillActiveLast = gallerySwiper && !gallerySwiper.destroyed && parentSlide && parentSlide.classList.contains('swiper-slide-active')
                        && totalReal > 0 && gallerySwiper.realIndex === totalReal - 1;

                    if (Number(CONFIG.GALLERY_AUTOPLAY_DELAY) > 0 && isTopLayer && stillActiveLast) {
                        this.triggerAutoNext();
                    }
                }, finalDelay);
            }
            // 新增：视频播放结束处理
            handleVideoEnded(video) {
                // 读取全局配置或 MenuManager 状态（两者已同步）
                const isAuto = CONFIG.AUTO_NEXT_VIDEO;

                if (isAuto) {
                    this.triggerAutoNext();
                } else {
                    video.currentTime = 0;
                    video.play();
                }
            }

            // 新增：通用的自动跳转下一页逻辑（供视频和图集共用）
            triggerAutoNext() {
                // 检查是否还有下一页
                if (this.mainSwiper.activeIndex < this.mainSwiper.slides.length - 1) {
                    this.mainSwiper.slideNext();
                } else {
                    // 如果已经是最后一个，尝试加载更多数据
                    const prevCount = this.renderedCount;
                    this.appendNextBatch();

                    const isRandomFeed = this.randomFeedMode === 'api' || this.randomFeedMode === 'api-single' || this.randomFeedMode === 'mix-random';
                    const startWait = Date.now();
                    const maxWait = 6000;

                    const retry = () => {
                        // 如果渲染数量增加了，说明加载到了新数据，继续播放
                        if (this.renderedCount > prevCount) {
                            this.mainSwiper.slideNext();
                            return;
                        }
                        // 随机接口在拉取中或还没耗尽，继续等待一会
                        if (isRandomFeed && (this.randomFeedLoading || (!this.randomFeedExhausted && Date.now() - startWait < maxWait))) {
                            setTimeout(retry, 200);
                            return;
                        }
                        if (this.randomFeedMode === 'mix-random') {
                            setTimeout(() => this._loadMoreMixedRandomWorks(), 0);
                            setTimeout(retry, 400);
                            return;
                        }
                        // 确实没有更多了
                        const slide = this.mainSwiper.slides[this.mainSwiper.activeIndex];
                        const video = slide.querySelector('video');
                        // 循环播放当前视频
                        if (video) {
                            video.currentTime = 0;
                            video.play();
                        }
                        app.interaction.showToast('没有更多作品了');
                    };

                    setTimeout(retry, 120);
                }
            }


            // --- 核心修复：确保返回时能回到最顶层的页面 ---
            enterContextPlay(playlist, startIndex = 0) {
                if (this.feedMode === 'recommend') {
                    this.pauseAllRecommendSingleVideos();
                }
                if (this.mediaManager) {
                    this.mediaManager.stop();
                }
                // 修改点：使用 querySelectorAll 获取所有激活页面，并取最后一个（最顶层）
                const activePages = document.querySelectorAll('.page-layer.active');
                if (activePages.length > 0) {
                    // 记录最顶层的页面 ID (例如 fav-detail-page)
                    this.returnPageId = activePages[activePages.length - 1].id;
                } else {
                    this.returnPageId = null;
                }

                if (!this.isContextMode) {
                    const currentIndex = this.mainSwiper.activeIndex;
                    const currentSlide = this.mainSwiper.slides[currentIndex];
                    const video = currentSlide ? currentSlide.querySelector('video') : null;

                    this.homeFeedState = {
                        playlist: [...this.fullPlaylist],
                        index: currentIndex,
                        currentTime: video ? video.currentTime : 0,
                        feedMode: this.feedMode || 'single'
                    };
                    const currentView = (this.feedMode === 'recommend' && document.getElementById('recommend-view'))
                        || (this.feedMode === 'double' && document.getElementById('double-column-view'));
                    if (this.feedMode === 'recommend' || this.feedMode === 'double') {
                        this.feedReturnPosition = {
                            mode: this.feedMode,
                            scrollTop: currentView ? currentView.scrollTop : 0
                        };
                    } else {
                        this.feedReturnPosition = null;
                    }
                }

                this.setContextMode(true);
                this.isMusicMode = false;

                app.pageManager.pushState('context-play');

                this.resetPlaylist(playlist, startIndex, { preserveHomeViews: true });

                // 跳转到指定位置
                this.mainSwiper.slideTo(startIndex, 0);

                this.pageManager.closeAll();
            }

            // 恢复首页状态
            restoreHomeFeed(shouldPlay = true) {
                this.randomFeedMode = null;
                this.isRandomFeedActive = false;
                this.randomFeedExhausted = false;
                this.randomFeedLoading = false;
                // 如果没有备份状态，则降级为随机加载
                if (!this.homeFeedState) {
                    this.loadRandom();
                    return;
                }

                const prevFeedMode = this.homeFeedState.feedMode || 'single';
                // 1. 恢复数据
                this.fullPlaylist = this.homeFeedState.playlist;
                const targetIndex = this.homeFeedState.index;
                const savedTime = this.homeFeedState.currentTime;

                // --- 【核心修改点】先重置模式标记，再生成 HTML ---
                // 必须在调用 createSlideHtml 之前将 isContextMode 设为 false
                // 这样渲染器才会生成“侧边栏图标(?)”而不是“返回箭头(<)”
                this.setContextMode(false);

                // 2. 重建 DOM
                const endRender = Math.min(targetIndex + CONFIG.BATCH_SIZE, this.fullPlaylist.length);
                const slidesHtml = [];
                for (let i = 0; i < endRender; i++) {
                    // 此时 isContextMode 已经是 false，createSlideHtml 会正确渲染左上角按钮
                    slidesHtml.push(`<div class="swiper-slide">${this.renderer.createSlideHtml(this.fullPlaylist[i], i)}</div>`);
                }

                document.getElementById('video-list').innerHTML = slidesHtml.join('');
                this.renderedCount = endRender;

                // 3. (原代码这里的重置逻辑已移到最上面)

                // 4. 重新初始化 Swiper
                this.initSwiper();

                // 5. 无动画跳转到之前的视频
                this.mainSwiper.slideTo(targetIndex, 0);

                if (prevFeedMode === 'double') {
                    this.switchFeedMode('double', { skipAutoPlay: true });
                } else if (prevFeedMode === 'recommend') {
                    this.switchFeedMode('recommend', { skipAutoPlay: true });
                } else {
                    this.switchFeedMode('single', { skipAutoPlay: true });
                }

                // 6. 恢复播放进度
                const activeSlide = this.mainSwiper.slides[targetIndex];
                if (prevFeedMode === 'single' && activeSlide) {
                    const video = activeSlide.querySelector('video');
                    if (video) {
                        video.currentTime = savedTime;
                        video.muted = this.mediaManager.isGlobalMuted;

                        if (shouldPlay) {
                            const playPromise = video.play();
                            if (playPromise !== undefined) playPromise.catch(() => { });
                            this.mediaManager.currentMedia = video;
                            this.mediaManager.updatePlayBtnState(true);
                        } else {
                            this.mediaManager.currentMedia = video;
                            this.mediaManager.updatePlayBtnState(false);
                        }
                    } else if (shouldPlay) {
                        this.mediaManager.play(activeSlide);
                    }
                }

                // 7. 清空备份
                this.homeFeedState = null;
            }

            switchFeedMode(mode = 'single', options = {}) {
                const swiperEl = document.querySelector('.mySwiper');
                const doubleView = document.getElementById('double-column-view');
                const recommendView = document.getElementById('recommend-view');
                if (!swiperEl || !doubleView || !recommendView) return;

                const { skipAutoPlay = false } = options;
                if (mode !== 'recommend') {
                    this.pauseAllRecommendSingleVideos();
                }

                document.body.classList.toggle('feed-mode-double', mode === 'double');
                document.body.classList.toggle('feed-mode-recommend', mode === 'recommend');

                const prevMode = this.feedMode;
                if (prevMode === 'recommend' && recommendView) {
                    this.feedScrollPositions.recommend = recommendView.scrollTop;
                }
                if (prevMode === 'double' && doubleView) {
                    this.feedScrollPositions.double = doubleView.scrollTop;
                }

                const showSingle = mode === 'single';
                swiperEl.style.visibility = showSingle ? 'visible' : 'hidden';
                swiperEl.style.display = showSingle ? '' : 'none';

                document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
                if (recommendView) recommendView.style.display = 'none';

                if (mode === 'double') {
                    this.feedMode = 'double';
                    this.mediaManager.stop();
                    doubleView.style.display = 'block';
                    document.querySelectorAll('#tab-double').forEach(t => t.classList.add('active'));
                    this.renderDoubleColumn(!this.doubleViewInitialized);
                    doubleView.scrollTop = this.feedScrollPositions.double || 0;
                    setTimeout(() => this.applyFeedReturnPosition(), 30);
                    return;
                }

                if (mode === 'recommend') {
                    this.feedMode = 'recommend';
                    this.mediaManager.stop();
                    doubleView.style.display = 'none';
                    recommendView.style.display = 'flex';
                    document.querySelectorAll('#tab-recommend').forEach(t => t.classList.add('active'));
                    this.renderRecommendView(!this.recommendViewInitialized);
                    recommendView.scrollTop = this.feedScrollPositions.recommend || 0;
                    setTimeout(() => this.applyFeedReturnPosition(), 30);
                    return;
                }

                this.feedMode = 'single';
                doubleView.style.display = 'none';
                document.querySelectorAll('#tab-single').forEach(t => t.classList.add('active'));

                if (!skipAutoPlay) {
                    setTimeout(() => {
                        if (!this.mainSwiper) return;
                        const activeSlide = this.mainSwiper.slides[this.mainSwiper.activeIndex];
                        if (activeSlide) {
                            this.mediaManager.play(activeSlide);
                        }
                    }, 120);
                }
                setTimeout(() => this.applyFeedReturnPosition(), 30);
            }

            renderDoubleColumn(isInitial = false) {
                const grid = document.getElementById('dc-grid-content');
                if (!grid) return;

                const needInit = isInitial || !this.doubleViewInitialized;

                if (needInit) {
                    grid.innerHTML = `
                        <div class="dc-column" id="dc-column-left"></div>
                        <div class="dc-column" id="dc-column-right"></div>
                    `;
                    this.dcRenderedCount = 0;
                    this.isLoadingMoreDc = false;
                    this.doubleViewInitialized = true;
                }

                const leftColumn = document.getElementById('dc-column-left');
                const rightColumn = document.getElementById('dc-column-right');
                if (!leftColumn || !rightColumn) return;

                if (this.isLoadingMoreDc) return;

                const works = Array.isArray(this.fullPlaylist) ? this.fullPlaylist : [];
                if (works.length === 0) {
                    grid.innerHTML = '<div class="dc-empty">暂无作品</div>';
                    return;
                }

                if (this.dcRenderedCount >= works.length) {
                    if (this.randomFeedMode && !this.randomFeedExhausted) {
                        this._loadMoreRandomWorks();
                    }
                    return;
                }

                this.isLoadingMoreDc = true;

                const start = this.dcRenderedCount;
                const end = Math.min(start + this.dcBatchSize, works.length);
                const batch = works.slice(start, end);

                const cardHtmls = batch.map((item, index) => this.buildDcCardMarkup(item, start + index));

                cardHtmls.forEach(cardHtml => {
                    const targetColumn = leftColumn.scrollHeight <= rightColumn.scrollHeight ? leftColumn : rightColumn;
                    targetColumn.insertAdjacentHTML('beforeend', cardHtml);
                });
                this.dcRenderedCount = end;
                this.isLoadingMoreDc = false;

                this.observeDoubleColumnCards();

                const view = document.getElementById('double-column-view');
                if (view && view.scrollHeight <= view.clientHeight + 100 && this.dcRenderedCount < works.length) {
                    this.renderDoubleColumn(false);
                }
            }

            renderRecommendView(isInitial = false) {
                const view = document.getElementById('recommend-view');
                const blockContainer = document.getElementById('recommend-blocks-container');
                if (!view || !blockContainer) return;

                const works = Array.isArray(this.fullPlaylist) ? this.fullPlaylist : [];
                if (works.length === 0) {
                    blockContainer.innerHTML = '<div class="dc-empty">暂无推荐内容</div>';
                    return;
                }

                const needInit = isInitial || !this.recommendViewInitialized;
                if (needInit) {
                    blockContainer.innerHTML = '';
                    this.recommendRenderedCount = 0;
                    this.isLoadingMoreRecommend = false;
                    this.appendRecommendBatch();
                    this.recommendViewInitialized = true;
                }
                this.observeDoubleColumnCards('recommend-view');
            }

            appendRecommendBatch() {
                const view = document.getElementById('recommend-view');
                const blockContainer = document.getElementById('recommend-blocks-container');
                if (!view || !blockContainer) return;
                if (this.isLoadingMoreRecommend) return;

                const works = Array.isArray(this.fullPlaylist) ? this.fullPlaylist : [];
                if (works.length === 0) {
                    blockContainer.innerHTML = '<div class="dc-empty">暂无推荐内容</div>';
                    return;
                }
                if (this.recommendRenderedCount >= works.length) return;

                this.isLoadingMoreRecommend = true;
                const blockSize = 7;
                const start = this.recommendRenderedCount;
                const end = Math.min(start + blockSize, works.length);
                const batch = works.slice(start, end);

                if (batch.length === 0) {
                    this.isLoadingMoreRecommend = false;
                    return;
                }

                const blockHtml = this.buildRecommendBlocks(batch.map((work, idx) => ({ work, idx: start + idx })), start);
                blockContainer.insertAdjacentHTML('beforeend', blockHtml);

                this.recommendRenderedCount = end;
                this.isLoadingMoreRecommend = false;

                this.observeDoubleColumnCards('recommend-view');
                this.observeRecommendSingleVideos();

                if (blockContainer.scrollHeight <= view.clientHeight + 120 && this.recommendRenderedCount < works.length) {
                    this.appendRecommendBatch();
                }
            }
            buildRecommendBlocks(batch, offset = 0) {
                if (!batch || batch.length === 0) return '';

                const singleIndex = batch.findIndex(entry => entry.work.type === '视频');
                let singleEntry;
                if (singleIndex >= 0) {
                    singleEntry = batch.splice(singleIndex, 1)[0];
                } else {
                    singleEntry = batch.shift();
                }
                if (!singleEntry || !singleEntry.work) return '';
                const singleMarkup = this.buildDcCardMarkup(singleEntry.work, singleEntry.idx, 'recommend-single-card');

                const doubleEntries = batch.slice(0, 12);
                const rows = [];
                for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
                    const start = rowIndex * 2;
                    const rowItems = doubleEntries.slice(start, start + 2);
                    if (rowItems.length === 0) break;
                    const rowFragments = rowItems.map(entry => this.buildDcCardMarkup(entry.work, entry.idx, 'recommend-double-card'));
                    if (rowFragments.length > 0) {
                        rows.push(`<div class="recommend-double-row">${rowFragments.join('')}</div>`);
                    }
                }

                return `
                    <div class="recommend-block">
                        <div class="recommend-single-card-wrapper">${singleMarkup}</div>
                        ${rows.join('')}
                    </div>
                `;
            }
            observeDoubleColumnCards(rootId = 'double-column-view') {
                const view = document.getElementById(rootId);
                if (!view || typeof IntersectionObserver === 'undefined') return;
                if (!this.dcLazyObservers) this.dcLazyObservers = {};
                let observer = this.dcLazyObservers[rootId];
                if (!observer) {
                    observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (!entry.isIntersecting) return;
                            const card = entry.target;
                            observer.unobserve(card);
                            this.loadDoubleColumnCardPreview(card);
                        });
                    }, { root: view, rootMargin: '400px 0px 400px 0px', threshold: 0.1 });
                    this.dcLazyObservers[rootId] = observer;
                }
                view.querySelectorAll('.dc-card').forEach(card => {
                    if (card.dataset.dcObservedRoot === rootId) return;
                    card.dataset.dcObservedRoot = rootId;
                    observer.observe(card);
                });
            }
            observeRecommendSingleVideos() {
                const view = document.getElementById('recommend-view');
                if (!view || typeof IntersectionObserver === 'undefined') return;
                if (!this.recommendSingleObserver) {
                    this.recommendSingleObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            const wrapper = entry.target;
                            if (!wrapper || entry.isIntersecting) return;
                            const video = wrapper.querySelector('.recommend-single-video');
                            this.pauseRecommendSingleVideo(video, wrapper);
                        });
                    }, { root: view, threshold: 0.01 });
                }
                view.querySelectorAll('.recommend-single-video-wrapper').forEach(wrapper => {
                    if (wrapper.dataset.recommendObserved === '1') return;
                    wrapper.dataset.recommendObserved = '1';
                    this.captureRecommendSinglePoster(wrapper);
                    this.recommendSingleObserver.observe(wrapper);
                });
            }
            pauseRecommendSingleVideo(video, wrapper) {
                if (!video) return;
                if (!video.paused) {
                    try {
                        video.pause();
                    } catch (err) { /* ignore */ }
                }
                if (wrapper) wrapper.classList.remove('playing');
                try {
                    video.currentTime = 0;
                } catch (err) {
                    /* silent */
                }
            }
            pauseAllRecommendSingleVideos() {
                document.querySelectorAll('.recommend-single-video-wrapper').forEach(wrapper => {
                    const video = wrapper.querySelector('.recommend-single-video');
                    if (video) {
                        try {
                            video.pause();
                        } catch (err) { /* ignore */ }
                        try {
                            video.currentTime = 0;
                        } catch (err) { /* ignore */ }
                    }
                    wrapper.classList.remove('playing');
                });
            }

            captureRecommendSinglePoster(wrapper) {
                if (!wrapper) return;
                if (wrapper.dataset.recommendPosterCaptured === '1') return;
                const videoEl = wrapper.querySelector('.recommend-single-video');
                if (!videoEl) return;
                const src = videoEl.dataset.src;
                if (!src) return;

                wrapper.dataset.recommendPosterCaptured = '1';
                const tempVideo = document.createElement('video');
                tempVideo.crossOrigin = 'anonymous';
                tempVideo.playsInline = true;
                tempVideo.muted = true;
                tempVideo.preload = 'metadata';
                tempVideo.style.position = 'fixed';
                tempVideo.style.left = '-9999px';
                tempVideo.style.width = '1px';
                tempVideo.style.height = '1px';

                const cleanup = () => {
                    tempVideo.removeAttribute('src');
                    tempVideo.load();
                    if (tempVideo.parentElement) tempVideo.parentElement.removeChild(tempVideo);
                };

                const captureFrame = () => {
                    try {
                        const width = tempVideo.videoWidth || 320;
                        const height = tempVideo.videoHeight || Math.max(180, Math.round(width * 9 / 16));
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                        if (dataUrl) {
                            videoEl.setAttribute('poster', dataUrl);
                        }
                    } catch (error) {
                        console.warn('Recommend single frame capture failed', error);
                    } finally {
                        cleanup();
                    }
                };

                tempVideo.addEventListener('loadedmetadata', () => {
                    const duration = tempVideo.duration || 0.1;
                    const maxSeek = duration > 0 ? Math.max(duration - 0.01, 0.05) : 0.05;
                    const seekTo = duration > 0 ? Math.min(Math.max(duration * 0.05, 0.05), maxSeek) : 0.05;
                    tempVideo.currentTime = seekTo;
                }, { once: true });
                tempVideo.addEventListener('seeked', captureFrame, { once: true });
                tempVideo.addEventListener('error', cleanup, { once: true });
                document.body.appendChild(tempVideo);
                tempVideo.src = src;
                tempVideo.load();
            }
            captureSlidePoster(video) {
                if (!video) return;
                if (video.dataset.posterCaptured === '1') return;
                video.dataset.posterCaptured = '1';

                const captureFrame = () => {
                    try {
                        const width = video.videoWidth || 320;
                        const height = video.videoHeight || Math.max(180, Math.round(width * 9 / 16));
                        if (width <= 0 || height <= 0) return;
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                        if (dataUrl) {
                            video.setAttribute('poster', dataUrl);
                        }
                    } catch (error) {
                        console.warn('Slide poster capture failed', error);
                    }
                };

                if (video.readyState >= 2) {
                    captureFrame();
                } else {
                    video.addEventListener('loadeddata', captureFrame, { once: true });
                    video.addEventListener('error', () => { /* ignore */ }, { once: true });
                }
            }
            loadDoubleColumnCardPreview(card) {
                if (!card || card.dataset.dcPreviewed) return;
                card.dataset.dcPreviewed = '1';
                const videoSrc = card.dataset.videoSrc;
                if (!videoSrc) return;
                const thumbImg = card.querySelector('.dc-thumb img');
                const labelEl = card.querySelector('.dc-overlay-meta');
                const video = document.createElement('video');
                video.crossOrigin = 'anonymous';
                video.playsInline = true;
                video.muted = true;
                video.preload = 'metadata';

                const cleanup = () => {
                    video.removeAttribute('src');
                    video.load();
                    if (video.parentElement) video.parentElement.removeChild(video);
                };

                const updateDuration = () => {
                    const duration = video.duration;
                    if (labelEl && duration && isFinite(duration) && duration > 0 && window.app && window.app.mediaManager) {
                        labelEl.textContent = window.app.mediaManager.formatTime(duration);
                    }
                    const maxSeek = duration > 0 ? Math.max(duration - 0.01, 0.05) : 0.05;
                    const seekTo = duration > 0 ? Math.min(Math.max(duration * 0.05, 0.05), maxSeek) : 0.05;
                    video.currentTime = seekTo;
                };

                const captureFrame = () => {
                    try {
                        const width = video.videoWidth || 320;
                        const height = video.videoHeight || Math.max(180, Math.round(width * 9 / 16));
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                        if (thumbImg && dataUrl) {
                            thumbImg.src = dataUrl;
                        }
                    } catch (error) {
                        console.warn('Double-column frame capture failed', error);
                    } finally {
                        cleanup();
                    }
                };

                video.addEventListener('loadedmetadata', () => {
                    updateDuration();
                    video.addEventListener('seeked', captureFrame, { once: true });
                }, { once: true });
                video.addEventListener('error', cleanup, { once: true });
                document.body.appendChild(video);
                video.src = videoSrc;
            }

            playFromDoubleColumn(index) {
                const targetIndex = Number(index);
                if (!isFinite(targetIndex) || targetIndex < 0 || !Array.isArray(this.fullPlaylist) || targetIndex >= this.fullPlaylist.length) {
                    return;
                }

                const playlistSnapshot = [...this.fullPlaylist];
                this.enterContextPlay(playlistSnapshot, targetIndex);
            }

            toggleRecommendSingleVideo(event, videoEl) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                if (!videoEl) return;
                const src = videoEl.dataset.src;
                if (!videoEl.src && src) {
                    videoEl.src = src;
                }
                const wrapper = videoEl.closest('.recommend-single-video-wrapper');
                if (videoEl.paused) {
                    if (wrapper) wrapper.classList.add('playing');
                    const playPromise = videoEl.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(() => {
                            if (wrapper) wrapper.classList.remove('playing');
                        });
                    }
                } else {
                    videoEl.pause();
                    videoEl.currentTime = 0;
                    if (wrapper) wrapper.classList.remove('playing');
                }
            }

            toggleRecommendSingleMute(event, button) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                if (!button) return;
                const wrapper = button.closest('.recommend-single-video-wrapper');
                const videoEl = wrapper ? wrapper.querySelector('.recommend-single-video') : null;
                if (!videoEl) return;
                const muted = !videoEl.muted;
                videoEl.muted = muted;
                button.dataset.muted = muted ? 'true' : 'false';
                const icon = button.querySelector('i');
                if (icon) {
                    icon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
                }
            }

            buildDcCardMarkup(item, globalIndex, extraClass = '') {
                const coverSource = item.cover || (Array.isArray(item.images) ? item.images[0] : '');
                const isValidCoverUrl = (value) => {
                    if (!value || typeof value !== 'string') return false;
                    const trimmed = value.trim();
                    if (!trimmed) return false;
                    if (trimmed === 'null' || trimmed === 'undefined') return false;
                    if (trimmed.includes('${')) return false;
                    return /^https?:\/\//i.test(trimmed);
                };
                const cover = isValidCoverUrl(coverSource) ? coverSource : getDiceBearAvatar(item.author);
                const authorName = item.author || '神秘作者';
                const authorAvatar = getUnifiedAuthorAvatar(item, authorName);

                const likeText = this.renderer.formatNumber(item.like);
                const imageCount = Array.isArray(item.images) ? item.images.length : (item.images ? 1 : 0);
                let mediaLabel = item.type || '作品';
                if (item.type === '图集') {
                    mediaLabel = `${imageCount}张`;
                } else if (item.type === '视频') {
                    let durationSeconds = null;
                    const rawDuration = item.duration;
                    if (typeof rawDuration === 'number' && isFinite(rawDuration) && rawDuration > 0) {
                        durationSeconds = rawDuration;
                    } else if (typeof rawDuration === 'string') {
                        if (rawDuration.includes(':')) {
                            const parts = rawDuration.split(':').map(part => Number(part));
                            if (parts.every(part => !isNaN(part))) {
                                if (parts.length === 2) {
                                    durationSeconds = parts[0] * 60 + (parts[1] || 0);
                                } else if (parts.length === 3) {
                                    durationSeconds = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
                                }
                            }
                        } else {
                            const numericDuration = Number(rawDuration);
                            if (!Number.isNaN(numericDuration) && numericDuration > 0) {
                                durationSeconds = numericDuration;
                            }
                        }
                        if ((!durationSeconds || durationSeconds <= 0) && this.renderer && typeof this.renderer.parseDurationStr === 'function') {
                            durationSeconds = this.renderer.parseDurationStr(rawDuration);
                        }
                    }

                    if (durationSeconds && isFinite(durationSeconds) && durationSeconds > 0) {
                        mediaLabel = this.mediaManager.formatTime(durationSeconds);
                    } else {
                        mediaLabel = '视频';
                    }
                }

                const isRecommendSingle = extraClass && extraClass.includes('recommend-single-card');
                const isRecommendCard = Boolean(extraClass && extraClass.includes('recommend'));
                const titleSectionHtml = buildTitleSectionHtml(item, {
                    showReleaseTimeTag: !isRecommendSingle,
                    enableToggle: !isRecommendCard
                });
                const safeAuthorName = authorName.replace(/'/g, "\\'");
                const dataMediaType = item.type || '未知';
                const dataVideoSrc = item.type === '视频' ? (item.url || '') : '';
                const classNames = ['dc-card', extraClass].filter(Boolean).join(' ');
                const titleClassNames = ['dc-title'];
                if (isRecommendCard) titleClassNames.push('recommend-title-clickable');
                const titleClickAttr = isRecommendCard ? ` onclick="app.playFromDoubleColumn(${globalIndex})"` : '';

                const thumbInner = isRecommendSingle
                    ? `
                        <div class="recommend-single-video-wrapper" onclick="app.toggleRecommendSingleVideo(event, this.querySelector('.recommend-single-video'));">
                            <video class="recommend-single-video" data-src="${dataVideoSrc}" poster="${cover}" preload="none" playsinline muted loop onclick="app.toggleRecommendSingleVideo(event, this)"></video>
                            <div class="recommend-single-video-playpad"
                                onclick="app.toggleRecommendSingleVideo(event, this.previousElementSibling)">
                                <i class="fa-solid fa-circle-play"></i>
                            </div>
                            <button class="recommend-single-mute-btn" data-muted="true" onclick="app.toggleRecommendSingleMute(event, this)">
                                <i class="fa-solid fa-volume-xmark"></i>
                            </button>
                            <button class="recommend-single-detail-btn"
                                onclick="event.stopPropagation(); app.playFromDoubleColumn(${globalIndex});">
                                <i class="fa-solid fa-expand"></i>
                            </button>
                        </div>
                    `
                    : `<img src="${cover}" loading="lazy" alt="封面">`;

                return `
                    <div class="${classNames}" data-media-type="${dataMediaType}" data-video-src="${dataVideoSrc}" data-global-index="${globalIndex}">
                        <div class="dc-thumb" onclick="app.playFromDoubleColumn(${globalIndex})">
                            ${thumbInner}
                            <div class="dc-overlay">
                                <span><i class="fa-solid fa-heart"></i> ${likeText}</span>
                                <span class="dc-overlay-meta">${mediaLabel}</span>
                            </div>
                        </div>
                        <div class="dc-info">
                            <div class="${titleClassNames.join(' ')}"${titleClickAttr}>${titleSectionHtml}</div>
                            <div class="dc-meta">
                                <div class="dc-author" onclick="event.stopPropagation(); app.openProfile('${safeAuthorName}')">
                                    <img src="${authorAvatar}" alt="${authorName}">
                                    <span>${authorName}</span>
                                </div>
                                ${isRecommendSingle ? `<span class="recommend-single-release-time">${getReleaseTimeText(item)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }


        }
