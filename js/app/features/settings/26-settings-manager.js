/* v3 semantic split: class from js/app/08-settings-search-circle-page.js | keep script order */
        class SettingsManager {
            constructor() {
                // 默认配置
                this.defaultConfig = { ...CONFIG };
            }

            async init() {
                // 从 DB 读取配置并覆盖全局 CONFIG
                const saved = await StorageService.get('douxiuxiu_settings', null);
                if (saved) {
                    Object.assign(CONFIG, saved);
                }
                // 应用毛玻璃
                this.applyGlassEffect();
                this.applyApiConfig();
                if (window.app && typeof app.applyLocalMixSetting === 'function') {
                    app.applyLocalMixSetting(!!CONFIG.LOCAL_MIX_ENABLED);
                }
                if (window.app && typeof app.applyLocalMusicSlideStyle === 'function') {
                    app.applyLocalMusicSlideStyle(CONFIG.LOCAL_MUSIC_SLIDE_STYLE);
                }
                console.log("SettingsManager initialized (Async)");
            }

            async save() {
                await StorageService.set('douxiuxiu_settings', CONFIG);
            }

            update(key, value) {
                // 类型转换逻辑
                if (value === 'true') value = true;
                if (value === 'false') value = false;
                const numKeys = [
                    'DEFAULT_SPEED',
                    'GALLERY_AUTOPLAY_DELAY',
                    'PRELOAD_OFFSET',
                    'BATCH_SIZE',
                    'RANDOM_AUTHOR_WINDOW',
                    'LOCAL_MIN_VIDEO_MB',
                    'LOCAL_MIN_MUSIC_MB'
                ];
                if (numKeys.includes(key)) value = Number(value);

                if (key === 'API_FIELD_MAP') {
                    if (typeof value === 'string') {
                        if (!value.trim()) {
                            value = {};
                        } else {
                            try {
                                value = JSON.parse(value);
                            } catch (e) {
                                app.interaction.showToast('字段映射 JSON 格式错误');
                                return;
                            }
                        }
                    }
                }

                CONFIG[key] = value;
                this.save(); // 异步保存

                // 实时生效逻辑
                if (key === 'DEFAULT_SPEED') {
                    const video = document.querySelector('.swiper-slide-active video');
                    if (video) video.playbackRate = value;
                }
                if (key === 'ENABLE_GLASS') {
                    this.applyGlassEffect();
                }
                if (key.startsWith('API_')) {
                    this.applyApiConfig();
                }
                if (key === 'LOCAL_MIX_ENABLED' && window.app && typeof app.applyLocalMixSetting === 'function') {
                    app.applyLocalMixSetting(!!value);
                }
                if (key === 'LOCAL_MUSIC_SLIDE_STYLE' && window.app && typeof app.applyLocalMusicSlideStyle === 'function') {
                    app.applyLocalMusicSlideStyle(value);
                }
            }

            applyGlassEffect() {
                if (CONFIG.ENABLE_GLASS) document.body.classList.remove('no-glass');
                else document.body.classList.add('no-glass');
            }

            applyApiConfig() {
                if (!window.Api || !Api.config || !Api.config.SDK) return;
                const base = (CONFIG.API_SDK_BASE || '').trim();
                const key = (CONFIG.API_SDK_KEY || '').trim();
                if (base) Api.config.SDK.BASE = base;
                if (key) Api.config.SDK.KEY = key;
            }

            async importApiConfigFromUrl(url) {
                const target = (url || '').trim();
                if (!target) return app.interaction.showToast('请输入接口 JSON 地址');
                try {
                    const res = await fetch(target);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const code = await res.text();
                    this.importApiConfigFromJs(code);
                } catch (e) {
                    app.interaction.showToast(`获取失败: ${e.message}`);
                }
            }

            importApiConfigFromJs(code) {
                const raw = (code || '').trim();
                if (!raw) return app.interaction.showToast('请输入接口 JSON 配置');

                const parsed = this._parseApiConfigObject(raw);
                if (!parsed || typeof parsed !== 'object') {
                    return app.interaction.showToast('未识别到接口配置对象');
                }

                this._applyApiConfigObject(parsed);
                this.save();
                this.applyApiConfig();
                this.reflectToUI();
                app.interaction.showToast('接口配置已导入');
            }

            downloadApiConfigExample() {
                const example = "{\n  \"base\": \"https://sdkapi.hhlqilongzhu.cn/api\",\n  \"key\": \"Your_API_Key\",\n  \"profilePath\": \"douyin_zhuye/\",\n  \"searchPath\": \"douyin_search/\",\n  \"videoPath\": \"douyin_video/\",\n  \"params\": {\n    \"key\": \"key\",\n    \"url\": \"url\",\n    \"search\": \"msg\",\n    \"type\": \"type\"\n  },\n  \"paths\": {\n    \"list\": \"data\",\n    \"next\": \"next_url\",\n    \"itemData\": \"data\"\n  },\n  \"fieldMap\": {\n    \"author\": \"nickname|author\",\n    \"avatar\": \"avatar\",\n    \"title\": \"title|desc\",\n    \"id\": \"aweme_id|id\",\n    \"like\": \"like|digg_count\",\n    \"comment\": \"comment|comment_count\",\n    \"time\": \"time\",\n    \"type\": \"type\",\n    \"video_url\": \"video_url|play_addr\",\n    \"cover\": \"pic|cover\",\n    \"images\": \"images\",\n    \"images_info\": \"images_info.images\",\n    \"music_title\": \"music_info.title\",\n    \"music_author\": \"music_info.author\",\n    \"music_url\": \"music_info.url\",\n    \"sec_uid\": \"sec_uid\"\n  }\n}";

                const blob = new Blob([example], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'api-config.example.json';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            _parseApiConfigObject(code) {
                // v4 security: JSON only. Do not execute imported configuration.
                // Backward-compatible method name is preserved so existing buttons keep working.
                const raw = String(code || '').trim();
                if (!raw) return null;

                try {
                    return JSON.parse(raw);
                } catch (e) {
                    // Migration helper: when users paste the old JS example, extract the
                    // object literal only if it is strict JSON after removing the wrapper.
                    const match = raw.match(/(?:export\s+default|API_CONFIG\s*=|const\s+\w+\s*=|let\s+\w+\s*=)?\s*({[\s\S]*})\s*;?\s*$/);
                    if (!match) return null;
                    try {
                        return JSON.parse(match[1]);
                    } catch (err) {
                        return null;
                    }
                }
            }

            _applyApiConfigObject(obj) {
                const src = obj || {};
                const sdk = src.sdk || src.SDK || src;
                const params = src.params || src.PARAMS || sdk.params || {};
                const paths = src.paths || src.PATHS || sdk.paths || {};

                const setIf = (key, val) => {
                    if (val !== undefined && val !== null && val !== '') CONFIG[key] = val;
                };

                setIf('API_SDK_BASE', src.API_SDK_BASE || sdk.base || sdk.BASE);
                setIf('API_SDK_KEY', src.API_SDK_KEY || sdk.key || sdk.KEY);
                setIf('API_SDK_PROFILE_PATH', src.API_SDK_PROFILE_PATH || sdk.profilePath || sdk.profile_path);
                setIf('API_SDK_SEARCH_PATH', src.API_SDK_SEARCH_PATH || sdk.searchPath || sdk.search_path);
                setIf('API_SDK_VIDEO_PATH', src.API_SDK_VIDEO_PATH || sdk.videoPath || sdk.video_path);
                setIf('API_SDK_KEY_PARAM', src.API_SDK_KEY_PARAM || params.key || params.keyParam);
                setIf('API_SDK_URL_PARAM', src.API_SDK_URL_PARAM || params.url || params.urlParam);
                setIf('API_SDK_SEARCH_PARAM', src.API_SDK_SEARCH_PARAM || params.search || params.searchParam);
                setIf('API_SDK_TYPE_PARAM', src.API_SDK_TYPE_PARAM || params.type || params.typeParam);
                setIf('API_LIST_PATH', src.API_LIST_PATH || paths.list || paths.listPath);
                setIf('API_NEXT_PATH', src.API_NEXT_PATH || paths.next || paths.nextPath);
                setIf('API_ITEM_DATA_PATH', src.API_ITEM_DATA_PATH || paths.itemData || paths.itemDataPath);

                const fieldMap = src.API_FIELD_MAP || src.fieldMap || src.FIELD_MAP || src.field_map;
                if (fieldMap && typeof fieldMap === 'object') CONFIG.API_FIELD_MAP = fieldMap;
            }

            reflectToUI() {
                const map = {
                    'cfg-auto-next': 'AUTO_NEXT_VIDEO',
                    'cfg-muted': 'DEFAULT_MUTED',
                    'cfg-speed': 'DEFAULT_SPEED',
                    'cfg-gallery-delay': 'GALLERY_AUTOPLAY_DELAY',
                    'cfg-random-author-window': 'RANDOM_AUTHOR_WINDOW',
                    'cfg-haptic': 'HAPTIC_FEEDBACK',
                    'cfg-click-toggle': 'CLICK_TO_TOGGLE',
                    'cfg-preload': 'PRELOAD_OFFSET',
                    'cfg-batch': 'BATCH_SIZE',
                    'cfg-glass': 'ENABLE_GLASS',
                    'cfg-mute-on-layer': 'MUTE_ON_PAGE_OPEN',
                    'cfg-pause-on-layer': 'PAUSE_ON_PAGE_OPEN',
                    'cfg-auto-clean': 'AUTO_CLEAN_CACHE',
                    'cfg-api-base': 'API_SDK_BASE',
                    'cfg-api-key': 'API_SDK_KEY',
                    'cfg-api-profile-path': 'API_SDK_PROFILE_PATH',
                    'cfg-api-search-path': 'API_SDK_SEARCH_PATH',
                    'cfg-api-video-path': 'API_SDK_VIDEO_PATH',
                    'cfg-api-key-param': 'API_SDK_KEY_PARAM',
                    'cfg-api-url-param': 'API_SDK_URL_PARAM',
                    'cfg-api-search-param': 'API_SDK_SEARCH_PARAM',
                    'cfg-api-type-param': 'API_SDK_TYPE_PARAM',
                    'cfg-api-list-path': 'API_LIST_PATH',
                    'cfg-api-next-path': 'API_NEXT_PATH',
                    'cfg-api-item-path': 'API_ITEM_DATA_PATH',
                    'cfg-local-min-video': 'LOCAL_MIN_VIDEO_MB',
                    'cfg-local-min-music': 'LOCAL_MIN_MUSIC_MB',
                    'cfg-local-mix': 'LOCAL_MIX_ENABLED',
                    'cfg-local-music-style': 'LOCAL_MUSIC_SLIDE_STYLE'
                };

                for (const [id, key] of Object.entries(map)) {
                    const el = document.getElementById(id);
                    if (!el) continue;
                    const val = CONFIG[key];
                    if (el.type === 'checkbox') el.checked = !!val;
                    else {
                        if (id === 'cfg-speed' && Number(val) === 1) el.value = "1.0";
                        else el.value = val;
                    }
                }

                const mapEl = document.getElementById('cfg-api-field-map');
                if (mapEl) {
                    const json = CONFIG.API_FIELD_MAP || {};
                    mapEl.value = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
                }

                const scanDisplay = document.getElementById('cfg-local-scan-paths-display');
                if (scanDisplay) {
                    const val = (CONFIG.LOCAL_SCAN_PATHS || '').trim();
                    scanDisplay.innerText = val ? val : '默认全盘';
                    scanDisplay.style.color = val ? '#ddd' : '#888';
                }
            }
        }


        // --- 搜索管理器 (修复版：适配 DB) ---
