/* v3 semantic split: script from js/app/00-config-helpers.js | keep script order */
/* Extracted from index100.html. Legacy public API preserved for UI/function parity. */
// --- 核心配置 ---
        const CONFIG = {
            // 播放
            AUTO_NEXT_VIDEO: false,   // 自动连播
            DEFAULT_MUTED: false,     // 默认不静音
            DEFAULT_SPEED: 1.0,       // 默认倍速
            GALLERY_AUTOPLAY_DELAY: 2000, // 图集轮播间隔 (-1 为关闭)
            MUTE_ON_PAGE_OPEN: true,   // 打开其他页面时主页静音 (默认开启)
            PAUSE_ON_PAGE_OPEN: false, // 打开其他页面时暂停播放 (默认关闭)
            RANDOM_AUTHOR_WINDOW: 14,  // 混合推荐作者窗口

            // 交互
            HAPTIC_FEEDBACK: true,    // 震动反馈
            CLICK_TO_TOGGLE: true,    // 单击暂停
            // 视觉
            ENABLE_GLASS: true,       // 开启毛玻璃效果

            // 下载
            DL_RENAME_FILE: true,     // 下载重命名 (使用标题+作者)
            ZIP_STRUCTURE: 'simple', // simple | author | date

            // 性能
            BATCH_SIZE: 5,            // 视频流每次加载数量
            PRELOAD_OFFSET: 3,        // 预加载偏移
            UNLOAD_DISTANCE: 3,       // 卸载距离

            // 内部参数
            GALLERY_INIT_LIMIT: 3,

            // --- 【这里是修复的关键代码】 ---
            GALLERY_BATCH_SIZE: 3,    // 图集分批加载：每次多加载3张
            GALLERY_BATCH_INTERVAL: 500, // 图集分批加载：每隔500毫秒加载一批
            // ---------------------------
            // --- 新增：自动清理配置 ---
            AUTO_CLEAN_CACHE: true,       // 开关：是否启用自动清理
            CACHE_EXPIRY_DAYS: 7,         // 资源缓存过期天数 (默认7天)
            LOG_EXPIRY_DAYS: 3,           // 日志保留天数

            // 接口管理 (外部解析/数据格式适配)
            API_SDK_BASE: Api.config.SDK.BASE,
            API_SDK_KEY: Api.config.SDK.KEY,
            API_SDK_PROFILE_PATH: 'douyin_zhuye/',
            API_SDK_SEARCH_PATH: 'douyin_search/',
            API_SDK_VIDEO_PATH: 'douyin_video/',
            API_SDK_KEY_PARAM: 'key',
            API_SDK_URL_PARAM: 'url',
            API_SDK_SEARCH_PARAM: 'msg',
            API_SDK_TYPE_PARAM: 'type',
            API_LIST_PATH: 'data',
            API_NEXT_PATH: 'next_url',
            API_ITEM_DATA_PATH: 'data',
            API_FIELD_MAP: {
                author: 'author|nickname',
                avatar: 'author_avatar|author_avatar_proxy|author_avatar_download|avatar',
                title: 'desc|title',
                id: 'aweme_id|id',
                like: 'digg_count|like',
                comment: 'comment_count|comment',
                share: 'share_count|share',
                collect: 'collect_count|collect',
                play: 'play_count|play',
                time: 'create_time|time',
                type: 'type',
                video_url: 'video|video_proxy|download_url|video_url|play_addr',
                cover: 'cover|cover_proxy|pic',
                images: 'images|images_proxy',
                music_title: 'music_title|music_info.title',
                music_author: 'music_author|music_info.author',
                music_url: 'music_url|music_proxy|music_download|music_info.url',
                sec_uid: 'author_sec_uid|sec_uid',
                author_uid: 'author_uid',
                share_url: 'share_url',
                download_urls: 'download_urls',
                duration: 'duration',
                hashtags: 'hashtags'
            },

            VIDEO_RETRY_MAX: 3,
            PROFILE_BATCH: 12,
            // --- 本地资源扫描与混合播放 ---
            LOCAL_SCAN_PATHS: '',          // 扫描目录（留空=默认全盘）
            LOCAL_SCAN_LAST_DIR: '',       // 最近一次选择的扫描目录
            LOCAL_MIN_VIDEO_MB: 2,         // 视频最小大小（MB）
            LOCAL_MIN_MUSIC_MB: 0.5,       // 音乐最小大小（MB）
            LOCAL_MIX_ENABLED: true,       // 本地资源是否加入混合播放
            LOCAL_MUSIC_SLIDE_STYLE: '1'   // 本地音乐 Slide 样式：1/2/3
        };

        const LOCAL_MEDIA_CONFIG = {
            video: { name: '本地视频', icon: 'fa-video', color: '#4cc3ff' },
            music: { name: '本地音乐', icon: 'fa-music', color: '#ff7ad8' }
        };

        // v4: expose configuration and safe text helpers explicitly.
        // `const CONFIG` is readable by later classic scripts, but it is not
        // automatically available as `window.CONFIG`; services/api.js reads
        // from window.CONFIG, so keep both references aligned.
        window.CONFIG = CONFIG;
        window.LOCAL_MEDIA_CONFIG = LOCAL_MEDIA_CONFIG;

        function escapeHTML(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function escapeAttr(value) {
            return escapeHTML(value);
        }

        function jsStringArg(value) {
            return escapeAttr(JSON.stringify(String(value ?? '')));
        }

        window.escapeHTML = escapeHTML;
        window.escapeAttr = escapeAttr;
        window.jsStringArg = jsStringArg;

        function getValueByPath(obj, path) {
            if (!obj || !path) return undefined;
            const candidates = Array.isArray(path) ? path : String(path).split('|');
            for (const raw of candidates) {
                const candidate = String(raw || '').trim();
                if (!candidate) continue;
                const parts = candidate.replace(/\[(\d+)\]/g, '.$1').split('.');
                let cur = obj;
                let ok = true;
                for (const part of parts) {
                    if (!part) continue;
                    if (cur && Object.prototype.hasOwnProperty.call(cur, part)) {
                        cur = cur[part];
                    } else {
                        ok = false;
                        break;
                    }
                }
                if (ok && cur !== undefined && cur !== null) return cur;
            }
            return undefined;
        }

        function getMappedValue(obj, map, key, fallback) {
            const path = map ? map[key] : null;
            const val = getValueByPath(obj, path);
            if (val !== undefined && val !== null && val !== '') return val;
            return fallback;
        }


        // v5: shared lightweight utilities for deduplicating repeated view/data logic.
        function formatDuration(seconds) {
            if (!seconds || isNaN(seconds)) return "00:00";
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        function formatMonthDayTime(ts) {
            const date = new Date(ts);
            return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        }

        function formatRelativeTime(timestamp) {
            if (!timestamp) return '';
            const raw = Number(timestamp);
            const time = raw > 10000000000 ? raw : raw * 1000;
            const date = new Date(time);
            const diff = Date.now() - date.getTime();
            const minute = 60 * 1000;
            const hour = 60 * minute;
            const day = 24 * hour;
            const month = 30 * day;
            const year = 365 * day;
            if (diff < minute) return '刚刚';
            if (diff < hour) return Math.floor(diff / minute) + '分钟前';
            if (diff < day) return Math.floor(diff / hour) + '小时前';
            if (diff < month) return Math.floor(diff / day) + '天前';
            if (diff < year) return Math.floor(diff / month) + '个月前';
            return Math.floor(diff / year) + '年前';
        }

        async function readJsonFileFromInput(input) {
            const file = input?.files?.[0];
            if (!file) return null;
            try {
                const text = typeof file.text === 'function'
                    ? await file.text()
                    : await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsText(file);
                    });
                return { file, data: JSON.parse(text) };
            } finally {
                input.value = '';
            }
        }

        function setActiveButton(selectorOrNodes, activeButton) {
            const nodes = typeof selectorOrNodes === 'string'
                ? document.querySelectorAll(selectorOrNodes)
                : selectorOrNodes;
            if (!nodes) return;
            nodes.forEach((btn) => btn.classList.remove('active'));
            if (activeButton) activeButton.classList.add('active');
        }

        function getWorkCover(work, fallbackSeed = 'Guest') {
            const w = work || {};
            let cover = w.cover || '';
            if (!cover && w.images && w.images.length > 0) {
                cover = Array.isArray(w.images[0]) ? w.images[0][0] : w.images[0];
            }
            return cover || getDiceBearAvatar(w.author || fallbackSeed || 'Guest');
        }

        function getAuthorAvatar(work, fallbackSeed = 'Guest', fallbackAvatar = '') {
            const w = work || {};
            const authorName = w.author || fallbackSeed || 'Guest';
            const isLocalWork = !!(w.is_local || w.local_type || String(w.id || '').includes('local-'));
            return isLocalWork ? getDiceBearAvatar(authorName) : (w.avatar || fallbackAvatar || getDiceBearAvatar(authorName));
        }

        function getWorkLikeView(work, options = {}) {
            const w = work || {};
            const allowLiked = options.allowLiked !== false;
            const isLiked = allowLiked && window.app && app.userDataManager ? app.userDataManager.isLiked(w) : false;
            const baseClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            const likedClass = options.likedClass === false ? baseClass : (isLiked ? `${baseClass} liked` : baseClass);
            const formatter = window.app && app.renderer && app.renderer.formatNumber ? app.renderer.formatNumber.bind(app.renderer) : (n) => String(n ?? 0);
            return {
                isLiked,
                heartClass: options.includeLikedClass === false ? baseClass : likedClass,
                heartColor: isLiked ? '#ff4d4f' : '#fff',
                likeCount: formatter(w.like),
                commentCount: formatter(w.comment)
            };
        }

        function renderDownloadHistoryItem(d, options = {}) {
            const icons = { video: 'fa-video', image: 'fa-image', music: 'fa-music', zip: 'fa-file-zipper' };
            const colors = { video: 'download-type-video', image: 'download-type-image', music: 'download-type-music', zip: 'download-type-zip' };
            const rowClick = options.rowClick ? ` onclick="${escapeAttr(options.rowClick)}"` : '';
            const actionClick = options.actionClick ? ` onclick="${escapeAttr(options.actionClick)}"` : '';
            const actionIcon = options.actionIcon || 'fa-check';
            const timeText = window.app && app.userDataManager ? app.userDataManager.formatTime(d.time) : formatMonthDayTime(d.time);
            return `<div class="my-list-item"${rowClick}>
                        <div class="download-item-icon ${colors[d.type] || ''}"><i class="fa-solid ${icons[d.type] || 'fa-file'}"></i></div>
                        <div class="item-info">
                            <div class="item-title">${escapeHTML(d.name || '')}</div>
                            <div class="dl-time">${escapeHTML(timeText)}</div>
                        </div>
                        <div class="item-action-btn"${actionClick}>
                            <i class="fa-solid ${actionIcon}"></i>
                        </div>
                    </div>`;
        }

        function renderWorkGridItem(work, index, options = {}) {
            const w = work || {};
            const cover = getWorkCover(w, options.fallbackSeed || 'Guest');
            const likeView = getWorkLikeView(w, { includeLikedClass: false });
            const clickAction = options.clickAction || '';
            const removeAction = options.removeAction || '';
            const removeHtml = removeAction ? `
                <div class="fav-remove-btn" onclick="${escapeAttr(removeAction)}">
                    <i class="fa-solid fa-xmark"></i>
                </div>` : '';
            const topBadge = options.showTopBadge && w.isTop ? `<div class="top-badge-pin">置顶</div>` : '';
            return `<div class="work-item" onclick="${escapeAttr(clickAction)}">
                ${topBadge}
                <div class="work-type-badge">${escapeHTML(w.type || options.typeFallback || '视频')}</div>
                <img src="${escapeAttr(cover)}" loading="lazy" style="background:#222">
                <div class="work-stats-overlay">
                    <i class="${likeView.heartClass}" style="color: ${likeView.heartColor};"></i>
                    <span>${escapeHTML(likeView.likeCount)}</span>
                </div>${removeHtml}
            </div>`;
        }

        function renderUniWorkListItem(work, index, options = {}) {
            const w = work || {};
            const authorName = w.author || options.fallbackAuthor || '未知用户';
            const cover = getWorkCover(w, authorName || 'Guest');
            const avatar = getAuthorAvatar(w, authorName || 'Guest', options.fallbackAvatar || '');
            const likeView = getWorkLikeView(w, { allowLiked: options.allowLiked !== false });
            const musicTitle = w.music_info?.title || '原声';
            const musicAuthor = w.music_info?.author || '未知';
            const typeBadge = w.type || options.typeFallback || '视频';
            const title = w.title || '';
            const timeText = w.create_time || w.time || '';
            const itemStyle = options.itemStyle ? ` style="${escapeAttr(options.itemStyle)}"` : '';
            const infoStyle = options.infoStyle ? ` style="${escapeAttr(options.infoStyle)}"` : '';
            const topBadge = options.showTopBadge && w.isTop
                ? `<div class="top-badge-pin"${options.topBadgeStyle ? ` style="${escapeAttr(options.topBadgeStyle)}"` : ''}>置顶</div>`
                : '';
            const timeHtml = timeText
                ? `<div class="${escapeAttr(options.timeClass || 'uni-stat-item')}"><i class="fa-regular fa-clock"${options.timeIconStyle ? ` style="${escapeAttr(options.timeIconStyle)}"` : ''}></i> ${escapeHTML(timeText)}</div>`
                : '';
            const actionHtml = options.deleteAction ? `
            <div class="item-action-btn"
                 style="position: absolute; top: 10px; right: 10px; color:#ff4d4f; width:32px; height:32px; display:flex; justify-content:center; align-items:center; border-radius:8px; cursor:pointer; z-index: 2;"
                 onclick="${escapeAttr(options.deleteAction)}"
                 title="删除此作品">
                <i class="fa-solid fa-trash-can" style="font-size: 14px;"></i>
            </div>` : '';
            return `<div class="uni-list-item"${itemStyle} onclick="${escapeAttr(options.clickAction || '')}">
            <div class="uni-thumb">
                ${topBadge}
                <img src="${escapeAttr(cover)}" loading="lazy">
                <div class="uni-type-badge">${escapeHTML(typeBadge)}</div>
            </div>
            <div class="uni-info"${infoStyle}>
                <div class="uni-title">${escapeHTML(title)}</div>
                <div class="uni-meta-row music"><i class="fa-solid fa-music"></i><span>${escapeHTML(musicTitle)} - ${escapeHTML(musicAuthor)}</span></div>
                <div class="uni-meta-row author">
                    <img src="${escapeAttr(avatar)}" class="uni-avatar-xs" onerror="this.src='${escapeAttr(getDiceBearAvatar(authorName || 'Guest'))}'">
                    <span>${escapeHTML(authorName)}</span>
                </div>
                <div class="uni-stats-row">
                    <div class="uni-stat-item"><i class="${likeView.heartClass}"></i><span>${escapeHTML(likeView.likeCount)}</span></div>
                    <div class="uni-stat-item"><i class="fa-regular fa-comment"></i><span>${escapeHTML(likeView.commentCount)}</span></div>
                    ${timeHtml}
                </div>
            </div>${actionHtml}
        </div>`;
        }

        window.formatDuration = formatDuration;
        window.formatMonthDayTime = formatMonthDayTime;
        window.formatRelativeTime = formatRelativeTime;
        window.readJsonFileFromInput = readJsonFileFromInput;
        window.setActiveButton = setActiveButton;
        window.getWorkCover = getWorkCover;
        window.getAuthorAvatar = getAuthorAvatar;
        window.getWorkLikeView = getWorkLikeView;
        window.renderDownloadHistoryItem = renderDownloadHistoryItem;
        window.renderWorkGridItem = renderWorkGridItem;
        window.renderUniWorkListItem = renderUniWorkListItem;
        const DEFAULT_VIDEO_WORK = {
            id: "default-video-01",
            title: "默认演示视频：Big Buck Bunny",
            author: "系统资源",
            type: "视频",
            like: 1320,
            comment: 68,
            width: 640,
            height: 360,
            music_info: {
                title: "环游节拍",
                author: "System",
                url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
            },
            url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny_640x360.mp4",
            cover: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg"
        };
        const FALLBACK_CREATOR = {
            info: {
                name: "如画",
                avatar: "https://p3-pc.douyinpic.com/aweme/100x100/aweme-avatar/douyin-user-image-file_84bfdc93f661072b631830a753558c23.jpeg?from=327834062"
            },
            works: [
                DEFAULT_VIDEO_WORK,
                {
                    "id": "7395166858212543770",
                    "title": "中式美学的构图之美 #古韵江南 #东方美学#万物皆可种草搜",
                    "author": "如画",
                    "type": "视频",
                    "like": 3630700,
                    "comment": 89722,
                    "width": 640,
                    "height": 360,
                    "music_info": {
                        "title": "@导演邹灿创作的原声",
                        "author": "导演邹灿",
                        "url": "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    "url": "https://www.douyin.com/aweme/v1/play/?video_id=v0200fg10000cqgegovog65gt725sfc0&line=0&file_id=3485da42003f45cc9791183db4341e28&sign=efadf80896aec967b643e54dba127811&is_play_url=1&source=PackSourceEnum_PUBLISH",
                    "cover": "https://p3-pc-sign.douyinpic.com/tos-cn-p-0015/osg4goDAPImDFCehsCfB90jAShPK6OAiAEAYYI~tplv-dy-360p.jpeg?lk3s=138a59ce&x-expires=1766055600&x-signature=UfvsHBXwBdSRMKVeGsfx9mq4ccA%3D&from=327834062&s=PackSourceEnum_PUBLISH&se=false&sc=origin_cover&biz_tag=pcweb_cover&l=2025120419252912452D18DF96040FE892"
                }
            ]
        };
        // --- 工具函数：生成随机头像 ---
        function getDiceBearAvatar(seed) {
            // 如果没有种子，生成一个随机的
            const safeSeed = seed || ('Guest_' + Math.floor(Math.random() * 1000));
            // 使用 avataaars 风格 (卡通人物)
            return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(safeSeed)}`;
        }

        function getUnifiedAuthorAvatar(work, fallbackName) {
            const authorName = fallbackName || (work && work.author) || 'Guest';
            const isLocal = (window.app && typeof app.isLocalWork === 'function') ? app.isLocalWork(work) : false;
            if (isLocal) return getDiceBearAvatar(authorName || 'Guest');
            let avatar = work && work.avatar;
            if (!avatar || avatar === 'null' || avatar.includes('${')) {
                const creator = (window.app && app.dataLoader && app.dataLoader.globalCreators)
                    ? app.dataLoader.globalCreators[authorName]
                    : null;
                if (creator && creator.info && creator.info.avatar) avatar = creator.info.avatar;
            }
            if (!avatar || avatar === 'null' || avatar.includes('${')) {
                avatar = getDiceBearAvatar(authorName || 'Guest');
            }
            return avatar;
        }

        // --- 0. 统一存储服务 (基于 localforage) ---
