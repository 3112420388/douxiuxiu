/* Built from src/index.html local script order. Do not edit directly. */

/* ---- services/api.js ---- */
/**
 * js/api.js
 * 抖咻咻 API 接口管理模块
 * 包含：基础请求封装、加密验证、各模块接口集合、下载代理逻辑
 */

const Api = {
    config: {
        // 核心后台地址 (原 API_BASE)
        BASE_URL: 'http://dxx.zzxia.icu/',

        // 外部第三方解析 SDK 配置
        SDK: {
            BASE: '',
            KEY: ''
        },
        // 积分/口令验证密钥
        SECRET: 'DouXiuXiu_Secret_2025_#@!',
        REQUEST_TIMEOUT: 12000
    },

    _joinUrl(base, endpoint) {
        const safeBase = String(base || '').replace(/\/+$/, '');
        const safeEndpoint = String(endpoint || '').replace(/^\/+/, '');
        if (!safeBase) return safeEndpoint;
        if (!safeEndpoint) return safeBase;
        return `${safeBase}/${safeEndpoint}`;
    },

    _getRuntimeConfig() {
        // v4: keep compatible with both classic-script CONFIG and explicit window.CONFIG.
        try {
            if (typeof CONFIG !== 'undefined') return CONFIG;
        } catch (e) {
            // ignore TDZ / scope edge cases
        }
        return window.CONFIG || {};
    },

    _withTimeout(ms) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms || Api.config.REQUEST_TIMEOUT);
        return { controller, timer };
    },

    async _readJsonResponse(response) {
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error(`响应不是合法 JSON: ${text.slice(0, 120)}`);
        }
        if (!response.ok) {
            throw new Error(json?.msg || json?.message || `HTTP ${response.status}`);
        }
        return json;
    },

    getSdkConfig() {
        const cfg = this._getRuntimeConfig();
        return {
            base: cfg.API_SDK_BASE || Api.config.SDK.BASE,
            key: cfg.API_SDK_KEY || Api.config.SDK.KEY,
            profilePath: cfg.API_SDK_PROFILE_PATH || 'dy/dyzy.php',
            searchPath: cfg.API_SDK_SEARCH_PATH || 'dy/dyzy.php',
            videoPath: cfg.API_SDK_VIDEO_PATH || 'dy/dyzy.php',
            keyParam: cfg.API_SDK_KEY_PARAM || 'key',
            urlParam: cfg.API_SDK_URL_PARAM || 'msg',
            searchParam: cfg.API_SDK_SEARCH_PARAM || 'msg',
            typeParam: cfg.API_SDK_TYPE_PARAM || 'type'
        };
    },

    /**
     * 核心请求方法 (替代原 apiFetch)
     */
    async fetch(endpoint, action, data = {}) {
        const formData = new FormData();
        formData.append('action', action);

        // 自动注入当前用户ID (依赖全局 app 对象)
        if (window.app && window.app.accountManager && window.app.accountManager.user) {
            const uid = window.app.accountManager.user.id;
            formData.append('user_id', uid);
            formData.append('uid', uid);
        }

        // 追加数据
        for (const key in data) {
            if (data[key] instanceof FileList || Array.isArray(data[key])) {
                // 处理文件数组 (如发帖时的 media[])
                if (Array.isArray(data[key])) {
                    data[key].forEach(file => formData.append(`${key}[]`, file));
                }
            } else if (data[key] !== undefined && data[key] !== null) {
                formData.append(key, data[key]);
            }
        }

        const url = endpoint.startsWith('http') ? endpoint : this._joinUrl(this.config.BASE_URL, endpoint);

        const timeout = this._withTimeout(this.config.REQUEST_TIMEOUT);
        try {
            const response = await window.fetch(url, {
                method: 'POST',
                body: formData,
                signal: timeout.controller.signal
            });
            return await this._readJsonResponse(response);
        } catch (e) {
            console.error(`[API Error] ${endpoint}/${action}:`, e);
            const isAbort = e && (e.name === 'AbortError' || String(e.message || '').includes('aborted'));
            return { code: 500, msg: isAbort ? '请求超时，请稍后重试' : '网络请求失败，请检查连接' };
        } finally {
            clearTimeout(timeout.timer);
        }
    },

    /**
     * 简单的 GET 请求封装
     */
    async get(url, options = {}) {
        const timeout = this._withTimeout(options.timeout || this.config.REQUEST_TIMEOUT);
        try {
            const res = await window.fetch(url, { ...options, signal: timeout.controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        } finally {
            clearTimeout(timeout.timer);
        }
    },

    async getJson(url, options = {}) {
        const timeout = this._withTimeout(options.timeout || this.config.REQUEST_TIMEOUT);
        try {
            const res = await window.fetch(url, { ...options, signal: timeout.controller.signal });
            return await this._readJsonResponse(res);
        } finally {
            clearTimeout(timeout.timer);
        }
    },

    // ================= 模块化接口 =================

    /** 账号与权限 */
    Auth: {
        async loginOrRegister(username, password, deviceId, isWebIde) {
            return Api.fetch('chat_api.php', 'login_or_register', {
                username, password, device_id: deviceId, is_webide: isWebIde
            });
        },
        // 更新资料 (昵称/头像)
        async updateProfile(userId, username, avatar) {
            return Api.fetch('chat_api.php', 'update_profile', {
                action: 'update_profile',
                user_id: userId,
                username, avatar
            });
        },
        // 获取用户信息
        async getUserInfo(userId) {
            return Api.fetch('chat_api.php', 'get_user_info', { user_id: userId });
        },
        // 获取他人主页信息
        async getUserProfile(targetId, currentId) {
            return Api.fetch('chat_api.php', 'get_user_profile', { target_id: targetId, current_id: currentId });
        },
        async adminOp(adminId, targetId, opType, val) {
            return Api.fetch('chat_api.php', 'user_op', {
                admin_id: adminId,
                target_id: targetId,
                op_type: opType,
                val: val
            });
        }
    },

    /** 聊天室 */
    Chat: {
        async getMessages(lastId) {
            return Api.fetch('chat_api.php', 'get_msgs', { last_id: lastId });
        },
        async sendMessage(uid, content, type, quoteData = {}) {
            const payload = { uid, content, type, ...quoteData };
            return Api.fetch('chat_api.php', 'send_msg', payload);
        },
        async deleteMessage(msgId, userId, isAdmin) {
            return Api.fetch('chat_api.php', 'delete_msg', {
                msg_id: msgId,
                user_id: userId,
                is_admin: isAdmin
            });
        }
    },

    /** 圈子/社区 */
    Circle: {
        async getCircles() {
            return Api.fetch('circle_api.php', 'get_circles');
        },
        async getCircleInfo(circleId, userId) {
            return Api.fetch('circle_api.php', 'get_circle_info', { circle_id: circleId, user_id: userId });
        },
        async joinToggle(circleId, userId, type) {
            return Api.fetch('circle_api.php', 'join_toggle', { circle_id: circleId, user_id: userId, type });
        },
        async getPostList(params) {
            // params: { page, circle_id, user_id, keyword }
            return Api.fetch('circle_api.php', 'get_post_list', params);
        },
        async toggleLike(postId, userId) {
            return Api.fetch('circle_api.php', 'toggle_like', { post_id: postId, user_id: userId });
        },
        async createPost(formData) {
            // 特殊处理：发帖通常包含文件，formData 由外部构建更方便，这里直接透传
            const url = Api._joinUrl(Api.config.BASE_URL, 'circle_api.php');
            try {
                const res = await window.fetch(url, { method: 'POST', body: formData });
                return await res.json();
            } catch (e) {
                return { code: 500, msg: '发布请求失败' };
            }
        },
        async manageCircle(data) {
            return Api.fetch('circle_api.php', 'manage_circle', data);
        },
        async createCircle(userId, name, desc) {
            return Api.fetch('circle_api.php', 'create_circle', { user_id: userId, name, desc });
        },
        async rewardPost(userId, postId, amount) {
            return Api.fetch('circle_api.php', 'reward_post', { user_id: userId, post_id: postId, amount });
        },
        async getUserPosts(userId, currentId = 0) { return Api.fetch('circle_api.php', 'get_user_posts', { target_user_id: userId, user_id: currentId || userId }); },
        async getUserCircles(userId) { return Api.fetch('circle_api.php', 'get_user_circles', { target_user_id: userId, user_id: userId }); },
        async getUserLikes(userId, currentId = 0) { return Api.fetch('circle_api.php', 'get_user_likes', { target_user_id: userId, user_id: currentId || userId }); },
        async getCoinHistory(userId) { return Api.fetch('circle_api.php', 'get_coin_history', { user_id: userId }); },
        async getComments(postId, page = 1) { return Api.fetch('circle_api.php', 'get_comments', { post_id: postId, page }); },
        async addComment(postId, userId, content, replyId = 0) { return Api.fetch('circle_api.php', 'add_comment', { post_id: postId, user_id: userId, content, reply_id: replyId || 0 }); },
        async deleteComment(commentId, userId) { return Api.fetch('circle_api.php', 'delete_comment', { comment_id: commentId, user_id: userId }); }
    },

    /** 外部第三方 SDK 接口 */
    External: {
        // 抖音主页解析 (支持 AbortSignal)
        async fetchDouyinProfile(url, signal) {
            const sdk = Api.getSdkConfig();
            const params = new URLSearchParams();
            // 有key时才带入key参数
            if (sdk.key && sdk.key.trim() !== '') {
                params.set(sdk.keyParam, sdk.key);
            }
            params.set(sdk.urlParam, url);
            const apiUrl = `${sdk.base}/${sdk.profilePath}?${params.toString()}`;
            const options = signal ? { signal } : {};
            const json = await Api.getJson(apiUrl, options);

            // 兼容新旧API格式：新API返回 {code:200, msg:"success", data:[...]}
            if (json && json.code === 200 && Array.isArray(json.data)) {
                // 对作品数据内部的参数名进行适配
                const adaptedData = json.data.map(item => this._adaptWorkItem(item));

                return {
                    ...json,
                    // 转换为旧格式兼容性
                    aweme_list: adaptedData,
                    has_more: json.pagination ? json.pagination.has_more : false,
                    next_url: json.pagination ? this._buildNextUrl(url, json.pagination) : null
                };
            }

            return json;
        },

        // 构建下一页URL（兼容新API格式）
        _buildNextUrl(originalUrl, pagination) {
            if (!pagination || !pagination.has_more) return null;

            // 基于新API的分页逻辑构建下一页URL
            // 如果pagination包含cursor或page信息，可以构建分页URL
            if (pagination.cursor) {
                // 基于游标的分页
                const urlObj = new URL(originalUrl);
                urlObj.searchParams.set('cursor', pagination.cursor);
                return urlObj.toString();
            } else if (pagination.page && pagination.pages > pagination.page) {
                // 基于页码的分页
                const urlObj = new URL(originalUrl);
                urlObj.searchParams.set('page', pagination.page + 1);
                return urlObj.toString();
            }

            return null;
        },

        // 适配作品信息参数名（兼容新旧API格式）
        _adaptWorkItem(item) {
            if (!item || typeof item !== 'object') return item;

            const adapted = { ...item };

            // 作者信息适配
            if (adapted.author_info) {
                // 新格式：author_info -> 旧格式：author
                if (adapted.author_info.nickname && !adapted.author) {
                    adapted.author = adapted.author_info.nickname;
                }
                if (adapted.author_info.avatar && !adapted.avatar) {
                    adapted.avatar = adapted.author_info.avatar;
                }
                // 适配更多作者信息字段
                if (adapted.author_info.unique_id && !adapted.unique_id) {
                    adapted.unique_id = adapted.author_info.unique_id;
                }
                if (adapted.author_info.signature && !adapted.signature) {
                    adapted.signature = adapted.author_info.signature;
                }
            }

            // 直接作者字段适配（如果API直接返回author字段）
            if (adapted.author && typeof adapted.author === 'object') {
                if (adapted.author.nickname && !adapted.author_name) {
                    adapted.author_name = adapted.author.nickname;
                }
                if (adapted.author.avatar && !adapted.avatar) {
                    adapted.avatar = adapted.author.avatar;
                }
            }

            // 适配您提供的新抖音数据格式
            // 作者信息适配
            if (adapted.author_uid && !adapted.author_id) {
                adapted.author_id = adapted.author_uid;
            }
            if (adapted.author_sec_uid && !adapted.author_sec_id) {
                adapted.author_sec_id = adapted.author_sec_uid;
            }
            if (adapted.author_avatar && !adapted.avatar) {
                adapted.avatar = adapted.author_avatar;
            }
            if (adapted.author_avatar_proxy && !adapted.avatar_proxy) {
                adapted.avatar_proxy = adapted.author_avatar_proxy;
            }
            if (adapted.author_avatar_download && !adapted.avatar_download) {
                adapted.avatar_download = adapted.author_avatar_download;
            }

            // 作品信息适配
            if (adapted.desc && !adapted.description) {
                adapted.description = adapted.desc;
            }
            if (adapted.aweme_id && !adapted.awemeId) {
                adapted.awemeId = adapted.aweme_id;
            }
            if (adapted.create_time && !adapted.createTime) {
                adapted.createTime = adapted.create_time;
            }
            if (adapted.share_url && !adapted.shareUrl) {
                adapted.shareUrl = adapted.share_url;
            }

            // 封面图适配
            if (adapted.cover && !adapted.cover_url) {
                adapted.cover_url = adapted.cover;
            }
            if (adapted.dynamic_cover && !adapted.cover_url) {
                adapted.cover_url = adapted.dynamic_cover;
            }
            if (adapted.cover_proxy && !adapted.cover_proxy_url) {
                adapted.cover_proxy_url = adapted.cover_proxy;
            }

            // 视频信息适配
            if (adapted.video_info) {
                if (adapted.video_info.duration && !adapted.duration) {
                    adapted.duration = adapted.video_info.duration;
                }
                if (adapted.video_info.play_addr && !adapted.play_addr) {
                    adapted.play_addr = adapted.video_info.play_addr;
                }
                if (adapted.video_info.download_addr && !adapted.download_addr) {
                    adapted.download_addr = adapted.video_info.download_addr;
                }
                // 适配更多视频信息
                if (adapted.video_info.width && !adapted.width) {
                    adapted.width = adapted.video_info.width;
                }
                if (adapted.video_info.height && !adapted.height) {
                    adapted.height = adapted.video_info.height;
                }
            }

            // 适配您提供的新抖音数据格式 - 视频信息
            if (adapted.duration && !adapted.video_duration) {
                adapted.video_duration = adapted.duration;
            }
            if (adapted.video && !adapted.video_url) {
                adapted.video_url = adapted.video;
            }
            if (adapted.video_proxy && !adapted.video_proxy_url) {
                adapted.video_proxy_url = adapted.video_proxy;
            }
            if (adapted.download_url && !adapted.video_download_url) {
                adapted.video_download_url = adapted.download_url;
            }

            // 图片信息适配
            if (adapted.images && Array.isArray(adapted.images)) {
                if (!adapted.image_urls) {
                    adapted.image_urls = adapted.images;
                }
            }
            if (adapted.images_proxy && Array.isArray(adapted.images_proxy)) {
                if (!adapted.image_proxy_urls) {
                    adapted.image_proxy_urls = adapted.images_proxy;
                }
            }
            if (adapted.download_urls && Array.isArray(adapted.download_urls)) {
                if (!adapted.image_download_urls) {
                    adapted.image_download_urls = adapted.download_urls;
                }
            }

            // 音乐信息适配
            if (adapted.music_info) {
                if (adapted.music_info.title && !adapted.music_title) {
                    adapted.music_title = adapted.music_info.title;
                }
                if (adapted.music_info.author && !adapted.music_author) {
                    adapted.music_author = adapted.music_info.author;
                }
                if (adapted.music_info.cover && !adapted.music_cover) {
                    adapted.music_cover = adapted.music_info.cover;
                }
                if (adapted.music_info.play_url && !adapted.music_play_url) {
                    adapted.music_play_url = adapted.music_info.play_url;
                }
                if (adapted.music_info.duration && !adapted.music_duration) {
                    adapted.music_duration = adapted.music_info.duration;
                }
            }

            // 适配您提供的新抖音数据格式 - 音乐信息
            if (adapted.music_title && !adapted.music_name) {
                adapted.music_name = adapted.music_title;
            }
            if (adapted.music_author && !adapted.music_artist) {
                adapted.music_artist = adapted.music_author;
            }
            if (adapted.music_url && !adapted.music_play_url) {
                adapted.music_play_url = adapted.music_url;
            }
            if (adapted.music_proxy && !adapted.music_proxy_url) {
                adapted.music_proxy_url = adapted.music_proxy;
            }
            if (adapted.music_download && !adapted.music_download_url) {
                adapted.music_download_url = adapted.music_download;
            }

            // 统计信息适配
            if (adapted.statistics) {
                if (adapted.statistics.digg_count !== undefined && adapted.digg_count === undefined) {
                    adapted.digg_count = adapted.statistics.digg_count;
                }
                if (adapted.statistics.comment_count !== undefined && adapted.comment_count === undefined) {
                    adapted.comment_count = adapted.statistics.comment_count;
                }
                if (adapted.statistics.share_count !== undefined && adapted.share_count === undefined) {
                    adapted.share_count = adapted.statistics.share_count;
                }
                if (adapted.statistics.collect_count !== undefined && adapted.collect_count === undefined) {
                    adapted.collect_count = adapted.statistics.collect_count;
                }
            }

            // 适配您提供的新抖音数据格式 - 统计信息
            if (adapted.digg_count !== undefined && adapted.like_count === undefined) {
                adapted.like_count = adapted.digg_count;
            }
            if (adapted.comment_count !== undefined && adapted.comment_count === undefined) {
                adapted.comment_count = adapted.comment_count;
            }
            if (adapted.share_count !== undefined && adapted.share_count === undefined) {
                adapted.share_count = adapted.share_count;
            }
            if (adapted.collect_count !== undefined && adapted.collect_count === undefined) {
                adapted.collect_count = adapted.collect_count;
            }
            if (adapted.play_count !== undefined && adapted.view_count === undefined) {
                adapted.view_count = adapted.play_count;
            }

            // 时间信息适配和格式化
            if (adapted.create_time && !adapted.create_time_formatted) {
                adapted.create_time_formatted = this._formatTime(adapted.create_time);
            }
            if (adapted.timestamp && !adapted.create_time_formatted) {
                adapted.create_time_formatted = this._formatTime(adapted.timestamp);
            }

            return adapted;
        },

        // 时间格式化工具函数
        _formatTime(timestamp) {
            return formatRelativeTime(timestamp);
        },

        // 抖音搜索
        async searchDouyin(keyword) {
            const sdk = Api.getSdkConfig();
            const params = new URLSearchParams();
            // 有key时才带入key参数
            if (sdk.key && sdk.key.trim() !== '') {
                params.set(sdk.keyParam, sdk.key);
            }
            params.set(sdk.searchParam, keyword);
            params.set(sdk.typeParam, '0');
            const apiUrl = `${sdk.base}/${sdk.searchPath}?${params.toString()}`;
            const json = await Api.getJson(apiUrl);

            // 兼容新旧API格式
            if (json && json.code === 200 && Array.isArray(json.data)) {
                // 对作品数据内部的参数名进行适配
                const adaptedData = json.data.map(item => this._adaptWorkItem(item));

                return {
                    ...json,
                    // 转换为旧格式兼容性
                    aweme_list: adaptedData
                };
            }

            return json;
        },

        // 单视频链接解析
        async parseVideo(url) {
            const sdk = Api.getSdkConfig();
            const params = new URLSearchParams();
            // 有key时才带入key参数
            if (sdk.key && sdk.key.trim() !== '') {
                params.set(sdk.keyParam, sdk.key);
            }
            params.set(sdk.urlParam, url);
            const apiUrl = `${sdk.base}/${sdk.videoPath}?${params.toString()}`;
            const json = await Api.getJson(apiUrl);

            // 兼容新旧API格式
            if (json && json.code === 200 && json.data) {
                // 对作品数据内部的参数名进行适配
                const adaptedData = this._adaptWorkItem(json.data);

                return {
                    ...json,
                    // 转换为旧格式兼容性
                    item_list: [adaptedData]
                };
            }

            return json;
        }
    },

    /**
     * 下载与文件处理
     * 专门用于 DownloadManager
     */
    Download: {
        /**
         * 获取文件的 Blob 数据
         * @param {string} url - 目标 URL
         * @param {boolean} useProxy - 是否使用代理 (视频通常需要，图片可能不需要)
         */
        async getBlob(url, useProxy = false) {
            // 获取代理前缀
            const proxyPrefix = Api.getProxyPrefix();
            const targetUrl = useProxy ? (proxyPrefix + encodeURIComponent(url)) : url;

            try {
                const res = await window.fetch(targetUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.blob();
            } catch (e) {
                console.warn(`[Download] Blob fetch failed (Proxy: ${useProxy}): ${url}`, e);
                return null;
            }
        }
    },

    /**
     * 获取下载代理地址前缀
     * 对应 DownloadManager 中的 this.proxy
     */
    getProxyPrefix() {
        // 动态适配末尾斜杠
        const base = this.config.BASE_URL.endsWith('/') ? this.config.BASE_URL.slice(0, -1) : this.config.BASE_URL;
        // 假设代理脚本位于 API 根目录的同级或特定路径
        // 原有逻辑：BASE_URL + '/dyzl.php?url='
        return `${base}/dyzl.php?url=`;
    },

    /** 积分与加密工具 */
    Quota: {
        buf2hex(buffer) {
            return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
        },
        base64ToBuf(base64) {
            const binary_string = window.atob(base64);
            const len = binary_string.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
            return bytes;
        },
        async generateSign(token, timestamp) {
            const str = token + timestamp + Api.config.SECRET;
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return this.buf2hex(hashBuffer);
        },
        async decryptData(encryptedBase64, ivBase64) {
            try {
                const encoder = new TextEncoder();
                const keyData = encoder.encode(Api.config.SECRET);
                const keyHashBuffer = await crypto.subtle.digest('SHA-256', keyData);
                const keyHashHex = this.buf2hex(keyHashBuffer);
                const rawKeyStr = keyHashHex.substring(0, 16);
                const rawKeyBytes = encoder.encode(rawKeyStr);
                const key = await crypto.subtle.importKey('raw', rawKeyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
                const encryptedBuffer = this.base64ToBuf(encryptedBase64);
                const ivBuffer = this.base64ToBuf(ivBase64);
                const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBuffer }, key, encryptedBuffer);
                const decoder = new TextDecoder();
                return JSON.parse(decoder.decode(decryptedBuffer));
            } catch (e) {
                console.error('解密失败:', e);
                return null;
            }
        },
        async verifyToken(token) {
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = await this.generateSign(token, timestamp);
            const timeout = Api._withTimeout(Api.config.REQUEST_TIMEOUT);
            try {
                const response = await window.fetch(Api._joinUrl(Api.config.BASE_URL, 'verify_token.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, timestamp, sign }),
                    signal: timeout.controller.signal
                });
                return { raw: await Api._readJsonResponse(response), token, timestamp };
            } finally {
                clearTimeout(timeout.timer);
            }
        }
    }
};

// 挂载到全局
window.Api = Api;
window.API_BASE = Api.config.BASE_URL; // 兼容旧代码引用

/* ---- services/updateService.js ---- */
/**
 * DxxSystem Core Module v5.5
 * Added: VPN/Packet Capture detection & Strict Signature Enforcement
 */
(function (window, document) {
    'use strict';

    const escapeHTML = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const normalizeRichTextSource = (value) => {
        if (Array.isArray(value)) return value.map(v => String(v ?? '')).join('\n');
        if (value && typeof value === 'object') {
            if (Array.isArray(value.lines)) return value.lines.map(v => String(v ?? '')).join('\n');
            if (Array.isArray(value.list)) return value.list.map(v => '- ' + String(v ?? '')).join('\n');
            return JSON.stringify(value, null, 2);
        }
        return String(value ?? '');
    };
    const formatRichText = (value) => {
        let html = escapeHTML(normalizeRichTextSource(value));
        // v4 为安全把更新说明整体转义，导致远程说明中的 <br>/<p>/<ul>/<li> 等格式全部失效。
        // 这里仅恢复无脚本能力的基础排版标签，不恢复 style/on*/href 等属性。
        html = html.replace(/&lt;(\/?)(br|p|div|ul|ol|li|b|strong|i|em|h1|h2|h3|h4)(?:\s+[^&]*?)?\s*\/?&gt;/gi, (m, slash, tag) => {
            tag = String(tag || '').toLowerCase();
            if (tag === 'br') return '<br>';
            return '<' + (slash ? '/' : '') + tag + '>';
        });
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/^\s*[-*]\s+(.+)$/gm, '• $1');
        html = html.replace(/\n/g, '<br>');
        return html;
    };
    const safeLines = formatRichText;
    // --- 配置常量 ---
    const CONFIG = {
        // 安全配置
        SECURITY: {
            OFFICIAL_SIGNATURE: '0D6E54A998BDBE9C9A162FCD398D3912',
            ERROR_PAGE: '404.html', // 签名错误或抓包时跳转的页面
            CHECK_TIMEOUT: 3000
        },
        // 更新配置
        UPDATE: {
            // 推荐使用多个源以提高可用性（按优先级顺序）
            HOSTS: [
                'https://raw.githubusercontent.com/hillmis/versionControl/main',
                'https://ghproxy.com/https://raw.githubusercontent.com/hillmis/versionControl/main',
                'https://cdn.jsdelivr.net/gh/hillmis/versionControl@main',
                'https://raw.gitmirror.com/hillmis/versionControl/main',
                'https://raw.fastgit.org/hillmis/versionControl/main'
            ],
            CHECK_INTERVAL: 3000000,
            MIN_VISIBLE_CHECK: 2000
        },
        // 公告配置
        ANNOUNCEMENT: {
            HOSTS: [
                'https://raw.githubusercontent.com/hillmis/versionControl/main',
                'https://ghproxy.com/https://raw.githubusercontent.com/hillmis/versionControl/main',
                'https://cdn.jsdelivr.net/gh/hillmis/versionControl@main',
                'https://raw.gitmirror.com/hillmis/versionControl/main',
                'https://raw.fastgit.org/hillmis/versionControl/main'
            ],
            CACHE_DURATION: 3600000, // 1小时缓存
            CHECK_ON_STARTUP: true
        },
        // 接口
        API: {
            HITOKOTO: 'https://www.wudada.online/Api/ScSj'
        },
        // 资源
        ASSETS: {
            ALIPAY: 'https://s3.bmp.ovh/imgs/2025/05/07/1565fff5085e314b.png',
            WECHAT: 'https://s3.bmp.ovh/imgs/2026/01/13/33a0542b1403bb94.jpg'
        }
    };

    class SystemApp {
        constructor() {
            // 初始化状态
            this.state = {
                localCode: typeof webapp !== 'undefined' ? webapp.getcode() : '100',
                currentSign: typeof webapp !== 'undefined' ? webapp.getsign() : '',
                currentVersion: typeof webapp !== 'undefined' ? webapp.getpage() : '1.0.0',
                appName: typeof webapp !== 'undefined' ? webapp.getname() : document.title,
                latestUpdateData: null,
                lastCheckTimestamp: 0,
                hitokoto: '天若有情天亦老，人间正道是沧桑',
                announcements: [],
                lastAnnouncementCheck: 0,
                shownAnnouncementIds: new Set(JSON.parse(localStorage.getItem('shownAnnouncementIds') || '[]'))
            };

            // 绑定上下文
            this.handleImageClick = this.handleImageClick.bind(this);
            this.checkUpdate = this.checkUpdate.bind(this);
            this.openSponsor = this.openSponsor.bind(this);
            this.handleCancelUpdate = this.handleCancelUpdate.bind(this);
            this.openAnnouncementPopup = this.openAnnouncementPopup.bind(this);
            this.getAnnouncements = this.getAnnouncements.bind(this);
            this.checkPopupAnnouncements = this.checkPopupAnnouncements.bind(this);

            // 初始化
            this._initSecurity(); // 优先执行安全检查
            this._initHooks();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this._onReady());
            } else {
                this._onReady();
            }
        }

        // --- 生命周期 ---
        _onReady() {
            this._fetchHitokoto();
            this._initVisibilityListener();
            this._verifyIntegrity(); // 再次校验，防止初始化时DOM未加载导致校验跳过

            // --- 修改部分：确保所有内容加载完成后再显示公告 ---
            if (CONFIG.ANNOUNCEMENT.CHECK_ON_STARTUP) {
                // 如果页面已经加载完成（complete），直接执行
                if (document.readyState === 'complete') {
                    this.checkPopupAnnouncements();
                } else {
                    // 否则监听 window 的 load 事件
                    window.addEventListener('load', () => {
                        // 建议增加一个小延迟（如 500ms），确保浏览器渲染压力降低，视觉上更平滑
                        setTimeout(() => {
                            this.checkPopupAnnouncements();
                        }, 500);
                    });
                }
            }
        }

        _initHooks() {
            window.handleImageClick = this.handleImageClick;

        }

        _initVisibilityListener() {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (this.state.latestUpdateData?.forceUpdate && typeof webapp !== 'undefined') {
                        webapp.secede();
                    }
                } else {
                    const timeSinceLastCheck = Date.now() - this.state.lastCheckTimestamp;
                    if (timeSinceLastCheck > CONFIG.UPDATE.MIN_VISIBLE_CHECK) {
                        this.checkUpdate();
                    }
                }
            });
        }

        // --- 安全模块 (核心修改) ---
        _initSecurity() {
            this._verifyIntegrity();
        }

        _verifyIntegrity() {
            // 1. VPN / 抓包检测 (新增)
            if (typeof webapp !== 'undefined') {
                try {
                    // 调用原生接口判断抓包/VPN状态
                    // 对应 nativeBridge.ts 中的: raw?.['判断抓包状态']?.()
                    if (webapp['判断抓包状态'] && webapp['判断抓包状态']()) {
                        this._handleTampering('非法环境：检测到VPN或抓包代理');
                        // 发现抓包立即跳转 404 或退出
                        window.location.replace(CONFIG.SECURITY.ERROR_PAGE);
                        return false;
                    }
                } catch (e) {
                    // 忽略接口不存在的错误，兼容旧版本
                }
            }

            // 2. 调试模式检测
            if (typeof window.devtools === 'object' || window.outerWidth - window.innerWidth > 100) {
                this._handleTampering('调试模式检测');
            }

            // 3. 签名校验 (修改：不匹配则强制跳转)
            try {
                if (this.state.currentSign && this.state.currentSign !== CONFIG.SECURITY.OFFICIAL_SIGNATURE) {
                    console.warn(`[Security] Signature Mismatch! Expected: ${CONFIG.SECURITY.OFFICIAL_SIGNATURE}, Got: ${this.state.currentSign}`);
                    // 强制跳转到 404 页面
                    window.location.replace(CONFIG.SECURITY.ERROR_PAGE);
                    return false;
                }
                return true;
            } catch (e) {
                this._handleTampering('校验异常');
                return false;
            }
        }

        _handleTampering(reason) {
            console.warn(`[安全警报] ${reason}`);
            if (typeof webapp !== 'undefined') {
                webapp.toast(`安全警告: ${reason}`);
            }
        }

        // --- 数据获取模块 ---
        _fetchHitokoto() {
            const fetchPoem = () => {
                return fetch(CONFIG.API.HITOKOTO)
                    .then(res => res.ok ? res.json() : Promise.reject())
                    .then(data => {
                        const text = data.data || this.state.hitokoto;
                        return text.length > 12 ? fetchPoem() : text;
                    })
                    .catch(() => this.state.hitokoto);
            };

            fetchPoem().then(text => {
                this.state.hitokoto = text;
                const poemEl = document.querySelector('.poem-text');
                if (poemEl) poemEl.textContent = text;
            });
        }

        // --- 更新模块 ---
        _compareVersions(local, remote) {
            const currentNum = Number(local);
            const latestNum = Number(remote);
            if (isNaN(currentNum) || isNaN(latestNum)) return false;
            return latestNum > currentNum;
        }

        async _fetchJsonFromHosts({ hosts, names, validate, logPrefix, failMessage }) {
            const sourceHosts = Array.isArray(hosts) && hosts.length > 0
                ? hosts
                : [];
            const tryUrls = [];
            for (const host of sourceHosts) {
                const base = String(host || '').replace(/\/$/, '');
                if (!base) continue;
                for (const name of names) {
                    tryUrls.push(`${base}/${name}.json?t=${Date.now()}`);
                }
            }

            let lastErr = null;
            for (const url of tryUrls) {
                console.log(`[${logPrefix || 'RemoteJson'}] 尝试获取数据: ${url}`);
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        lastErr = new Error(`HTTP错误: ${response.status} @ ${url}`);
                        continue;
                    }
                    const data = await response.json();
                    const validation = validate ? validate(data) : true;
                    if (validation !== true) {
                        lastErr = new Error(validation || '数据格式无效');
                        continue;
                    }
                    return data;
                } catch (err) {
                    lastErr = err;
                }
            }
            throw lastErr || new Error(failMessage || '远程数据获取失败');
        }

        async _fetchRemoteUpdateData() {
            const hosts = Array.isArray(CONFIG.UPDATE.HOSTS) && CONFIG.UPDATE.HOSTS.length > 0
                ? CONFIG.UPDATE.HOSTS
                : [String(CONFIG.UPDATE.HOST || '').replace(/\/$/, '')];
            const candidateNames = [encodeURIComponent(this.state.appName), 'xueleme'];
            return this._fetchJsonFromHosts({
                hosts,
                names: candidateNames,
                logPrefix: 'Update',
                failMessage: '无法获取更新数据',
                validate: (data) => data && data.versionCode && data.versionName ? true : '无效的版本数据格式'
            });
        }

        _extractUpdateTime(data) {
            if (!data) return null;
            return String(data.updadtetime || data.updateTime || data.updateDatetime || '').trim() || null;
        }

        async getUpdateLog() {
            try {
                const data = await this._fetchRemoteUpdateData();
                const updateTime = this._extractUpdateTime(data);
                return {
                    versionName: data.versionName,
                    versionCode: data.versionCode,
                    description: data.description || '',
                    downloadUrl: data.downloadUrl || '',
                    forceUpdate: Boolean(data.forceUpdate),
                    updateTime
                };
            } catch (error) {
                console.error('获取更新日志失败:', error);
                throw error;
            }
        }

        async checkUpdate() {
            try {
                const data = await this._fetchRemoteUpdateData();
                const localCode = this.state.localCode;
                const serverCode = data.versionCode;

                console.log('版本检查:', `本地:${localCode}`, `服务器:${serverCode}`);

                if (this._compareVersions(localCode, serverCode)) {
                    this._createUpdateDialog();
                    this._showUpdateUI(data);
                } else {
                    if (typeof webapp !== 'undefined') webapp.toast('版本检查: 已是最新版本');
                    else console.log('已是最新版本');
                }
            } catch (error) {
                console.error('更新检查失败:', error);
                if (typeof webapp !== 'undefined') webapp.toast('检查更新失败');
            } finally {
                this.state.lastCheckTimestamp = Date.now();
            }
        }

        async showUpdateLog() {
            try {
                const data = await this._fetchRemoteUpdateData();
                this._createUpdateDialog();
                this._showUpdateUI(data);
            } catch (error) {
                console.error('获取更新日志失败:', error);
                if (typeof webapp !== 'undefined') webapp.toast('获取更新日志失败');
            } finally {
                this.state.lastCheckTimestamp = Date.now();
            }
        }

        _createUpdateDialog() {
            if (document.getElementById('updateOverlay')) return;
            const dialog = document.createElement('div');
            dialog.innerHTML = `
        <div id="updateOverlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; background: rgba(0,0,0,0.5); z-index: 9999; backdrop-filter: blur(4px); padding: 20px; box-sizing: border-box; display: flex; justify-content: center; align-items: center;">
            <div style="background: #ffffff; width: min(95%, 480px); height: 70vh; max-height: 600px; min-height: 350px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column; animation: modalSlide 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                <div style="padding: 24px; background: #fff; border-bottom: 1px solid #f0f0f0; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 16px; color: #1f2937;">
                        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #29c961, #22a350); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(41, 201, 97, 0.3);">
                            <svg viewBox="0 0 24 24" width="28" height="28" style="fill: currentColor"><path d="M14.8 3.8l2.6 5.1 5.8.9c.6.1.8.8.4 1.2l-4.2 4.3 1 5.7c.1.6-.5 1.1-1.1.8L12 18.3l-5 2.7c-.6.3-1.2-.2-1.1-.8l1-5.7-4.2-4.3c-.4-.4-.2-1.1.4-1.2l5.8-.9 2.6-5.1c.3-.6 1.1-.6 1.4 0z"/></svg>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #111;">发现新版本</h3>
                            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #666;">建议您立即更新</p>
                        </div>
                    </div>
                </div>
                <div id="updateContent" style="flex: 1; padding: 24px; overflow-y: auto; scrollbar-width: thin; background: #fff;"></div>
                <div style="padding: 20px 24px; background: #fff; border-top: 1px solid #f0f0f0; display: flex; gap: 12px; justify-content: flex-end; flex-shrink: 0;">
                    <button id="updateCancel" style="padding: 12px 24px; background: #f5f7fa; border: none; border-radius: 10px; color: #5c6b7f; font-weight: 600; cursor: pointer;">稍后再说</button>
                    <button id="updateConfirm" style="padding: 12px 32px; background: #29c961; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(41, 201, 97, 0.25);">立即更新</button>
                </div>
            </div>
        </div>
        <style>@keyframes modalSlide { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } } #updateContent::-webkit-scrollbar { width: 6px; } #updateContent::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }</style>`;
            document.body.appendChild(dialog);
            document.getElementById('updateCancel').addEventListener('click', () => this.handleCancelUpdate());
        }

        handleCancelUpdate() {
            const el = document.getElementById('updateOverlay');
            if (el) el.style.display = 'none';
            if (typeof webapp !== 'undefined') webapp.toast('已延迟更新');
            this.state.lastCheckTimestamp = Date.now();
        }

        _showUpdateUI(data) {
            this.state.latestUpdateData = data;
            const overlay = document.getElementById('updateOverlay');
            const content = document.getElementById('updateContent');

            content.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.03); padding: 12px 15px; border-radius: 10px; margin-bottom: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #888;">当前版本</div>
                        <div style="font-size: 14px; color: #333; font-weight: bold;">v${escapeHTML(this.state.currentVersion)}</div>
                    </div>
                    <div style="color: #666;">➔</div>
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #888;">最新版本</div>
                        <div style="font-size: 14px; color: #29c961; font-weight: bold;">v${escapeHTML(data.versionName)}</div>
                    </div>
                </div>
                <div style="font-size: 14px; line-height: 1.6; color: #444; white-space: pre-wrap;">${safeLines(data.description || '')}</div>
                ${data.forceUpdate ? `<div style="margin-top: 15px; padding: 10px; background: #fff1f0; border-radius: 8px; color: #ff4d4f; font-size: 12px;">本次为强制更新</div>` : ''}
            `;

            if (data.forceUpdate) {
                const cancelBtn = document.getElementById('updateCancel');
                if (cancelBtn) cancelBtn.style.display = 'none';
            } else {
                document.getElementById('updateCancel').style.display = 'block';
            }

            const confirmBtn = document.getElementById('updateConfirm');
            confirmBtn.onclick = () => {
                this._checkPermissionAndDownload(data.downloadUrl);
                overlay.style.display = 'none';
            };
            overlay.style.display = 'flex';
        }

        async _checkPermissionAndDownload(url) {
            try {
                if (typeof webapp !== 'undefined') {
                    if (!webapp.bestow()) {
                        webapp.rights();
                    }
                    webapp.browse(url);
                } else {
                    window.open(url, '_blank');
                }
            } catch (error) {
                console.error('下载失败:', error);
            }
        }

        openSponsor() {
            const oldPopup = document.getElementById('SponsorPopup');
            if (oldPopup) oldPopup.remove();

            const popup = document.createElement('div');
            popup.id = 'SponsorPopup';
            popup.style.display = 'none';
            popup.style.opacity = '0';
            popup.className = 'popup-container';

            popup.innerHTML = `
        <style>
            .popup-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px); display: flex; justify-content: center; align-items: center; transition: all 0.3s; }
            .content-container { background: rgba(30, 30, 30, 0.95); width: 85%; max-width: 400px; border-radius: 20px; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); transform: scale(0.95); transition: all 0.3s; border: 1px solid rgba(255,255,255,0.1); }
            .popup-container[style*="opacity: 1"] .content-container { transform: scale(1); }
            .logo-box-animated { width: 70px; height: 70px; border-radius: 18px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); animation: floatLogo 3s ease-in-out infinite; }
            @keyframes floatLogo { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
            .popup-title { font-size: 20px; color: #fff; font-weight: 700; margin: 0; }
            .poem-text { text-align: center; color: rgba(255,255,255,0.5); font-size: 13px; font-style: italic; margin-bottom: 15px; font-family: serif; }
            .Sponsor-list-item { background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 12px 15px; width: 100%; box-sizing: border-box; display: flex; align-items: center; cursor: pointer; transition: 0.2s; margin-bottom: 8px; }
            .Sponsor-list-item:active { transform: scale(0.98); background: rgba(255,255,255,0.1); }
            .donate-section { margin-top: 15px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,0.1); width: 100%; text-align: center; }
            .qr-container { display: flex; justify-content: center; gap: 20px; margin-top: 15px; }
            .qr-img-wrapper { width: 90px; height: 90px; background: #fff; padding: 5px; border-radius: 10px; cursor: pointer; transition: 0.2s; }
            .qr-img-wrapper:active { opacity: 0.8; transform: scale(0.95); }
            .qr-img { width: 100%; height: 100%; object-fit: contain; }
            .qr-label { font-size: 12px; font-weight: bold; margin-top: 5px; }
        </style>
        
        <div class="content-container">
            <div class="Sponsor-logo-section" style="display:flex;flex-direction:column;align-items:center;">
                <div class="logo-box-animated">
                    <img src="https://q1.qlogo.cn/g?b=qq&nk=180782569&s=640" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <h2 style="margin-bottom:5px;color:white">hillmis✦山雾</h2>
            </div>

            <div class="text-container" style="width:100%;">
                <div class="poem-text">${this.state.hitokoto}</div>
                
                <div class="Sponsor-list-group">
                    <div class="Sponsor-list-item">
                        <div style="color:#eee;">
                            <div style="font-size:14px;font-weight:500;"></div>
                            <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">
                                我是一个前端和UI设计爱好者，用AI编程工具实现心中想法，为大家带来免费好用的软件，希望在实现自己灵光一现的奇思妙想的同时可以给您带来方便和乐趣。
                            </div>
                        </div>
                    </div>
                    <div class="Sponsor-list-item" id="visitAuthorBtn" style="justify-content:center;">
                        <div style="font-size:12px;color:rgba(255,255,255,0.7);">点击发现更多奇思妙想</div>
                    </div>
                </div>

                <div class="donate-section">
                    <div style="color:#ccc;font-size:13px;font-weight:500;">☕ 请开发者喝杯咖啡支持一下</div>
                    
                    <div class="qr-container">
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <div class="qr-img-wrapper" id="alipayQr"><img src="${CONFIG.ASSETS.ALIPAY}" class="qr-img"></div>
                            <div class="qr-label" style="color: #1677ff;">支付宝</div>
                        </div>
                        
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <div class="qr-img-wrapper" id="wechatQr"><img src="${CONFIG.ASSETS.WECHAT}" class="qr-img"></div>
                            <div class="qr-label" style="color: #07c160;">微信</div>
                        </div>
                    </div>
                    
                    <p style="text-align:center;color:rgba(255,255,255,0.3);font-size:11px;margin-top:15px;">点击图片保存赞赏码 · 感谢您的支持</p>
                </div>
            </div>
        </div>`;

            document.body.appendChild(popup);

            popup.addEventListener('click', (e) => {
                if (e.target === popup) this._closeSponsorPopup(popup);
            });

            document.getElementById('visitAuthorBtn').addEventListener('click', () => {
                const url = 'https://link3.cc/liu13';
                if (typeof webapp !== 'undefined') webapp.browse(url);
                else window.open(url, '_blank');
                this._closeSponsorPopup(popup);
            });

            document.getElementById('alipayQr').addEventListener('click', () => this.handleImageClick(2, CONFIG.ASSETS.ALIPAY));
            document.getElementById('wechatQr').addEventListener('click', () => this.handleImageClick(1, CONFIG.ASSETS.WECHAT));

            requestAnimationFrame(() => {
                popup.style.display = 'flex';
                requestAnimationFrame(() => {
                    popup.style.opacity = '1';
                });
            });
        }

        _closeSponsorPopup(popup) {
            popup.style.opacity = '0';
            setTimeout(() => {
                if (popup.parentNode) popup.parentNode.removeChild(popup);
            }, 300);
        }

        // --- 公告模块 ---
        async _fetchRemoteAnnouncementData() {
            const hosts = Array.isArray(CONFIG.ANNOUNCEMENT.HOSTS) && CONFIG.ANNOUNCEMENT.HOSTS.length > 0
                ? CONFIG.ANNOUNCEMENT.HOSTS
                : [String(CONFIG.UPDATE.HOSTS[0] || '').replace(/\/$/, '')];
            return this._fetchJsonFromHosts({
                hosts,
                names: ['dxxannouncements'],
                logPrefix: 'Announcement',
                failMessage: '无法获取公告数据',
                validate: (data) => Array.isArray(data) ? true : '公告数据格式无效，应为数组'
            });
        }

        async getAnnouncements() {
            try {
                // 检查缓存
                const now = Date.now();
                if (this.state.announcements.length > 0 &&
                    (now - this.state.lastAnnouncementCheck) < CONFIG.ANNOUNCEMENT.CACHE_DURATION) {
                    return this.state.announcements;
                }

                const data = await this._fetchRemoteAnnouncementData();
                this.state.announcements = data;
                this.state.lastAnnouncementCheck = now;
                return data;
            } catch (error) {
                console.error('获取公告失败:', error);
                // 返回缓存数据或空数组
                return this.state.announcements || [];
            }
        }

        async checkPopupAnnouncements() {
            try {
                const announcements = await this.getAnnouncements();
                const popupAnnouncements = announcements.filter(ann =>
                    ann.popup && !this.state.shownAnnouncementIds.has(ann.id)
                );

                if (popupAnnouncements.length > 0) {
                    // 显示最新的弹窗公告
                    const latestPopup = popupAnnouncements[popupAnnouncements.length - 1];
                    this.openAnnouncementPopup(latestPopup);
                }
            } catch (error) {
                console.error('检查弹窗公告失败:', error);
            }
        }

        openAnnouncementPopup(announcement) {
            if (!announcement) return;

            const oldPopup = document.getElementById('AnnouncementPopup');
            if (oldPopup) oldPopup.remove();

            const popup = document.createElement('div');
            popup.id = 'AnnouncementPopup';
            popup.style.display = 'none';
            popup.style.opacity = '0';
            popup.className = 'popup-container';
            popup.dataset.announcementId = String(announcement.id || '');

            popup.innerHTML = `
        <style>
            .popup-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px); display: flex; justify-content: center; align-items: center; transition: all 0.3s; }
            .content-container { background: rgba(30, 30, 30, 0.95); width: 85%; max-width: 400px; border-radius: 20px; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); transform: scale(0.95); transition: all 0.3s; border: 1px solid rgba(255,255,255,0.1); }
            .popup-container[style*="opacity: 1"] .content-container { transform: scale(1); }
            .logo-box-animated { width: 70px; height: 70px; border-radius: 18px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); animation: floatLogo 3s ease-in-out infinite; }
            @keyframes floatLogo { 0%, 100% { transform: translateY(0); } 50% { transform: scale(1.05); } }
            .announcement-title { font-size: 18px; color: #fff; font-weight: 700; margin: 0 0 10px 0; text-align: center; }
            .announcement-content { font-size: 14px; color: rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 15px; white-space: pre-wrap; text-align: center; }
            .announcement-meta { font-size: 12px; color: rgba(255,255,255,0.5); text-align: center; margin-bottom: 20px; }
            .announcement-actions { display: flex; gap: 10px; width: 100%; justify-content: center; }
            .btn { padding: 12px 24px; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
            .btn-primary { background: #29c961; color: white; }
            .btn-primary:active { transform: scale(0.95); background: #22a350; }
            .btn-secondary { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
            .btn-secondary:active { transform: scale(0.95); background: rgba(255,255,255,0.2); }
        </style>
        
        <div class="content-container">
           

            <h2 class="announcement-title">📢 系统通知</h2>
            
            <div class="announcement-content">${safeLines(announcement.content || '')}</div>
            
            <div class="announcement-meta">
                <div>发布时间: ${announcement.publishTime}</div>
                <div>发布者: ${escapeHTML(announcement.author || '系统')}</div>
            </div>

            <div class="announcement-actions">
                <button class="btn btn-secondary" id="announcementClose">知道了</button>
            </div>
        </div>`;

            document.body.appendChild(popup);

            this._setAnnouncementBackHandler('popup');

            // 显示弹窗
            setTimeout(() => {
                popup.style.display = 'flex';
                setTimeout(() => popup.style.opacity = '1', 10);
            }, 100);

            // 绑定事件
            popup.addEventListener('click', (e) => {
                if (e.target === popup) this._closeAnnouncementPopup(popup, announcement.id);
            });

            document.getElementById('announcementClose').addEventListener('click', () => {
                this._closeAnnouncementPopup(popup, announcement.id);
            });
        }

        _closeAnnouncementPopup(popup, announcementId) {
            popup.style.opacity = '0';
            setTimeout(() => {
                if (popup.parentNode) popup.parentNode.removeChild(popup);
            }, 300);

            // 标记为已显示
            if (announcementId) {
                this.state.shownAnnouncementIds.add(announcementId);
                localStorage.setItem('shownAnnouncementIds', JSON.stringify([...this.state.shownAnnouncementIds]));

                // 如果公告列表页面存在，刷新列表以显示已读状态
                const listPopup = document.getElementById('AnnouncementListPopup');
                if (listPopup) {
                    // 找到对应的公告项并标记为已读
                    const announcementItems = listPopup.querySelectorAll('.announcement-item');
                    announcementItems.forEach(item => {
                        const index = parseInt(item.getAttribute('data-index'));
                        // 这里需要重新获取公告数据来确定哪个是对应的公告项
                        // 由于我们无法直接从DOM获取公告ID，我们使用一个简单的方法：刷新整个列表
                    });

                    // 刷新公告列表以更新已读状态
                    this.getAnnouncements().then(announcements => {
                        this._refreshAnnouncementList(announcements);
                    });
                }
            }

            // 恢复返回键行为
            if (document.getElementById('AnnouncementListPopup')) {
                this._setAnnouncementBackHandler('list');
            } else {
                this._setAnnouncementBackHandler('clear');
            }
        }

        // 打开公告列表页面
        async openAnnouncementList() {
            try {
                const announcements = await this.getAnnouncements();
                this._showAnnouncementList(announcements);
            } catch (error) {
                console.error('打开公告列表失败:', error);
                if (typeof webapp !== 'undefined') webapp.toast('获取公告失败');
            }
        }

        _renderAnnouncementItem(announcement, index) {
            const publishDate = new Date(announcement.publishTime).toLocaleDateString();
            const isRead = this.state.shownAnnouncementIds.has(announcement.id);
            return `
                <div class="announcement-item ${isRead ? 'read' : 'unread'}" data-index="${index}">
                    <div class="announcement-item-header">
                        <div class="announcement-item-title">${escapeHTML(announcement.title || '系统公告')}</div>
                        <div class="announcement-item-date">${publishDate}</div>
                    </div>
                    <div class="announcement-item-content">${safeLines(announcement.content || '')}</div>
                    <div class="announcement-item-meta">
                        <span class="announcement-item-author">发布者: ${escapeHTML(announcement.author || '系统')}</span>
                        ${isRead ? '<span class="announcement-item-read-status">已读</span>' : '<span class="announcement-item-read-status unread">未读</span>'}
                    </div>
                </div>
            `;
        }

        _renderAnnouncementListBody(announcements) {
            if (!announcements || announcements.length === 0) {
                return `
                    <div class="announcement-empty">
                        <div class="announcement-empty-icon">📭</div>
                        <div class="announcement-empty-text">暂无公告</div>
                    </div>
                `;
            }
            return announcements.map((announcement, index) => this._renderAnnouncementItem(announcement, index)).join('');
        }

        _bindAnnouncementItemClicks(root, announcements) {
            if (!root || !announcements || announcements.length === 0) return;
            root.querySelectorAll('.announcement-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.getAttribute('data-index'));
                    const announcement = announcements[index];
                    this.openAnnouncementPopup(announcement);
                });
            });
        }

        // 显示公告列表
        _showAnnouncementList(announcements) {
            const oldListPopup = document.getElementById('AnnouncementListPopup');
            if (oldListPopup) oldListPopup.remove();

            const listPopup = document.createElement('div');
            listPopup.id = 'AnnouncementListPopup';
            listPopup.style.display = 'none';
            listPopup.style.opacity = '0';
            listPopup.className = 'announcement-list-container';
            listPopup.innerHTML = `
                <div class="announcement-list-content">
                    <div class="announcement-list-header">
                        <h2 class="announcement-list-title">📢 系统通知</h2>
                        <button class="announcement-list-close" id="announcementListClose">×</button>
                    </div>
                    <div class="announcement-list-body">
                        ${this._renderAnnouncementListBody(announcements)}
                    </div>
                </div>
            `;

            document.body.appendChild(listPopup);
            this._setAnnouncementBackHandler('list');

            setTimeout(() => {
                listPopup.style.display = 'flex';
                setTimeout(() => listPopup.style.opacity = '1', 10);
            }, 100);

            document.getElementById('announcementListClose').addEventListener('click', () => {
                this._closeAnnouncementList(listPopup);
            });
            listPopup.addEventListener('click', (e) => {
                if (e.target === listPopup) this._closeAnnouncementList(listPopup);
            });
            this._bindAnnouncementItemClicks(listPopup, announcements);
        }

        // 刷新公告列表
        _refreshAnnouncementList(announcements) {
            const listPopup = document.getElementById('AnnouncementListPopup');
            if (!listPopup) return;
            const listBody = listPopup.querySelector('.announcement-list-body');
            if (!listBody) return;
            listBody.innerHTML = this._renderAnnouncementListBody(announcements);
            this._bindAnnouncementItemClicks(listBody, announcements);
        }

        // 关闭公告列表
        _closeAnnouncementList(listPopup) {
            listPopup.style.opacity = '0';
            setTimeout(() => {
                if (listPopup.parentNode) listPopup.parentNode.removeChild(listPopup);
            }, 300);

            this._setAnnouncementBackHandler('clear');
        }

        closeAnnouncementList() {
            const listPopup = document.getElementById('AnnouncementListPopup');
            if (listPopup) this._closeAnnouncementList(listPopup);
        }

        closeAnnouncementPopup() {
            const popup = document.getElementById('AnnouncementPopup');
            if (!popup) return;
            const id = popup.dataset ? popup.dataset.announcementId : '';
            this._closeAnnouncementPopup(popup, id || null);
        }

        _setAnnouncementBackHandler(mode) {
            if (typeof webapp === 'undefined' || typeof webapp.自定义返回键 !== 'function') return;
            if (mode === 'popup') {
                webapp.自定义返回键('if(window.DxxSystem&&DxxSystem.closeAnnouncementPopup){DxxSystem.closeAnnouncementPopup();}');
                return;
            }
            if (mode === 'list') {
                webapp.自定义返回键('if(window.DxxSystem&&DxxSystem.closeAnnouncementList){DxxSystem.closeAnnouncementList();}');
                return;
            }
            webapp.自定义返回键('');
        }

        async handleImageClick(elementType, imageUrl) {
            if (typeof webapp !== 'undefined') webapp.toast('正在保存图片...');
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `donate_${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(blobUrl);
                    if (typeof webapp !== 'undefined') {
                        if (imageUrl.includes('33a0542b1403bb94') || imageUrl.includes('wechat')) webapp.启动指定应用('com.tencent.mm');
                        else if (imageUrl.includes('1565fff5085e314b') || imageUrl.includes('alipay')) webapp.启动指定应用('com.eg.android.AlipayGphone');
                    }
                }, 2000);
            } catch (e) {
                if (typeof webapp !== 'undefined') webapp.toast('保存失败');
            }
        }
    }
    const appSystem = new SystemApp();
    window.DxxSystem = {
        checkUpdate: () => appSystem.checkUpdate(),
        showUpdateLog: () => appSystem.showUpdateLog(),
        openSponsor: () => appSystem.openSponsor(),
        getVersion: () => appSystem.state.currentVersion,
        getHitokoto: () => appSystem.state.hitokoto,
        getUpdateLog: () => appSystem.getUpdateLog(),
        verify: () => appSystem._verifyIntegrity(),
        // 公告相关接口
        getAnnouncements: () => appSystem.getAnnouncements(),
        openAnnouncementPopup: (announcement) => appSystem.openAnnouncementPopup(announcement),
        checkPopupAnnouncements: () => appSystem.checkPopupAnnouncements(),
        openAnnouncementList: () => appSystem.openAnnouncementList(),
        closeAnnouncementList: () => appSystem.closeAnnouncementList(),
        closeAnnouncementPopup: () => appSystem.closeAnnouncementPopup()
    };

})(window, document);

/* ---- app/config/00-00-config-helpers.js ---- */
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

/* ---- app/core/01-storage-service.js ---- */
/* v3 semantic split: class from js/app/01-storage-quota.js | keep script order */
        class StorageService {
            static async init() {
                // 动态获取版本号，确保与 DxxSystem 保持一致
                const sysVersion = (window.DxxSystem && typeof DxxSystem.getVersion === 'function')
                    ? DxxSystem.getVersion()
                    : '2.0';

                localforage.config({
                    driver: localforage.INDEXEDDB, // 强制使用 IndexedDB
                    name: 'DouXiuXiuApp',
                    // IndexedDB 要求 version 为数字，因此这里进行转换
                    version: parseFloat(sysVersion),
                    storeName: 'dxx_store',
                    description: 'DouXiuXiu Main Storage'
                });
                await localforage.ready();
            }

            static async get(key, defaultValue = null) {
                try {
                    const val = await localforage.getItem(key);
                    return val === null ? defaultValue : val;
                } catch (e) {
                    console.error(`[DB Read Error] ${key}:`, e);
                    return defaultValue;
                }
            }

            static async set(key, value) {
                try {
                    await localforage.setItem(key, value);
                    return true;
                } catch (e) {
                    console.error(`[DB Write Error] ${key}:`, e);
                    return false;
                }
            }

            static async remove(key) {
                await localforage.removeItem(key);
            }

            static async clear() {
                await localforage.clear();
            }

            // 获取所有数据的大小（估算）
            static async getStorageUsage() {
                let totalSize = 0;
                try {
                    let keys = await localforage.keys();
                    for (const key of keys) {
                        const val = await localforage.getItem(key);
                        if (val) {
                            // 粗略估算 JSON 字符串长度 * 2 字节
                            totalSize += JSON.stringify(val).length * 2;
                        }
                    }
                } catch (e) {
                    console.warn("Storage usage calc error:", e);
                }
                return totalSize;
            }
        }
        // --- 积分/口令管理器 (修复版：适配 DB) ---

/* ---- app/core/02-quota-manager.js ---- */
/* v3 semantic split: class from js/app/01-storage-quota.js | keep script order */
        class QuotaManager {
            constructor() {

                // 初始默认值，稍后在 init 中加载
                this.quota = 99999;
                this.usedTokens = [];

                // 自动初始化
                this.init();
            }

            async init() {
                // 读取 DB
                this.quota = await StorageService.get('dxx_quota', 99999);
                this.usedTokens = await StorageService.get('dxx_used_tokens', []);
                this.updateUI();
            }

            get() { return this.quota; }

            consume(amount = 1) {
                if (this.quota >= amount) {
                    this.quota -= amount;
                    this.save();
                    return true;
                }
                return false;
            }

            add(amount) {
                this.quota += amount;
                this.save();
                app.interaction.showToast(`成功增加 ${amount} 次下载机会`);
            }

            // 异步保存
            async save() {
                await StorageService.set('dxx_quota', this.quota);
                await StorageService.set('dxx_used_tokens', this.usedTokens);
                this.updateUI();
            }

            updateUI() {
                const el = document.getElementById('quota-display');
                if (el) el.innerText = this.quota;
            }

            openTokenModal() {
                document.getElementById('token-modal').classList.add('active');
                document.getElementById('token-modal-mask').classList.add('active');
            }
            closeTokenModal() {
                document.getElementById('token-modal').classList.remove('active');
                document.getElementById('token-modal-mask').classList.remove('active');
            }



            async verifyToken() {
                const input = document.getElementById('token-input-field');
                const btn = document.querySelector('#token-modal .submit-btn');
                const token = input.value.trim();

                if (!token) return app.interaction.showToast('请输入口令');
                if (this.usedTokens.includes(token)) return app.interaction.showToast('该口令您已使用过');

                const originalText = btn.innerText;
                btn.innerText = '验证中...';
                btn.disabled = true;

                try {
                    // 使用新 API 模块
                    const result = await Api.Quota.verifyToken(token);
                    const res = result.raw;

                    if (res.code === 200) {
                        // 使用新解密工具
                        const decryptedData = await Api.Quota.decryptData(res.data, res.iv);

                        if (decryptedData && decryptedData.quota) {
                            const reward = parseInt(decryptedData.quota);
                            this.quota += reward;
                            this.usedTokens.push(token);
                            await this.save();

                            app.interaction.showToast(`成功增加 ${reward} 次`);
                            this.closeTokenModal();
                            input.value = '';
                        } else {
                            app.interaction.showToast('数据解密异常');
                        }
                    } else {
                        app.interaction.showToast(res.msg || '验证失败');
                    }
                } catch (error) {
                    console.error(error);
                    app.interaction.showToast('网络请求错误');
                } finally {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            }
        }
        /* --- 1.1 智能图片加载器 (优化版) --- */

/* ---- app/loaders/03-smart-image-loader.js ---- */
/* v3 semantic split: class from js/app/02-smart-loaders.js | keep script order */
        class SmartImageLoader {
            constructor() {
                this.galleryTimers = new Map();
            }

            loadImage(imgEl, priority = 'low') {
                if (!imgEl || imgEl.src || !imgEl.dataset.src) return;
                imgEl.decoding = 'async';

                if (priority === 'high') {
                    imgEl.src = imgEl.dataset.src;
                    imgEl.classList.add('loaded');
                } else {
                    requestAnimationFrame(() => {
                        imgEl.src = imgEl.dataset.src;
                        imgEl.onload = () => imgEl.classList.add('loaded');
                    });
                }
            }

            preloadSlide(slide) {
                const poster = slide.querySelector('.lazy-media[data-src]');
                if (poster && !poster.classList.contains('video-player')) {
                    this.loadImage(poster, 'low');
                }
                // 预加载前几张
                const initImages = slide.querySelectorAll('.gallery-swiper .swiper-slide:nth-child(-n+' + CONFIG.GALLERY_INIT_LIMIT + ') img[data-src]');
                initImages.forEach(img => this.loadImage(img, 'low'));
            }

            activateSlide(slide) {
                const images = slide.querySelectorAll('img[data-src].init-load');
                images.forEach(img => this.loadImage(img, 'high'));
                const audio = slide.querySelector('audio.bgm-audio');
                if (audio) audio.preload = "auto";
            }

            /**
             * 图集分批加载逻辑 (优化：支持强制加载剩余所有)
             * @param {Object} gallerySwiper Swiper实例
             * @param {Boolean} forceLoadAll 是否强制立即加载剩余所有
             */
            loadGalleryBatch(gallerySwiper, forceLoadAll = false) {
                const slide = gallerySwiper.el.closest('.swiper-slide');
                const wrapper = gallerySwiper.el.querySelector('.swiper-wrapper');
                // 获取或生成唯一ID
                const uid = slide.dataset.uid || Math.random().toString(36).substr(2);
                slide.dataset.uid = uid;

                // 如果已经全部加载完毕，直接返回
                if (slide.dataset.galleryLoaded === 'true') return;

                const lazyImages = Array.from(gallerySwiper.el.querySelectorAll('img[data-src]:not([src])'));

                if (lazyImages.length === 0) {
                    slide.dataset.galleryLoaded = 'true';
                    return;
                }

                // --- 核心优化逻辑开始 ---
                if (forceLoadAll) {
                    // 1. 如果有正在进行的定时任务，立即清除，防止冲突
                    if (this.galleryTimers.has(uid)) {
                        clearTimeout(this.galleryTimers.get(uid));
                        this.galleryTimers.delete(uid);
                    }

                    // 2. 立即循环加载剩余所有图片，并设置为高优先级
                    console.log(`[SmartLoader] 触发极速加载模式，剩余 ${lazyImages.length} 张`);
                    lazyImages.forEach(img => {
                        this.loadImage(img, 'high'); // high 优先级会立即赋值 src
                    });

                    // 3. 标记该图集已完全加载
                    slide.dataset.galleryLoaded = 'true';
                    gallerySwiper.update(); // 通知Swiper更新DOM
                    return;
                }
                // --- 核心优化逻辑结束 ---

                // 下面是原有的分批慢速加载逻辑（用于刚开始浏览时，节省流量）
                if (this.galleryTimers.has(uid)) return; // 如果已有任务在跑，不重复触发

                let loadedCount = 0;
                const total = lazyImages.length;

                const loadNext = () => {
                    const end = Math.min(loadedCount + CONFIG.GALLERY_BATCH_SIZE, total);
                    for (let i = loadedCount; i < end; i++) {
                        this.loadImage(lazyImages[i], 'low');
                    }
                    if (gallerySwiper) gallerySwiper.update();

                    loadedCount = end;
                    if (loadedCount < total) {
                        // 继续下一批
                        const timer = setTimeout(loadNext, CONFIG.GALLERY_BATCH_INTERVAL);
                        this.galleryTimers.set(uid, timer);
                    } else {
                        slide.dataset.galleryLoaded = 'true';
                        this.galleryTimers.delete(uid);
                    }
                };

                loadNext();
            }

            unload(slide) {
                const uid = slide.dataset.uid;
                if (uid && this.galleryTimers.has(uid)) {
                    clearTimeout(this.galleryTimers.get(uid));
                    this.galleryTimers.delete(uid);
                }
            }
        }

        // --- 1.2 智能视频加载器 (节流+流畅优化版) ---

/* ---- app/loaders/04-smart-video-loader.js ---- */
/* v3 semantic split: class from js/app/02-smart-loaders.js | keep script order */
        class SmartVideoLoader {
            constructor() {
                this.retryMap = new Map();
                //用于存储预加载升级的定时器
                this.upgradeTimers = new Map();
                // 配置：用户停留多久后，才开始下载下一个视频的实体内容 (毫秒)
                // 设为 1500ms，既保证了快速划过不费流量，又保证了正常观看时下一个视频有时间缓冲
                this.UPGRADE_DELAY = 1500;
            }

            /**
             * 激活视频：当前播放的视频 (最高优先级)
             */
            activate(video) {
                if (!video) return;

                // 1. 如果有待定升级的定时器，立即清除（因为已经滑到这里了，必须马上加载）
                this.clearUpgradeTimer(video);

                // 2. 确保 src 存在
                const nextSrc = video.dataset.src || '';
                const currentSrc = video.getAttribute('src') || '';
                if (nextSrc && currentSrc !== nextSrc) {
                    video.src = nextSrc;
                    // 显式 load，避免仅设置 src 后部分 WebView 保持 metadata/loading 状态。
                    try { video.load(); } catch (e) { }
                }

                // 3. 核心：强制设为 auto 并立即加载
                // 即使之前是 metadata，现在必须全力下载
                if (video.preload !== "auto") {
                    video.preload = "auto";
                }

                // 4. 绑定重试逻辑
                this.bindRetry(video);
            }

            /**
             * 预加载视频：下一个视频 (智能节流策略)
             */
            preload(video) {
                if (!video) return;

                // 1. 基础检查：如果已经有 src 且是 auto，说明已经是激活状态或已升级，无需处理
                if (video.getAttribute('src') === video.dataset.src && video.preload === "auto") {
                    return;
                }

                // 2. 检查网络连接状态，避免在弱网环境下过度预加载
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                if (connection) {
                    // 如果是慢速网络，减少预加载
                    if (connection.downlink < 1.5 || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                        console.log('[SmartLoader] 慢速网络，跳过预加载');
                        return;
                    }
                }

                // 3. 阶段一：轻量级预加载 (只加载元数据)
                // 目的：获取时长、尺寸，让黑屏有 loading 且不塌陷，但不费流量
                if (video.getAttribute('src') !== video.dataset.src) {
                    video.src = video.dataset.src;
                }
                video.preload = "metadata";

                // 绑定错误处理（元数据加载也可能失败）
                this.bindRetry(video);

                // 4. 阶段二：设置定时器，延迟升级为 auto (缓冲实体)
                // 只有当用户在当前视频停留超过 UPGRADE_DELAY 时，才去下载这个视频
                this.clearUpgradeTimer(video); // 防止重复设置

                const timer = setTimeout(() => {
                    // 再次检查视频是否还存在且未被卸载
                    if (video.dataset.src && video.getAttribute('src')) {
                        console.log(`[SmartLoader] 用户停留，升级预加载: ${video.dataset.src.substring(0, 20)}...`);
                        video.preload = "auto";
                        // 某些浏览器修改 preload 后需要显式调用 load() 或 play() 才能生效，
                        // 但 play() 会直接播放。通常修改属性浏览器会自动处理缓冲策略。
                        // 如果发现不缓冲，可以不操作，现代浏览器对 auto 很敏感。
                    }
                }, this.UPGRADE_DELAY);

                this.upgradeTimers.set(video, timer);
            }

            /**
             * 卸载视频：远离屏幕的视频
             */
            unload(video) {
                if (!video) return;

                // 1. 清除任何正在等待的升级定时器 (关键：防止滑走后还在后台悄悄开始下载)
                this.clearUpgradeTimer(video);

                if (!video.getAttribute('src')) return;

                // 2. 停止网络请求
                video.removeAttribute('src');
                video.load(); // 必须调用，否则连接可能不会立即断开
                // --- 新增：移除 ready 类 ---
                video.classList.remove('ready');
                video.style.opacity = '1';
                // 3. 重置状态
                video.classList.remove('loaded');
                video.style.opacity = '0'; // 恢复透明，显示加载圈
                video.preload = "metadata"; // 重置为默认

                // 4. 重置UI
                const container = video.closest('.media-container');
                if (container) {
                    const loader = container.querySelector('.loader');
                    if (loader) loader.style.display = 'block';
                    const errTip = container.querySelector('.video-error');
                    if (errTip) errTip.style.display = 'none';
                }

                // 5. 清理重试记录
                const src = video.dataset.src;
                if (src && this.retryMap.has(src)) {
                    clearTimeout(this.retryMap.get(src).timer);
                    this.retryMap.delete(src);
                }
            }

            // 辅助：清除升级定时器
            clearUpgradeTimer(video) {
                if (this.upgradeTimers.has(video)) {
                    clearTimeout(this.upgradeTimers.get(video));
                    this.upgradeTimers.delete(video);
                }
            }

            bindRetry(video) {
                if (video.hasAttribute('data-retry-bound')) return;
                video.setAttribute('data-retry-bound', 'true');

                video.onerror = () => {
                    const src = video.dataset.src;
                    // 如果已经被unload了(src被移除)，就不报错了
                    if (!src || !video.getAttribute('src')) return;

                    let retryInfo = this.retryMap.get(src) || { count: 0, timer: null };

                    // 使用全局配置或默认值
                    const maxRetry = (typeof CONFIG !== 'undefined' && CONFIG.VIDEO_RETRY_MAX) ? CONFIG.VIDEO_RETRY_MAX : 3;
                    const retryDelay = (typeof CONFIG !== 'undefined' && CONFIG.VIDEO_RETRY_DELAY) ? CONFIG.VIDEO_RETRY_DELAY : 2000;

                    // 区分预加载错误和播放错误：预加载错误不立即重试，等待实际播放时再重试
                    const activeSlide = video.closest('.swiper-slide');
                    const isPreloadError = video.preload === "metadata" && !(activeSlide && activeSlide.classList.contains('swiper-slide-active'));

                    if (isPreloadError) {
                        console.warn(`预加载失败 (不重试，等待播放时重试): ${src}`);
                        // 预加载错误不立即重试，等待实际播放时再处理。
                        return;
                    }

                    if (retryInfo.count < maxRetry) {
                        console.warn(`Video load error, retrying (${retryInfo.count + 1}/${maxRetry}): ${src}`);
                        retryInfo.count++;

                        // 延迟重试
                        retryInfo.timer = setTimeout(() => {
                            // 仅重置 src 来触发重试，不重载整个页面/组件
                            const tempSrc = video.src;
                            video.src = "";
                            video.load();
                            setTimeout(() => {
                                video.src = tempSrc;
                                video.load();
                                if (video.parentElement.classList.contains('swiper-slide-active')) {
                                    video.play().catch(() => { });
                                }
                            }, 100);
                        }, retryDelay);

                        this.retryMap.set(src, retryInfo);
                    } else {
                        // 超过重试次数，显示错误UI
                        this.showErrorUI(video);
                    }
                };

                // 监听元数据加载完成 (metadata 阶段就会触发)
                video.onloadedmetadata = () => {
                    // 可以在这里做一些布局调整，比如获取到了真实宽高
                    if (window.app && typeof app.adjustLayout === 'function') app.adjustLayout(video);
                    if (window.app && typeof app.syncVideoSrcWithData === 'function') app.syncVideoSrcWithData(video);
                };

                // 监听可以播放 (auto 阶段缓冲足够后触发)
                video.oncanplay = () => {
                    const container = video.closest('.media-container');
                    if (container) {
                        // 隐藏 Loading 圈
                        const loader = container.querySelector('.loader');
                        if (loader) loader.style.display = 'none';
                        const errTip = container.querySelector('.video-error');
                        if (errTip) errTip.style.display = 'none';
                    }

                    // 添加 ready 类，触发 CSS opacity 0->1 的过渡
                    video.classList.add('ready');
                    // 兼容旧逻辑
                    video.style.opacity = '1';

                    // 成功后清除重试记录
                    const src = video.dataset.src;
                    if (this.retryMap.has(src)) this.retryMap.delete(src);
                };

            }

            showErrorUI(video) {
                const container = video.closest('.media-container');
                if (container) {
                    const loader = container.querySelector('.loader');
                    if (loader) loader.style.display = 'none';
                    const errTip = container.querySelector('.video-error');
                    if (errTip) errTip.style.display = 'block';
                }
            }
        }

        // --- 1.3 资源协调器 (Facade模式) ---
        // --- 1.3 资源协调器 (节流+分级加载版) ---

/* ---- app/loaders/05-resource-coordinator.js ---- */
/* v3 semantic split: class from js/app/02-smart-loaders.js | keep script order */
        class ResourceCoordinator {
            constructor() {
                this.imgLoader = new SmartImageLoader();
                this.videoLoader = new SmartVideoLoader();
            }

            /**
             * 处理滑动资源加载
             * @param {Object} swiper Swiper实例
             * @param {Boolean} isFastScroll 是否为快速滑动模式
             */
            handleSlideChange(swiper, isFastScroll) {
                const activeIndex = swiper.activeIndex;
                const slides = swiper.slides;
                const total = slides.length;

                const currentSlide = slides[activeIndex];

                // 1. 标记当前 Slide 已处理 (用于 touchEnd 补救)
                // 快速滑动时这里只加载封面，不应标记 processed，否则 touchEnd/停顿补救不会再激活视频，
                // 会造成主页面一直显示 loading，而横屏页可以播放的错觉。
                if (isFastScroll) {
                    currentSlide.classList.remove('processed');
                    currentSlide.dataset.lightProcessed = 'true';
                } else {
                    currentSlide.classList.add('processed');
                    delete currentSlide.dataset.lightProcessed;
                }

                // 2. 视觉优化：给容器添加 loaded 类，触发 CSS 渐入动画
                const container = currentSlide.querySelector('.media-container');
                if (container) {
                    // 强制重绘以触发动画
                    requestAnimationFrame(() => container.classList.add('loaded'));
                }

                // 3. 进入 slide 时异步检测视频尺寸，决定是否显示全屏按钮
                if (window.app && typeof app.detectLandscapeBtnForSlide === 'function') {
                    app.detectLandscapeBtnForSlide(currentSlide);
                }

                if (isFastScroll) {
                    // === 快速滑动模式 ===
                    // 策略：只加载当前页的封面图，不加载视频流，不预加载下一页
                    // 这样可以极大减少网络阻塞和卡顿
                    this.processSlide(currentSlide, 'poster-only');

                    // 快速清理远离的资源
                    this.cleanup(slides, activeIndex, 2);
                } else {
                    // === 正常浏览模式 ===

                    // A. 当前页：完全激活 (加载视频、原图)
                    this.processSlide(currentSlide, 'active');

                    // B. 下一页：预加载 (延迟执行，优先保证当前页带宽)
                    if (activeIndex + 1 < total) {
                        // 使用 setTimeout 将预加载任务放入宏任务队列，让当前视频先开始缓冲
                        setTimeout(() => {
                            this.processSlide(slides[activeIndex + 1], 'preload');
                        }, 500);
                    }

                    // C. 清理更远的资源
                    this.cleanup(slides, activeIndex, CONFIG.UNLOAD_DISTANCE || 3);
                }
            }

            processSlide(slide, state) {
                const video = slide.querySelector('video');
                const gallerySwiper = slide.querySelector('.gallery-swiper');
                const audio = slide.querySelector('audio.bgm-audio');
                const poster = slide.querySelector('.lazy-media'); // 封面图

                if (state === 'poster-only') {
                    // 只加载封面，不加载视频实体
                    if (poster && poster.tagName === 'IMG' && !poster.classList.contains('video-player')) {
                        this.imgLoader.loadImage(poster, 'high');
                    }
                    if (video) {
                        // 确保视频不加载
                        video.removeAttribute('src');
                        video.load();
                    }
                }
                else if (state === 'active') {
                    // 激活：加载视频并播放
                    if (video) this.videoLoader.activate(video);

                    this.imgLoader.activateSlide(slide);

                    // 图集加载
                    if (gallerySwiper && gallerySwiper.swiper) {
                        this.imgLoader.loadGalleryBatch(gallerySwiper.swiper, true); // 强制加载当前图集
                    }
                }
                else if (state === 'preload') {
                    // 预加载：仅缓冲 Metadata 或首帧
                    if (video) this.videoLoader.preload(video);
                    this.imgLoader.preloadSlide(slide);
                    if (audio) audio.preload = "auto";
                }
            }

            cleanup(slides, activeIndex, distance) {
                for (let i = 0; i < slides.length; i++) {
                    if (Math.abs(i - activeIndex) > distance) {
                        const slide = slides[i];
                        const video = slide.querySelector('video');

                        // 移除视觉类，以便下次滑回来时重新触发渐入
                        const container = slide.querySelector('.media-container');
                        if (container) container.classList.remove('loaded');
                        slide.classList.remove('processed');

                        if (video) this.videoLoader.unload(video);
                        this.imgLoader.unload(slide);
                    }
                }
            }

            onGallerySlideChange(gallerySwiper) {
                // 图集内部滑动逻辑保持不变
                const currentIndex = gallerySwiper.realIndex;
                if (currentIndex >= 2) {
                    this.imgLoader.loadGalleryBatch(gallerySwiper, true);
                } else if (currentIndex >= 1) {
                    this.imgLoader.loadGalleryBatch(gallerySwiper, false);
                }
            }
        }
        // --- 1.4 听歌识曲控制器 ---

/* ---- app/features/music/06-music-recognizer.js ---- */
/* v3 semantic split: class from js/app/03-music-renderer-profile.js | keep script order */
        class MusicRecognizer {
            constructor() {
                this.isListening = false;
                this.mediaStream = null;
                this.mockTimer = null;

                // 模拟识别结果库 (实际开发可对接 ACRCloud 或 Shazam API)
                this.mockDatabase = [
                    { title: "晴天", author: "周杰伦" },
                    { title: "Shape of You", author: "Ed Sheeran" },
                    { title: "起风了", author: "买辣椒也用券" },
                    { title: "Stay", author: "The Kid LAROI / Justin Bieber" },
                    { title: "悬溺", author: "葛东琪" }
                ];
            }

            async toggleListen() {
                if (this.isListening) {
                    this.stopListening();
                } else {
                    await this.startListening();
                }
            }

            async startListening() {
                const btn = document.getElementById('listen-btn');
                const statusText = document.getElementById('listen-btn-text');

                try {
                    // 1. 请求麦克风权限
                    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

                    // 2. 更新 UI 状态
                    this.isListening = true;
                    if (btn) btn.classList.add('listening');
                    if (statusText) {
                        statusText.innerText = "识别中...";
                    }

                    // 3. 开始模拟识别 (倒计时 3-5秒)
                    // 在这里如果是真实项目，应该录制 Blob 并上传到后端 API
                    const delay = 3000 + Math.random() * 2000;

                    this.mockTimer = setTimeout(() => {
                        this.analyzeSuccess();
                    }, delay);

                } catch (err) {
                    console.error("Microphone access denied:", err);
                    alert("无法获取麦克风权限，请在浏览器设置中允许后重试。");
                    this.stopListening();
                }
            }

            stopListening() {
                this.isListening = false;

                // 停止音频流
                if (this.mediaStream) {
                    this.mediaStream.getTracks().forEach(track => track.stop());
                    this.mediaStream = null;
                }

                if (this.mockTimer) clearTimeout(this.mockTimer);

                // 恢复 UI
                const btn = document.getElementById('listen-btn');
                const statusText = document.getElementById('listen-btn-text');
                if (btn) {
                    btn.classList.remove('listening');
                    btn.classList.remove('pending');
                }
                if (statusText) statusText.innerText = "听歌识曲";
            }

            // 模拟搜歌 API (实际开发请替换为真实后端接口)
            // 这里为了演示效果，返回网易云音乐的真实试听链接
            async fetchFullSongData(title, author) {
                // 模拟网络请求延迟
                await new Promise(r => setTimeout(r, 800));

                // 演示用的映射表 (歌名 -> 网易云ID)
                // 实际项目中，这里应该是 fetch('https://api.xxx.com/search?q=' + title)
                const demoMap = {
                    "晴天": 186016,
                    "Shape of You": 468176887,
                    "起风了": 1330348068,
                    "Stay": 1859245776,
                    "悬溺": 1397345903
                };

                // 默认 ID (如果没匹配到，就用“晴天”)
                const id = demoMap[title] || 186016;

                return {
                    title: title,
                    author: author,
                    // 网易云直链 (仅供学习演示)
                    url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
                    // 模拟一个时长 (实际应从 API 获取)
                    duration: "04:30"
                };
            }

            async analyzeSuccess() {
                this.stopListening();

                // 1. 随机获取一个识别结果 (模拟 ACRCloud/Shazam 的返回)
                const result = this.mockDatabase[Math.floor(Math.random() * this.mockDatabase.length)];

                app.interaction.showToast(`识别到：${result.title}，正在获取资源...`);

                const card = document.getElementById('music-card-anim');
                const statusText = document.getElementById('listen-btn-text');
                const btn = document.getElementById('listen-btn');

                if (btn) btn.classList.add('pending');
                if (statusText) statusText.innerText = "获取中...";
                if (card) card.style.transform = 'scale(0.95)';

                try {
                    // 2. 调用搜歌 API 获取 MP3 链接
                    const songData = await this.fetchFullSongData(result.title, result.author);

                    // 3. 核心：更新全局数据
                    // 找到当前正在播放的作品数据
                    const currentIdx = app.mainSwiper.activeIndex;
                    const workData = app.fullPlaylist[currentIdx];

                    // 覆盖原有的 music_info
                    workData.music_info = {
                        title: songData.title,
                        author: songData.author,
                        url: songData.url
                    };
                    // 如果有 duration 也可以更新
                    if (songData.duration) {
                        workData.duration = songData.duration;
                    }

                    // 4. 刷新音乐页面 UI (让下载按钮和播放器生效)
                    if (app.pageManager) {
                        app.pageManager.refreshMusicInfo(workData);

                        // 自动开始播放新识别的歌曲 (可选体验优化)
                        const audio = document.querySelector('.swiper-slide-active .bgm-audio');
                        if (audio) {
                            audio.src = songData.url;
                            audio.play();
                            app.mediaManager.currentMedia = audio; // 接管播放控制
                            app.mediaManager.updatePlayBtnState(true);
                        }
                    }

                    app.interaction.showToast('资源获取成功，可播放或下载');

                } catch (e) {
                    console.error(e);
                    app.interaction.showToast('搜歌失败，请重试');
                } finally {
                    // 恢复 UI 动画
                    if (card) {
                        card.style.transform = 'scale(1)';
                    }
                    if (btn) btn.classList.remove('pending');
                    if (statusText) statusText.innerText = "听歌识曲";
                }
            }
        }
        function getReleaseTimeText(item) {
            return item.create_time || item.time || '';
        }

        function buildTitleSectionHtml(item, options = {}) {
            let titleText = item.title || '';
            if (titleText === '无标题') titleText = '';
            const timeText = getReleaseTimeText(item);
            const showTime = options.showReleaseTimeTag !== false;
            const timeHtml = (showTime && timeText) ? `<span class="release-time-tag"><i class="fa-regular fa-clock"></i>${timeText}</span>` : '';
            const adButtonHtml = item.is_ad ? `<span class="ad-combined-btn" onclick="window.open('${item.ad_link}', '_blank'); event.stopPropagation();"><span>广告</span><i class="fa-solid fa-arrow-right"></i></span>` : '';
            const safeFullText = titleText.replace(/"/g, '&quot;');
            const enableToggle = options.enableToggle !== false;
            const maxLength = (typeof options.maxLength === 'number' && options.maxLength > 0) ? options.maxLength : 35;

            if (!enableToggle) {
                return `<div class="desc-text-container"><div class="desc-text">${adButtonHtml}${titleText}${timeHtml}</div></div>`;
            }

            if (titleText.length > maxLength) {
                const shortText = titleText.substring(0, maxLength) + '...';
                return `<div class="desc-text-container"><div class="desc-text" data-full-text="${safeFullText}" data-time="${timeText}" onclick="app.interaction.toggleDesc(this, event)">${adButtonHtml}${shortText}${timeHtml}<span class="expand-btn">展开</span></div></div>`;
            }
            return `<div class="desc-text-container"><div class="desc-text">${adButtonHtml}${titleText}${timeHtml}</div></div>`;
        }
        // --- 2. 渲染器 ---

/* ---- app/render/07-renderer.js ---- */
/* v3 semantic split: class from js/app/03-music-renderer-profile.js | keep script order */
        class Renderer {
            constructor(containerId) {
                this.container = document.getElementById(containerId);
                this.sidebarCollection = 'all';
                this.sidebarCollectionExpanded = false;
                this.sidebarViewMode = 'list';
                this.lastMiniMarkup = '';
                this.lastMiniTitle = '';
                this.lastMiniSize = null;
            }
            formatNumber(num) { num = Number(num) || 0; return num > 10000 ? (num / 10000).toFixed(1) + 'w' : num; }
            createSlideHtml(item, index) {
                const idText = String(item.id || '');
                const isLocal = (idText.includes('local-') || item.is_local);
                const type = item.type || '视频';
                const url = item.url || '';
                let avatarUrl = item.avatar;

                // 如果当前作品对象里没带头像，去全局缓存里找这个作者的头像
                if (!avatarUrl || avatarUrl === 'null' || avatarUrl.includes('${')) {
                    if (window.app && app.dataLoader && app.dataLoader.globalCreators) {
                        const creator = app.dataLoader.globalCreators[item.author];
                        if (creator && creator.info && creator.info.avatar) {
                            avatarUrl = creator.info.avatar;
                        }
                    }
                }

                // 本地资源头像统一为随机头像
                if (isLocal) {
                    avatarUrl = getDiceBearAvatar(item.author || 'Guest');
                }

                // 如果还没找到，或者找到的是无效字符串，最后才用随机头像
                if (!avatarUrl || avatarUrl === 'null' || avatarUrl === '') {
                    avatarUrl = getDiceBearAvatar(item.author);
                }
                const hideLocalTimeTag = !!(isLocal || item.is_local || item.local_type || (item.info && item.info.origin_type === 'local'));
                const titleSectionHtml = buildTitleSectionHtml(item, { showReleaseTimeTag: !hideLocalTimeTag });



                // 媒体容器
                let mediaHtml = '';
                const musicStyleKey = String((typeof CONFIG !== 'undefined' && CONFIG.LOCAL_MUSIC_SLIDE_STYLE) ? CONFIG.LOCAL_MUSIC_SLIDE_STYLE : '1');
                const musicStyleClass = `local-music-style-${musicStyleKey}`;
                if (type === '音乐' || (isLocal && idText.includes('music'))) {
                    const cover = item.cover || getDiceBearAvatar(item.author);
                    mediaHtml = `
            <div class="local-music-container ${musicStyleClass}">
                <div class="music-bg" style="background-image: url('${cover}')"></div>
                <div class="music-bg-overlay"></div>
                <div class="music-disk-wrapper">
                    <div class="music-disk" style="background-image: url('${cover}')"></div>
                    <div class="music-center"></div>
                </div>
                <div class="music-eq" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span>
                </div>

            </div>`;
                } else if (type === '视频') {
                    mediaHtml = `
            <div class="media-container" style="background-color:#000;">
                
                <div class="loader"></div>
                <div class="video-error"><i class="fa-solid fa-circle-exclamation"></i>加载失败</div>
                <video class="video-player lazy-media" 
                    data-src="${url}" 
                    crossorigin="anonymous"
                    poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" 
                    playsinline webkit-playsinline 
                    preload="metadata" 
                    style="object-fit: contain;" 
                    onloadeddata="app.captureSlidePoster(this)"
                    onloadedmetadata="app.adjustLayout(this); app.syncVideoSrcWithData(this);"
                    oncanplay="this.classList.add('loaded'); this.parentElement.querySelector('.loader').style.display='none';"
                    onerror="this.parentElement.querySelector('.loader').style.display='none'; this.parentElement.querySelector('.video-error').style.display='block';"
                    onended="app.handleVideoEnded(this)">
                </video>
            </div>`;
                } else {
                    const imagesHtml = (item.images || []).map((img, imgIdx) => {
                        const src = Array.isArray(img) ? img[img.length - 1] : img;
                        const initClass = imgIdx < CONFIG.GALLERY_INIT_LIMIT ? 'init-load' : '';
                        return `<div class="swiper-slide"><div class="media-container" style="background-color:#000;"><img class="lazy-media ${initClass}" data-src="${src}" decoding="async" onload="app.adjustLayout(this)"/></div></div>`;
                    }).join('');
                    mediaHtml = `<div class="swiper gallery-swiper gallery-${index}" style="width:100%;height:100%;"><div class="swiper-wrapper">${imagesHtml}</div></div>`;
                }

                const audioHtml = (item.music_info?.url) ? `<audio class="bgm-audio" preload="none" src="${item.music_info.url}" loop></audio>` : '';
                const isLiked = app.userDataManager ? app.userDataManager.isLiked(item) : false;
                const isFav = app.userDataManager ? app.userDataManager.isFavorite(item) : false;
                const musicTitle = item.music_info ? `${item.music_info.title} - ${item.music_info.author}` : '作品配乐';



                return `
        ${mediaHtml} ${audioHtml}
        <div class="play-overlay"><i class="fa-solid fa-play"></i></div>
        <div class="landscape-toggle-btn" onclick="app.landscapePlayer.toggle()">
            <i class="fa-solid fa-expand"></i>
            <span>全屏</span>
        </div>
            <div class="info-layer">
            <div class="desc-wrapper">${titleSectionHtml}</div>
            <div class="meta-row">
                <div class="author-info" onclick="app.openProfile('${item.author}')">
                    <img src="${avatarUrl}" class="author-avatar-small" onerror="this.src='${getDiceBearAvatar(item.author)}'">
                    <span>${item.author}</span>
                </div>
                <div class="stats-info">
                    <div class="stats-item" onclick="app.interaction.toggleLikeBtn(this)">
                        <i class="fa-solid fa-heart" style="color:${isLiked ? '#ff4d4f' : '#fff'}"></i>
                        <span>${this.formatNumber(item.like)}</span>
                    </div>
                    <div class="stats-item" onclick="app.pageManager.openComments()"><i class="fa-solid fa-comment-dots" style="transform:scaleX(-1);"></i><span>${this.formatNumber(item.comment)}</span></div>
                   <div class="stats-item" onclick="app.favManager.openQuickPanel()">
    <i class="fa-solid fa-star main-fav-icon" style="color:${isFav ? '#face15' : '#fff'}"></i>
</div>
                    <div class="stats-item" onclick="app.pageManager.openDownload(${index})"><i class="fa-solid fa-share"></i></div>
                </div>
                 
            </div>
            
        </div>
         <div class="custom-pagination-container"><div class="swiper-pagination gallery-pagination-${index}"></div></div>
        <div class="bottom-gradient-overlay"></div>
        
        <div class="footer-bar">
            <i class="fas fa-circle-nodes footer-icon" onclick="app.pageManager.openCircleHub()"></i>
            <div class="music-pill" data-index="${index}">
                <div class="progress-fill"></div>
                <div class="music-content">
                    <div class="scroll-wrap"><span>${musicTitle}&nbsp;&nbsp;&nbsp;&nbsp;</span><span>${musicTitle}&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
                </div>
            </div>
            <i class="fa-solid fa-user footer-icon" onclick="app.pageManager.openMyPage()"></i>
        </div>`;
            }

            async renderSidebar(creators) {
                const container = document.getElementById('sidebar-grid-content');
                if (!container) return;

                const allKeys = Object.keys(creators);
                let collectionData = { list: [], assignments: {} };
                if (app.dataSystem && typeof app.dataSystem.getCollectionData === 'function') {
                    collectionData = await app.dataSystem.getCollectionData();
                }
                const assignments = collectionData.assignments || {};
                const list = Array.isArray(collectionData.list) ? collectionData.list : [];

                if (this.sidebarCollection !== 'all' && !list.includes(this.sidebarCollection)) {
                    this.sidebarCollection = 'all';
                }

                const counts = {};
                list.forEach(name => { counts[name] = 0; });
                allKeys.forEach(key => {
                    const group = assignments[key];
                    if (counts[group] !== undefined) counts[group] += 1;
                });

                let keys = allKeys;
                if (this.sidebarCollection !== 'all') {
                    keys = keys.filter(k => assignments[k] === this.sidebarCollection);
                }

                const currentLabel = this.sidebarCollection === 'all' ? '全部资源合集' : this.sidebarCollection;

                const mixKeys = keys.filter((k) => {
                    const c = creators[k];
                    if (!c || !c.info) return true;
                    return !(c.info.origin_type === 'local' && c.info.mix_enabled === false);
                });
                const count = mixKeys.length;
                const isListView = this.sidebarViewMode === 'list';
                const viewToggleLabel = isListView ? '网格' : '列表';
                const viewToggleIcon = isListView ? 'fa-border-all' : 'fa-list';

                const collectionItemsHtml = [
                    `<div class="sidebar-collection-item ${this.sidebarCollection === 'all' ? 'active' : ''}" onclick="app.renderer.setSidebarCollection('all')">
                        <span>全部资源合集</span>
                        <span class="sidebar-collection-count">${allKeys.length}</span>
                    </div>`,
                    ...list.map(name => `
                    <div class="sidebar-collection-item ${this.sidebarCollection === name ? 'active' : ''}" onclick="app.renderer.setSidebarCollection('${name}')">
                        <span>${name}</span>
                        <span class="sidebar-collection-count">${counts[name] || 0}</span>
                    </div>`)
                ].join('');
                let html = `
    <div class="sidebar-ad-wrapper" id="sidebar-ad-container">
        <!-- 轮播图将在此动态加载 -->
    </div>
`;
                // 然后连接原有的内容
                html += `
    <div class="sidebar-collection-drawer">
            
             <div class="mixed-recommend-card" onclick="app.loadRandom()">
            <div class="mr-title">混合推荐</div>
            <div class="mr-subtitle">从 ${count} 个资源中精选作品混合展示</div>
        </div>
            <div class="sidebar-collection-head">
                <div class="sidebar-collection-bar">
                    <div class="sidebar-collection-label">${currentLabel}</div>
                    <div class="sidebar-collection-actions">
                        <button class="sidebar-collection-btn" id="sidebar-collection-toggle" onclick="app.renderer.toggleSidebarCollectionDrawer()">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <button class="sidebar-collection-btn manage" onclick="app.dataSystem.openCollectionManager()">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
            <div class="sidebar-collection-panel" id="sidebar-collection-panel">
                <div class="sidebar-collection-list">
                    ${collectionItemsHtml}
                </div>
            </div>
        </div>
        <div class="sidebar-view-toggle">
            <div class="sidebar-view-label">资源列表</div>
            <div class="sidebar-search">
                <input type="text" id="resource-search" placeholder="搜索资源..." oninput="app.renderer.filterResources(this.value)">
            </div>
            <button class="sidebar-collection-btn" onclick="app.renderer.toggleSidebarViewMode()">
                <i class="fa-solid ${viewToggleIcon}"></i>
            </button>
        </div>
        <div class="${isListView ? 'creator-list' : 'creator-grid'}">
            <!-- 添加资源按钮放在最前面 -->
            <div class="creator-item" data-fixed="true" onclick="app.pageManager.openAddCreator()">
                <div class="c-avatar-box add-creator-btn"><i class="fa-solid fa-plus"></i></div>
                <div class="c-name">添加资源</div>
            </div>`;

                const activeCreator = window.app ? window.app.currentCreatorName : null;
                const localVideoActive = activeCreator === LOCAL_MEDIA_CONFIG.video.name ? 'active' : '';
                const localMusicActive = activeCreator === LOCAL_MEDIA_CONFIG.music.name ? 'active' : '';

                html += `
            <div class="creator-item ${localVideoActive}" data-fixed="true" data-local-type="video"
                onclick="app.openLocalMedia('video')" oncontextmenu="app.resourceManager.openLocal('video', event)">
                <div class="c-avatar-box" style="background: rgba(76, 195, 255, 0.18); border-color: rgba(76, 195, 255, 0.35);">
                    <img src="${getDiceBearAvatar(LOCAL_MEDIA_CONFIG.video.name)}"
                        onerror="this.onerror=null;this.src='${getDiceBearAvatar(LOCAL_MEDIA_CONFIG.video.name)}'">
                </div>
                <div class="c-name">${LOCAL_MEDIA_CONFIG.video.name}</div>
            </div>
            <div class="creator-item ${localMusicActive}" data-fixed="true" data-local-type="music"
                onclick="app.openLocalMedia('music')" oncontextmenu="app.resourceManager.openLocal('music', event)">
                <div class="c-avatar-box" style="background: rgba(255, 122, 216, 0.18); border-color: rgba(255, 122, 216, 0.35);">
                    <img src="${getDiceBearAvatar(LOCAL_MEDIA_CONFIG.music.name)}"
                        onerror="this.onerror=null;this.src='${getDiceBearAvatar(LOCAL_MEDIA_CONFIG.music.name)}'">
                </div>
                <div class="c-name">${LOCAL_MEDIA_CONFIG.music.name}</div>
            </div>`;
                keys.forEach(key => {
                    const c = creators[key];
                    if (c.info && (c.info.name === LOCAL_MEDIA_CONFIG.video.name || c.info.name === LOCAL_MEDIA_CONFIG.music.name)) return;
                    const isCustom = c.isCustom === true;
                    const longPressAttr = isCustom ? `oncontextmenu="app.resourceManager.open('${c.info.name}', event)"` : '';
                    const activeClass = (activeCreator && activeCreator === c.info.name) ? 'active' : '';
                    const customIndicator = isCustom ? `<div class="creator-badge" style="position:absolute;top:0;right:0;width:10px;height:10px;background:#ff4d4f;border-radius:50%;border:1px solid #000;"></div>` : '';
                    let updateBadge = '';
                    if (isCustom && c.info.last_updated && c.info.source_url) {
                        const days = (Date.now() - c.info.last_updated) / (1000 * 60 * 60 * 24);
                        if (days > 3) {
                            updateBadge = `<div class="creator-badge" style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:#faad14;border-radius:50%;border:1px solid #000;" title="数据较旧"></div>`;
                        }
                    }

                    // 优化：为随机视频添加特殊点击处理
                    const isRandomApi = c.info && c.info.origin_type === 'random_api';
                    const onClickHandler = isRandomApi
                        ? `app.loadCreatorWithPreload('${c.info.name}')`
                        : `app.loadCreator('${c.info.name}', 'recommend')`;

                    html += `
<div class="creator-item ${activeClass}" onclick="${onClickHandler}" ${longPressAttr}>
    <div class="c-avatar-box" style="position:relative;">
        <img src="${c.info.avatar}" 
             onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23face15\'><path d=\'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z\'/></svg>'">
        ${customIndicator}
        ${updateBadge}
        ${isRandomApi ? '<div class="random-api-indicator" style="position:absolute;top:0;left:0;width:8px;height:8px;background:#52c41a;border-radius:50%;border:1px solid #000;"></div>' : ''}
    </div>
    <div class="c-name">${c.info.name}</div>
</div>`;
                });

                html += `
        </div>
        <div style="font-size:12px;color:#666;text-align:center;margin-top:20px;">
            提示：长按资源头像可进入管理
        </div>`;

                container.innerHTML = html;
                this.initSidebarAds();
                this.toggleSidebarCollectionDrawer(this.sidebarCollectionExpanded);
            }

            async setSidebarCollection(value) {
                this.sidebarCollection = value || 'all';
                await this.renderSidebar(app.dataLoader ? app.dataLoader.globalCreators : {});
            }

            toggleSidebarCollectionDrawer(forceState) {
                if (typeof forceState === 'boolean') {
                    this.sidebarCollectionExpanded = forceState;
                } else {
                    this.sidebarCollectionExpanded = !this.sidebarCollectionExpanded;
                }

                const panel = document.getElementById('sidebar-collection-panel');
                const toggleBtn = document.getElementById('sidebar-collection-toggle');
                if (panel) {
                    panel.classList.toggle('expanded', this.sidebarCollectionExpanded);
                }
                if (toggleBtn) {
                    toggleBtn.setAttribute('aria-expanded', this.sidebarCollectionExpanded ? 'true' : 'false');
                    toggleBtn.innerHTML = this.sidebarCollectionExpanded
                        ? '<i class="fa-solid fa-chevron-up"></i>'
                        : '<i class="fa-solid fa-chevron-down"></i>';
                }
            }

            toggleSidebarViewMode() {
                this.sidebarViewMode = this.sidebarViewMode === 'list' ? 'grid' : 'list';
                this.renderSidebar(app.dataLoader ? app.dataLoader.globalCreators : {});
            }

            filterResources(value) {
                const items = document.querySelectorAll('.creator-item');
                const searchTerm = value.toLowerCase();
                items.forEach(item => {
                    if (item.dataset.fixed === 'true') {
                        item.style.display = '';
                        return;
                    }
                    const nameElement = item.querySelector('.c-name');
                    if (!nameElement) return;
                    const name = nameElement.textContent.toLowerCase();
                    if (name === '添加资源' || name.includes(searchTerm)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }

            renderProfileHeader(name, worksCount, avatar) {
                document.getElementById('profile-name').innerText = name;
                document.getElementById('profile-img').src = avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Profile';
                document.getElementById('profile-count').innerText = "作品 " + worksCount;
            }

            renderDownloadGrid(assets) {
                const grid = document.getElementById('dl-grid');
                grid.innerHTML = assets.map((a, i) => {
                    let thumbContent = a.type === 'image' ? `<img src="${a.url}">` : (a.cover ? `<img src="${a.cover}"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:20px;"><i class="fa-solid fa-play"></i></div>` : `<div class="video-placeholder"></div>`);
                    return `<div class="dl-item selected" onclick="app.interaction.toggleDlItem(this)">${thumbContent}<div class="dl-checkbox" data-index="${i}"></div></div>`
                }).join('');
                app.interaction.updateSelectAllState();
            }

            // 新增：解析 "0 分 31 秒" 格式为秒数
            parseDurationStr(str) {
                if (!str) return 0;
                try {
                    // 提取分钟
                    const minMatch = str.match(/(\d+)\s*分/);
                    const min = minMatch ? parseInt(minMatch[1]) : 0;

                    // 提取秒数
                    const secMatch = str.match(/(\d+)\s*秒/);
                    const sec = secMatch ? parseInt(secMatch[1]) : 0;

                    return min * 60 + sec;
                } catch (e) {
                    return 0;
                }
            }

            renderMusicPage(music) {
                const container = document.getElementById('music-manage-content');
                const safeTitle = (music.title || '原声').replace(/'/g, "\\'");
                const safeAuthor = (music.author || '未知').replace(/'/g, "\\'");
                const url = music.url || '';
                let totalSeconds = 0;
                if (music.duration) {
                    try {
                        const minMatch = music.duration.match(/(\d+)\s*分/);
                        const min = minMatch ? parseInt(minMatch[1]) : 0;
                        const secMatch = music.duration.match(/(\d+)\s*秒/);
                        const sec = secMatch ? parseInt(secMatch[1]) : 0;
                        totalSeconds = min * 60 + sec;
                    } catch (e) { }
                }
                const formattedDuration = window.app.mediaManager.formatTime(totalSeconds);

                const miniMarkup = this.lastMiniMarkup || `
                        <div class="music-mini-placeholder">
                            <i class="fa-solid fa-photo-film"></i>
                            <span>暂无播放画面</span>
                        </div>`;
                const miniTitle = this.lastMiniTitle || '暂无标题';

                container.innerHTML = `
            <div class="music-info-card" id="music-card-anim">
                <div class="music-mini-player" id="music-mini-player">
                    <div class="music-mini-media" id="music-mini-media">
                        ${miniMarkup}
                    </div>
                </div>
                <div class="music-mini-title">
                    <div class="desc-text-container">
                        <div class="desc-text" id="music-mini-title-text" data-full-text="${miniTitle}" onclick="app.interaction.toggleDesc(this, event)">${miniTitle}</div>
                    </div>
                </div>
                <div class="music-meta-title clickable-text" id="music-page-title" onclick="app.interaction.copyText(this)" title="点击复制歌名">${music.title || '原声'}</div>
                <div class="music-meta-author clickable-text" id="music-page-author" onclick="app.interaction.copyText(this)" title="点击复制歌手">${music.author || '未知'}</div>        
            </div>
            <div class="music-player-controls">
                <div class="progress-area"><span class="time-text" id="music-curr-time">00:00</span><input type="range" class="custom-range" id="music-seek-bar" min="0" max="100" value="0" step="0.1"><span class="time-text" id="music-total-time">${formattedDuration}</span></div>
                <div class="control-buttons">
                    <i class="fa-solid fa-backward-step ctrl-btn" data-clickable="true" onclick="app.mainSwiper.slidePrev()"></i>
                    <div class="play-pause-btn ctrl-btn" id="music-toggle-btn" data-clickable="true" onclick="app.mediaManager.toggleCurrent()"><i class="fa-solid fa-pause"></i></div>
                    <i class="fa-solid fa-forward-step ctrl-btn" data-clickable="true" onclick="app.mainSwiper.slideNext()"></i>
                </div>
            </div>
            <div class="to-hillmusic-control-box"><div class="to-hillmusic" onclick="window.open('https://music.hillmis.cn', '_blank')"><span>点击前往Hillmusic，一个小而美<br>免费听、免费下无损歌曲的网页应用</span></div></div>
           <div class="music-actions-grid">           
                <div class="gradient-btn btn-pink" id="btn-music-fav"><div class="btn-icon"><i class="fa-solid fa-heart"></i></div><div class="btn-text">收藏音乐</div></div>        
                <div class="gradient-btn btn-teal" id="btn-music-download" onclick="app.downloadMusic('${url}', '${safeTitle}', '${safeAuthor}')"><div class="btn-icon"><i class="fa-solid fa-cloud-arrow-down"></i></div><div class="btn-text">下载音频</div></div>
                 <div class="gradient-btn btn-indigo" id="btn-music-copy-link"><div class="btn-icon"><i class="fa-solid fa-link"></i></div><div class="btn-text">复制音乐链接</div></div>   
            </div>`;

                const seekBar = document.getElementById('music-seek-bar');
                if (seekBar) {
                    const newSeekBar = seekBar.cloneNode(true);
                    seekBar.parentNode.replaceChild(newSeekBar, seekBar);
                    newSeekBar.addEventListener('input', (e) => {
                        window.app.mediaManager.isSeeking = true;
                        const pct = e.target.value / 100;
                        const media = window.app.mediaManager.currentMedia;
                        if (media && media.duration) document.getElementById('music-curr-time').innerText = window.app.mediaManager.formatTime(pct * media.duration);
                    });
                    newSeekBar.addEventListener('change', (e) => {
                        window.app.mediaManager.seek(e.target.value / 100);
                        setTimeout(() => { window.app.mediaManager.isSeeking = false; }, 200);
                    });
                }

                if (this.lastMiniSize) {
                    const miniPlayer = document.getElementById('music-mini-player');
                    if (miniPlayer) {
                        miniPlayer.style.width = `${this.lastMiniSize.width}px`;
                        miniPlayer.style.height = `${this.lastMiniSize.height}px`;
                    }
                }

                if (window.app && window.app.pageManager) {
                    const activeData = (window.app.fullPlaylist && window.app.mainSwiper)
                        ? window.app.fullPlaylist[window.app.mainSwiper.activeIndex]
                        : null;
                    window.app.pageManager.updateMusicMiniPlayer(activeData || {});
                }
            }
            async initSidebarAds() {
                const container = document.getElementById('sidebar-ad-container');
                if (!container) return;

                try {
                    // 修改点：使用 App 实例的镜像获取方法
                    const ads = await app.fetchFromMirrors('ad.json');

                    const slidesHtml = ads.map(ad => `
            <div class="swiper-slide sidebar-ad-slide" onclick="window.open('${ad.link}', '_blank')">
                <img src="${ad.url}" alt="${ad.alt}" loading="lazy">
            </div>
        `).join('');

                    container.innerHTML = `
            <div class="swiper sidebar-ad-swiper">
                <div class="swiper-wrapper">${slidesHtml}</div>
            </div>
        `;

                    new Swiper('.sidebar-ad-swiper', {
                        loop: true,
                        autoplay: { delay: 3000, disableOnInteraction: false },
                        observer: true, observeParents: true
                    });
                } catch (e) {
                    console.warn('加载侧边栏广告失败 (所有镜像已尝试):', e);
                    container.style.display = 'none';
                }
            }
        }

        // --- 3. 资源主页懒加载控制器 (支持筛选版) ---

/* ---- app/render/08-profile-lazy-loader.js ---- */
/* v3 semantic split: class from js/app/03-music-renderer-profile.js | keep script order */
        class ProfileLazyLoader {
            constructor() {
                this.originalWorks = []; // 存储所有原始数据
                this.displayWorks = [];  // 存储当前筛选后的数据
                this.renderedCount = 0;

                this.container = document.getElementById('works-content-area');
                this.scrollContainer = document.getElementById('works-scroll-container');
                this.loadingIndicator = document.getElementById('profile-loading-indicator');

                this.isLoading = false;
                this.viewMode = 'grid'; // grid or list
                this.currentFilter = 'all'; // all, video, image
                this.searchTerm = '';
                this.searchInput = null;

                this.scrollContainer.addEventListener('scroll', () => {
                    if (this.scrollContainer.scrollTop + this.scrollContainer.clientHeight >= this.scrollContainer.scrollHeight - 100) {
                        this.loadMore();
                    }
                });
            }

            // 重置数据 (入口)
            reset(works) {
                this.originalWorks = works; // 保存原始副本
                this.searchTerm = '';

                // 重置筛选 UI 为“全部”
                this.resetFilterUI();

                // 应用筛选 (默认 all) 并渲染
                this.applyFilter('all', null, true); // true 表示内部调用，不需更新UI（因为上面已经重置了）
            }

            scrollToTop() {
                this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // 切换视图模式 (网格/列表)
            changeView(mode) {
                this.viewMode = mode;
                document.getElementById('view-icon-grid').classList.toggle('active', mode === 'grid');
                document.getElementById('view-icon-list').classList.toggle('active', mode === 'list');

                // 重新渲染当前筛选后的数据
                this.renderedCount = 0;
                this.container.innerHTML = '';
                this.container.className = mode === 'grid' ? 'works-grid' : 'works-list';
                this.loadMore();
            }

            // --- 新增：应用筛选 ---
            applyFilter(type, btnElement, isInternal = false) {
                this.currentFilter = type;

                // 1. 更新 UI 高亮
                if (btnElement) {
                    const group = btnElement.parentElement;
                    group.querySelectorAll('.filter-tag').forEach(el => el.classList.remove('active'));
                    btnElement.classList.add('active');
                }

                // 2. 过滤数据
                let filteredWorks = [];
                if (type === 'all') {
                    filteredWorks = [...this.originalWorks];
                } else if (type === 'video') {
                    filteredWorks = this.originalWorks.filter(w => w.type === '视频');
                } else if (type === 'image') {
                    filteredWorks = this.originalWorks.filter(w => this.isImageWork(w));
                }

                if (this.searchTerm) {
                    const term = this.searchTerm;
                    filteredWorks = filteredWorks.filter((w) => {
                        const title = (w.title || w.desc || '').toLowerCase();
                        const author = (w.author || '').toLowerCase();
                        const musicTitle = (w.music_info?.title || '').toLowerCase();
                        const musicAuthor = (w.music_info?.author || '').toLowerCase();
                        return title.includes(term) || author.includes(term) || musicTitle.includes(term) || musicAuthor.includes(term);
                    });
                }

                this.displayWorks = filteredWorks;

                // 3. 重置渲染状态
                this.renderedCount = 0;
                this.container.innerHTML = '';
                if (this.viewMode === 'grid') {
                    this.container.className = 'works-grid';
                } else {
                    this.container.className = 'works-list';
                }

                // 4. 显示空状态提示 (如果筛选后无数据)
                // 注意：loadMore 会处理数据加载，我们只需要处理 0 条的情况
                if (this.displayWorks.length === 0) {
                    this.container.innerHTML = '<div style="text-align:center; padding:50px; color:#666;">暂无相关内容</div>';
                    this.loadingIndicator.style.display = 'none';
                } else {
                    this.loadMore();
                }

                // 滚动回顶部
                if (!isInternal) this.scrollContainer.scrollTop = 0;
            }

            // 辅助：重置筛选 UI
            resetFilterUI() {
                const filters = document.querySelectorAll('.filter-group .filter-tag');
                filters.forEach(el => el.classList.remove('active'));
                if (filters.length > 0) filters[0].classList.add('active'); // 选中“全部”
            }

            isImageWork(work) {
                if (!work) return false;
                const type = (work.type || '').trim();
                if (type === '图集' || type === '图片' || type === '图文') return true;
                if (Array.isArray(work.images) && work.images.length > 0) return true;
                return false;
            }

            normalizeSearchTerm(term) {
                return (term || '').trim().toLowerCase();
            }

            setSearchTerm(term) {
                this.searchTerm = this.normalizeSearchTerm(term);
                this.applyFilter(this.currentFilter, null, true);
                this.scrollContainer.scrollTop = 0;
                if (this.searchTerm) {
                    app.interaction.showToast(`搜索到 ${this.displayWorks.length} 个结果`);
                } else {
                    app.interaction.showToast('已清空搜索');
                }
            }

            promptSearch() {
                const input = prompt('搜索作品标题/文案/音乐', this.searchTerm || '');
                if (input === null) return;
                this.setSearchTerm(input);
            }

            _isSameWork(a, b) {
                if (!a || !b) return false;
                if (a.id && b.id && String(a.id) === String(b.id)) return true;
                if (a.url && b.url && a.url === b.url) return true;
                if (a.title && b.title && a.author && b.author && a.title === b.title && a.author === b.author) return true;
                return false;
            }

            locateCurrentPlayingWork() {
                const current = app.fullPlaylist && app.mainSwiper ? app.fullPlaylist[app.mainSwiper.activeIndex] : null;
                if (!current) {
                    app.interaction.showToast('未找到正在播放的作品');
                    return;
                }

                const matchIndex = this.originalWorks.findIndex(w => this._isSameWork(w, current));
                if (matchIndex === -1) {
                    app.interaction.showToast('当前播放作品不在该主页');
                    return;
                }

                let displayIndex = this.displayWorks.findIndex(w => this._isSameWork(w, current));
                if (displayIndex === -1) {
                    if (this.searchTerm) {
                        this.searchTerm = '';
                    }
                    if (this.currentFilter !== 'all') {
                        const allBtn = document.querySelector('.filter-group .filter-tag');
                        this.applyFilter('all', allBtn, true);
                    } else {
                        this.applyFilter('all', null, true);
                    }
                    displayIndex = this.displayWorks.findIndex(w => this._isSameWork(w, current));
                }
                if (displayIndex === -1) {
                    app.interaction.showToast('无法定位当前作品');
                    return;
                }

                const ensureRendered = (index, tries = 0) => {
                    if (index < this.renderedCount) {
                        const item = this.container.children[index];
                        if (item) {
                            const prev = this.container.querySelector('.profile-locate-highlight');
                            if (prev) prev.classList.remove('profile-locate-highlight');
                            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            item.classList.add('profile-locate-highlight');
                        }
                        return;
                    }
                    if (tries > 40) {
                        app.interaction.showToast('定位失败，请稍后重试');
                        return;
                    }
                    this.loadMore();
                    setTimeout(() => ensureRendered(index, tries + 1), 80);
                };

                ensureRendered(displayIndex);
            }

            // 加载更多 (核心渲染逻辑)
            loadMore() {
                // 注意：这里判断的是 displayWorks 的长度
                if (this.isLoading || this.renderedCount >= this.displayWorks.length) return;

                this.isLoading = true;
                this.loadingIndicator.style.display = 'block';

                setTimeout(() => {
                    const start = this.renderedCount;
                    const end = Math.min(start + CONFIG.PROFILE_BATCH, this.displayWorks.length);
                    const batch = this.displayWorks.slice(start, end);

                    let html = '';
                    if (this.viewMode === 'grid') {
                        html = batch.map((w, i) => {
                            const listIndex = start + i;
                            return renderWorkGridItem(w, listIndex, {
                                clickAction: `app.profileLoader.playFromFilteredProfile(${listIndex})`,
                                typeFallback: '视频',
                                showTopBadge: true
                            });
                        }).join('');
                    } else {
                        html = batch.map((w, i) => {
                            const listIndex = start + i;
                            return renderUniWorkListItem(w, listIndex, {
                                clickAction: `app.profileLoader.playFromFilteredProfile(${listIndex})`,
                                fallbackAuthor: w.author || 'Guest',
                                timeClass: 'list-time-tag',
                                timeIconStyle: 'font-size:10px;',
                                showTopBadge: true
                            });
                        }).join('');
                    }

                    this.container.insertAdjacentHTML('beforeend', html);
                    this.renderedCount = end;
                    this.isLoading = false;
                    this.loadingIndicator.style.display = 'none';

                    // 如果内容没填满屏幕，继续加载
                    if (this.scrollContainer.scrollHeight <= this.scrollContainer.clientHeight + 50 && this.renderedCount < this.displayWorks.length) {
                        this.loadMore();
                    }
                }, 50);
            }

            // --- 新增：点击播放 (使用当前筛选后的列表) ---
            playFromFilteredProfile(index) {
                // 将当前筛选后的列表作为播放上下文传入
                app.enterContextPlay([...this.displayWorks], index);
            }
        }
        // --- 4. 数据加载 (修改版) ---

/* ---- app/data/09-data-loader.js ---- */
/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
        class DataLoader {
            constructor() {
                this.globalCreators = {};
                this.customManager = new CustomCreatorManager();
            }

            async init() {
                // 1. 立即读取 IndexedDB 中的本地资源
                const localCreators = await this.customManager.getAll();
                this.globalCreators = { ...localCreators };

                // 如果本地已经有数据了，先返回去渲染首屏
                if (Object.keys(this.globalCreators).length > 0) {

                    return this.globalCreators;
                }



                if (Object.keys(this.globalCreators).length === 0) {
                    this.globalCreators = this.generateMockData();
                }
                return this.globalCreators;
            }




            // 演示模式下用来填充多个模拟创作者
            generateMockData() {
                const creators = this.getFallbackCreators();
                const authors = ["演示资源A", "演示资源B"];
                const demoWorksTemplate = [
                    {
                        key: "sunrise",
                        title: "晨光剪影",
                        videoUrl: "https://v-cdn.zjol.com.cn/276982.mp4",
                        musicTitle: "晨光序曲",
                        musicAuthor: "云澈",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "dream",
                        title: "梦境流年",
                        videoUrl: "https://archive.org/download/SampleVideo1280x7205mb/SampleVideo_1280x720_5mb.mp4",
                        musicTitle: "云间梦",
                        musicAuthor: "雁语",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "shore",
                        title: "海岸日记",
                        videoUrl: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4",
                        musicTitle: "海誓",
                        musicAuthor: "蓝音",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "groove",
                        title: "律动心跳",
                        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
                        musicTitle: "节奏轻描",
                        musicAuthor: "晨弦",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "glimmer",
                        title: "星光短章",
                        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
                        musicTitle: "星光漫游",
                        musicAuthor: "素夜",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    }
                ];

                authors.forEach((name, authorIndex) => {
                    const works = demoWorksTemplate.map((tpl, workIndex) => {
                        const like = 1500 + authorIndex * 120 + workIndex * 25;
                        const comment = 120 + authorIndex * 10 + workIndex * 5;
                        return {
                            id: `mock-${name}-${tpl.key}-${workIndex + 1}`,
                            title: `${name} · ${tpl.title}`,
                            author: name,
                            type: "视频",
                            like,
                            comment,
                            width: 720,
                            height: 1280,
                            music_info: {
                                title: tpl.musicTitle,
                                author: tpl.musicAuthor,
                                url: tpl.musicUrl
                            },
                            url: tpl.videoUrl,
                            cover: getDiceBearAvatar(`${name}-${tpl.key}`)
                        };
                    });

                    creators[name] = {
                        info: {
                            name,
                            avatar: getDiceBearAvatar(name)
                        },
                        works
                    };
                });

                return creators;
            }
            getFallbackCreators() {
                const fallback = JSON.parse(JSON.stringify(FALLBACK_CREATOR));
                return { [fallback.info.name]: fallback };
            }

            getAllWorksRandomly() {
                let all = [];
                Object.values(this.globalCreators).forEach(c => all = all.concat(c.works));
                return all.sort(() => Math.random() - 0.5);
            }
        }

/* ---- app/player/10-media-manager.js ---- */
/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
        class MediaManager {
            constructor() {
                this.currentMedia = null;
                this.gallerySwiper = null;
                this.isSeeking = false;
                // 初始化运行时全局静音状态
                this.isGlobalMuted = CONFIG.DEFAULT_MUTED;

                // 音乐页状态
                this.isMusicPageActive = false;

                this.musicPageRefs = {
                    page: null,
                    seekBar: null,
                    currTimeEl: null,
                    miniVideo: null
                };
                this.lastUiSyncTime = 0;
                this.lastTimeTextSync = 0;
                this.lastMiniSyncTime = 0;
                this.lastMiniRate = 1;
                this.lastMediaSyncTime = 0;
                this._mediaEventHandlers = null;
                this.manualPauseOverlay = false;
                this.galleryAutoTimer = null;
            }

            _isMutedByLayer() {
                if (!CONFIG.MUTE_ON_PAGE_OPEN) return false;
                const activePage = document.querySelector('.page-layer.active:not(#music-manage-page):not(.left-side)');
                return !!activePage;
            }

            play(slide) {
                this.stop(); // 停止上一个

                const video = slide.querySelector('video');
                const audio = slide.querySelector('.bgm-audio');
                const galleryEl = slide.querySelector('.gallery-swiper');

                // 通用：应用静音设置
                const isMuted = this.isGlobalMuted || this._isMutedByLayer();

                // 如果当前在音乐页，优先播放音频，视频静音播放
                if (this.isMusicPageActive) {
                    if (audio) {
                        this.currentMedia = audio;
                        this._bindMediaEvents(audio);
                        audio.muted = this._isMutedByLayer(); // 离开首页时强制静音
                        audio.currentTime = video ? video.currentTime : 0;
                        audio.play().catch(e => console.log('Audio play failed', e));
                    }
                    if (video) {
                        video.muted = true; // 强制静音
                        video.play().catch(e => console.log('Background video play failed', e));
                    }
                }
                // 正常主页模式
                else {
                    // 1. 视频播放逻辑
                    if (video) {
                        this.currentMedia = video;
                        this._bindMediaEvents(video);
                        video.muted = isMuted;
                        video.playbackRate = CONFIG.DEFAULT_SPEED || 1.0;

                        if (audio) {
                            audio.pause();
                            audio.muted = isMuted;
                        }

                        video.play().catch(e => console.log('Video play failed', e));
                        const logFinalOnce = () => {
                            if (window.app && typeof app.syncVideoSrcWithData === 'function') {
                                app.syncVideoSrcWithData(video);
                            }
                        };
                        video.addEventListener('loadedmetadata', logFinalOnce, { once: true });
                        video.addEventListener('canplay', logFinalOnce, { once: true });
                        if (window.app && slide) {
                            const parent = slide.parentElement;
                            const index = parent ? Array.from(parent.children).indexOf(slide) : -1;
                            const data = (index >= 0 && window.app.fullPlaylist) ? window.app.fullPlaylist[index] : null;
                            if (data && data.is_random_api) {
                                let tries = 0;
                                const maxTries = 12; // 增加重试次数
                                const poll = setInterval(() => {
                                    tries += 1;
                                    const src = video.currentSrc || video.src || '';
                                    const finalUrl = (src && src.startsWith('http')) ? src : (data.url || '');

                                    // 优化：检查视频是否可播放
                                    if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                                        console.log(`[RandomVideo] video readyState: ${video.readyState}, final url: ${finalUrl} (${data.source_api || 'api'})`);
                                        if (finalUrl && data._last_logged_url !== finalUrl) {
                                            console.log(`[RandomVideo] final url: ${finalUrl} (${data.source_api || 'api'})`);
                                            data._last_logged_url = finalUrl;
                                        }
                                        clearInterval(poll);
                                        return;
                                    }

                                    if (finalUrl && data._last_logged_url !== finalUrl) {
                                        console.log(`[RandomVideo] final url: ${finalUrl} (${data.source_api || 'api'})`);
                                        data._last_logged_url = finalUrl;

                                        // 如果获取到URL但视频仍未加载，尝试重新加载
                                        if (tries > 3 && video.readyState < 2) {
                                            console.log('[RandomVideo] retrying video load...');
                                            video.load();
                                        }
                                    }

                                    if (tries >= maxTries) {
                                        console.warn(`[RandomVideo] final url poll timeout after ${maxTries} tries`);

                                        // 超时后显示错误提示
                                        const container = video.closest('.media-container');
                                        if (container) {
                                            const errTip = container.querySelector('.video-error');

                                        }
                                        clearInterval(poll);
                                    }
                                }, 250);
                            }
                        }
                        setTimeout(logFinalOnce, 0);
                    }
                    // 2. 图集播放逻辑
                    else if (galleryEl) {
                        if (audio) {
                            this.currentMedia = audio;
                            this._bindMediaEvents(audio);
                            audio.muted = isMuted;
                            audio.play().catch(e => console.log('Audio play failed', e));
                        }
                        // 初始化 Swiper 轮播
                        if (galleryEl.swiper) {
                            this.gallerySwiper = galleryEl.swiper;
                            if (this.gallerySwiper.autoplay) this.gallerySwiper.autoplay.stop();

                            if (this.gallerySwiper.params.loop) {
                                this.gallerySwiper.slideToLoop(0, 0);
                            } else {
                                this.gallerySwiper.slideTo(0, 0);
                            }

                            this._scheduleGalleryStep(this.gallerySwiper);
                        }
                    }
                    // 3. 纯音乐逻辑 (无视频/图集时)
                    else if (audio) {
                        this.currentMedia = audio;
                        this._bindMediaEvents(audio);
                        audio.muted = isMuted;
                        audio.play().catch(e => console.log('Audio play failed', e));
                    }
                }

                // 进度条初始化
                const activeMedia = this.isMusicPageActive && audio ? audio : (video || audio);

                if (activeMedia) {
                    if (activeMedia.readyState >= 1) {
                        this.updateTotalTime(activeMedia.duration);
                    } else {
                        activeMedia.onloadedmetadata = () => this.updateTotalTime(activeMedia.duration);
                    }
                }

                if (this.currentMedia) {
                    this.lastMiniRate = this.currentMedia.playbackRate || 1;
                }

                if (this.isMusicPageActive) {
                    this.refreshMusicPageRefs(true);
                }

                this.startProgress(slide);
                this.updatePlayBtnState(true);
            }

            _bindMediaEvents(media) {
                if (!media) return;
                this._unbindMediaEvents();

                const slide = media.closest('.swiper-slide');
                const onPlay = () => {
                    if (slide) slide.classList.add('playing');
                    this.updatePlayBtnState(true);
                };
                const onPause = () => {
                    if (slide) slide.classList.remove('playing');
                    this.updatePlayBtnState(false);
                };
                const onEnded = () => {
                    if (slide) slide.classList.remove('playing');
                    this.updatePlayBtnState(false);
                };

                media.addEventListener('play', onPlay);
                media.addEventListener('pause', onPause);
                media.addEventListener('ended', onEnded);

                this._mediaEventHandlers = { media, onPlay, onPause, onEnded };
            }

            _unbindMediaEvents() {
                if (!this._mediaEventHandlers) return;
                const { media, onPlay, onPause, onEnded } = this._mediaEventHandlers;
                media.removeEventListener('play', onPlay);
                media.removeEventListener('pause', onPause);
                media.removeEventListener('ended', onEnded);
                this._mediaEventHandlers = null;
            }

            refreshMusicPageRefs(force = false) {
                const musicPage = document.getElementById('music-manage-page');
                if (!musicPage) return;

                const isOpen = this.isMusicPageActive || musicPage.classList.contains('active');
                if (!isOpen && !force) return;

                if (force || !this.musicPageRefs.page || this.musicPageRefs.page !== musicPage) {
                    this.musicPageRefs.page = musicPage;
                    this.musicPageRefs.seekBar = document.getElementById('music-seek-bar');
                    this.musicPageRefs.currTimeEl = document.getElementById('music-curr-time');
                }

                if (force || !this.musicPageRefs.miniVideo) {
                    this.musicPageRefs.miniVideo = document.querySelector('#music-mini-media video[data-mini-sync="true"]');
                }
            }

            _syncMiniVideo(curr) {
                const miniVideo = this.musicPageRefs.miniVideo;
                if (!miniVideo || !this.currentMedia) return;

                const now = performance.now();
                if (!this.isSeeking && now - this.lastMiniSyncTime < 120) return;
                this.lastMiniSyncTime = now;

                const targetTime = curr;
                const diff = Math.abs(miniVideo.currentTime - targetTime);
                if (!this.isSeeking && diff > 0.25) {
                    try {
                        miniVideo.currentTime = Math.min(targetTime, miniVideo.duration || targetTime);
                    } catch (e) { /* ignore */ }
                }

                if (this.currentMedia.paused) {
                    if (!miniVideo.paused) miniVideo.pause();
                } else if (miniVideo.paused) {
                    const p = miniVideo.play();
                    if (p) p.catch(() => { });
                }

                const rate = this.currentMedia.playbackRate || 1;
                if (this.lastMiniRate !== rate) {
                    miniVideo.playbackRate = rate;
                    this.lastMiniRate = rate;
                }
            }

            _syncMusicPageUI(curr, pct) {
                const musicPage = this.musicPageRefs.page;
                if (!musicPage) return;

                const now = performance.now();
                if (now - this.lastUiSyncTime < 50) return;
                this.lastUiSyncTime = now;

                const seekBar = this.musicPageRefs.seekBar;
                if (seekBar && !this.isSeeking) {
                    seekBar.value = pct;
                }

                const currTimeEl = this.musicPageRefs.currTimeEl;
                if (currTimeEl && now - this.lastTimeTextSync > 150) {
                    currTimeEl.innerText = this.formatTime(curr);
                    this.lastTimeTextSync = now;
                }

                this._syncMiniVideo(curr);
            }

            // --- 切换到音乐模式 ---
            switchToMusicMode() {
                if (this.isMusicPageActive) return;
                this.isMusicPageActive = true;

                if (!window.app.mainSwiper || !window.app.mainSwiper.slides) return;
                const slide = window.app.mainSwiper.slides[window.app.mainSwiper.activeIndex];

                const video = slide.querySelector('video');
                const audio = slide.querySelector('.bgm-audio');

                if (video && audio) {
                    const shouldKeepPlaying = this.currentMedia ? !this.currentMedia.paused : (!video.paused || !audio.paused);
                    if (Math.abs(audio.currentTime - video.currentTime) > 0.5) {
                        audio.currentTime = video.currentTime;
                    }

                    video.muted = true;
                    console.log('视频已静音')
                    if (shouldKeepPlaying && video.paused) {
                        video.play().catch(e => console.log('Background video play failed', e));
                    }

                    audio.muted = this._isMutedByLayer();
                    console.log('正在播放音乐')
                    if (shouldKeepPlaying) {
                        audio.play().catch(e => console.log('Music audio play failed', e));
                    } else {
                        audio.pause();
                    }

                    this.currentMedia = audio;
                    this._bindMediaEvents(audio);
                    this.lastMiniRate = audio.playbackRate || 1;
                    this.refreshMusicPageRefs(true);
                    this.updatePlayBtnState(shouldKeepPlaying);
                }
            }

            // --- 切换回视频模式 ---
            switchToVideoMode() {
                if (!this.isMusicPageActive) return;
                this.isMusicPageActive = false;

                if (!window.app.mainSwiper || !window.app.mainSwiper.slides) return;
                const slide = window.app.mainSwiper.slides[window.app.mainSwiper.activeIndex];

                const video = slide.querySelector('video');
                const audio = slide.querySelector('.bgm-audio');

                if (video && audio) {
                    const shouldKeepPlaying = this.currentMedia ? !this.currentMedia.paused : (!audio.paused || !video.paused);
                    if (Math.abs(video.currentTime - audio.currentTime) > 0.5) {
                        video.currentTime = audio.currentTime;
                    }

                    audio.muted = true;

                    console.log('音乐已静音')
                    video.muted = this.isGlobalMuted || this._isMutedByLayer();
                    console.log('视频正在播放')
                    if (shouldKeepPlaying && video.paused) {
                        video.play().catch(e => console.log('Video resume failed', e));
                    } else if (!shouldKeepPlaying) {
                        video.pause();
                    }

                    this.currentMedia = video;
                    this._bindMediaEvents(video);
                    this.lastMiniRate = video.playbackRate || 1;
                    this.updatePlayBtnState(shouldKeepPlaying);
                    this.syncActiveProgressNow();
                }
            }

            syncActiveProgressNow() {
                if (!window.app || !app.mainSwiper || !this.currentMedia) return;
                const slide = app.mainSwiper.slides[app.mainSwiper.activeIndex];
                if (!slide) return;
                const bars = slide.querySelectorAll('.progress-fill');
                if (bars.length && this.currentMedia.duration) {
                    const pct = (this.currentMedia.currentTime / this.currentMedia.duration) * 100;
                    bars.forEach(bar => { bar.style.width = `${pct}%`; });
                }
            }

            stop() {
                if (this.currentMedia) {
                    this.currentMedia.pause();
                    const container = this.currentMedia.closest('.swiper-slide');
                    if (container) {
                        const v = container.querySelector('video');
                        const a = container.querySelector('.bgm-audio');
                        if (v) v.pause();
                        if (a) a.pause();
                    }
                }

                this.currentMedia = null;
                this._unbindMediaEvents();
                this.manualPauseOverlay = false;

                if (this.gallerySwiper) {
                    if (this.gallerySwiper.autoplay) {
                        this.gallerySwiper.autoplay.stop();
                    }
                    if (this.gallerySwiper.el && this.gallerySwiper.el.restartAutoPlayTimer) {
                        clearTimeout(this.gallerySwiper.el.restartAutoPlayTimer);
                        this.gallerySwiper.el.restartAutoPlayTimer = null;
                    }
                    if (this.gallerySwiper.el) {
                        this.gallerySwiper.el.dataset.isManualInteracting = 'false';
                    }
                    this.gallerySwiper = null;
                }
                this._clearGalleryAutoTimer();
                if (window.app && app.galleryNextTimer) {
                    clearTimeout(app.galleryNextTimer);
                    app.galleryNextTimer = null;
                }
                document.querySelectorAll('.progress-fill').forEach(e => e.style.width = '0%');
                this.updatePlayBtnState(false);
            }

            _clearGalleryAutoTimer() {
                if (this.galleryAutoTimer) {
                    clearTimeout(this.galleryAutoTimer);
                    this.galleryAutoTimer = null;
                }
            }

            _getGalleryInterval() {
                return Math.max(1200, Number(CONFIG.GALLERY_AUTOPLAY_DELAY) || 2500);
            }

            _isActiveGallery(swiper) {
                if (!swiper || swiper.destroyed || !swiper.el) return false;
                const parentSlide = swiper.el.closest('.swiper-slide');
                return !!(parentSlide && parentSlide.classList.contains('swiper-slide-active'));
            }

            _isGalleryAutoNextEnabled() {
                return Number(CONFIG.GALLERY_AUTOPLAY_DELAY) > 0;
            }

            _getGalleryRealTotal(swiper) {
                if (!swiper || !swiper.el) return 0;
                const realSlides = swiper.el.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)');
                return realSlides.length || (swiper.slides ? swiper.slides.length : 0);
            }

            getGalleryMusicWait(swiper, baseDelayMs = 3000) {
                const slide = swiper && swiper.el ? swiper.el.closest('.swiper-slide') : null;
                const audio = slide ? slide.querySelector('.bgm-audio') : null;
                if (!audio || audio.paused) return baseDelayMs;

                const duration = audio.duration;
                if (!isFinite(duration) || isNaN(duration) || duration <= 0) return baseDelayMs;

                const remainingMs = Math.max(0, (duration - audio.currentTime) * 1000);
                return Math.max(baseDelayMs, remainingMs);
            }

            _handleGalleryLast(swiper, baseDelayMs = 3000) {
                this._clearGalleryAutoTimer();
                if (!this._isActiveGallery(swiper)) return;
                if (!this._isGalleryAutoNextEnabled()) return;

                const delay = this.getGalleryMusicWait(swiper, baseDelayMs);
                this.galleryAutoTimer = setTimeout(() => {
                    if (!this._isActiveGallery(swiper) || !this._isGalleryAutoNextEnabled()) return;
                    const isTopLayer = !document.querySelector('.page-layer.active') && !document.querySelector('.comment-layer.active');
                    if (isTopLayer && window.app && typeof app.triggerAutoNext === 'function') {
                        app.triggerAutoNext();
                    }
                }, delay);
            }

            _scheduleGalleryStep(swiper, delayOverride) {
                this._clearGalleryAutoTimer();
                if (!this._isActiveGallery(swiper)) return;
                if (Number(CONFIG.GALLERY_AUTOPLAY_DELAY) <= 0) return;

                const total = this._getGalleryRealTotal(swiper);
                if (total <= 1) {
                    this._handleGalleryLast(swiper, 3000);
                    return;
                }

                const current = typeof swiper.realIndex === 'number' ? swiper.realIndex : swiper.activeIndex;
                if (current >= total - 1) {
                    this._handleGalleryLast(swiper, 3000);
                    return;
                }

                const delay = typeof delayOverride === 'number' ? delayOverride : this._getGalleryInterval();
                this.galleryAutoTimer = setTimeout(() => {
                    if (!this._isActiveGallery(swiper)) return;
                    const idx = typeof swiper.realIndex === 'number' ? swiper.realIndex : swiper.activeIndex;
                    if (idx >= total - 1) {
                        this._handleGalleryLast(swiper, 3000);
                    } else {
                        swiper.slideNext(300);
                    }
                }, delay);
            }

            resumeGalleryAfterInteraction(swiper, delayMs = 3000) {
                if (!swiper || swiper.destroyed) return;
                this._scheduleGalleryStep(swiper, delayMs);
            }
            startProgress(slide) {
                const bars = slide.querySelectorAll('.progress-fill');
                const syncVideo = slide.querySelector('video');
                const syncAudio = slide.querySelector('.bgm-audio');

                const update = () => {
                    if (this.currentMedia) {
                        if (!this.currentMedia.paused) {
                            const curr = this.currentMedia.currentTime;
                            const dur = this.currentMedia.duration || 1;
                            const pct = (curr / dur) * 100;

                            if (bars.length && !this.isSeeking) {
                                bars.forEach(bar => { bar.style.width = pct + '%'; });
                            }

                            if (this.isMusicPageActive && syncVideo && syncAudio && this.currentMedia === syncAudio) {
                                const now = performance.now();
                                if (now - this.lastMediaSyncTime > 200) {
                                    const drift = Math.abs(syncVideo.currentTime - syncAudio.currentTime);
                                    if (drift > 0.35) {
                                        try { syncVideo.currentTime = syncAudio.currentTime; } catch (e) { /* ignore */ }
                                    }
                                    this.lastMediaSyncTime = now;
                                }
                            }

                            const musicPage = document.getElementById('music-manage-page');
                            const isMusicPageOpen = this.isMusicPageActive || (musicPage && musicPage.classList.contains('active'));
                            if (isMusicPageOpen) {
                                this.refreshMusicPageRefs();
                                this._syncMusicPageUI(curr, pct);
                            }
                        }
                        requestAnimationFrame(update);
                    }
                };
                update();
            }


            seek(pct) {
                // 如果 mainSwiper 为空，直接返回（防止报错）
                if (!window.app.mainSwiper) return;

                const slide = window.app.mainSwiper.slides[window.app.mainSwiper.activeIndex];
                const video = slide.querySelector('video');
                const audio = slide.querySelector('.bgm-audio');
                let targetTime = 0;

                if (this.currentMedia && this.currentMedia.duration) {
                    targetTime = pct * this.currentMedia.duration;
                    this.currentMedia.currentTime = targetTime;
                }

                if (this.currentMedia === video && audio) audio.currentTime = targetTime;
                if (this.currentMedia === audio && video) video.currentTime = targetTime;

                const musicPage = document.getElementById('music-manage-page');
                const isMusicPageOpen = this.isMusicPageActive || (musicPage && musicPage.classList.contains('active'));
                if (isMusicPageOpen) {
                    this.refreshMusicPageRefs();
                    this._syncMusicPageUI(targetTime, pct * 100);
                }
            }

            // --- 之前缺失的方法 ---

            // 切换播放/暂停
            toggleCurrent() {
                if (this.currentMedia) {
                    if (this.currentMedia.paused) {
                        this.manualPauseOverlay = false;
                        const p = this.currentMedia.play();
                        if (p) p.catch(() => this.updatePlayBtnState(false));
                        this.updatePlayBtnState(true);
                    } else {
                        this.manualPauseOverlay = true;
                        this.currentMedia.pause();
                        this.updatePlayBtnState(false);
                    }
                }
            }

            // 点击屏幕时的切换逻辑
            toggle(slide) {

                // 如果当前有媒体对象
                if (this.currentMedia) {
                    if (!this.currentMedia.paused) {
                        // 正在播放 -> 暂停
                        this.manualPauseOverlay = true;
                        this.currentMedia.pause();

                        // 如果是音乐模式，需要同时暂停视频
                        if (this.isMusicPageActive) {
                            const video = slide.querySelector('video');
                            if (video) video.pause();
                        }

                        this.updatePlayBtnState(false);
                    } else {
                        // 暂停中 -> 播放
                        this.manualPauseOverlay = false;
                        this.currentMedia.play();

                        // 如果是音乐模式，需要同时播放视频（静音）
                        if (this.isMusicPageActive) {
                            const video = slide.querySelector('video');
                            if (video) video.play().catch(() => { });
                        }

                        this.updatePlayBtnState(true);
                    }
                }
            }

            updatePlayBtnState(isPlaying) {
                const btn = document.getElementById('music-toggle-btn');
                if (btn) {
                    btn.innerHTML = isPlaying
                        ? '<i class="fa-solid fa-pause"></i>'
                        : '<i class="fa-solid fa-play" style="padding-left:4px;"></i>';
                }
                this.updatePlayOverlay(isPlaying);
            }

            updatePlayOverlay(isPlaying, slide = null) {
                const targetSlide = slide || (window.app && app.mainSwiper && app.mainSwiper.slides ? app.mainSwiper.slides[app.mainSwiper.activeIndex] : null);
                if (!targetSlide) return;
                const overlay = targetSlide.querySelector('.play-overlay');
                if (!overlay) return;
                overlay.classList.toggle('show', !isPlaying && this.manualPauseOverlay);
            }

            updateTotalTime(duration) {
                const totalEl = document.getElementById('music-total-time');
                if (totalEl && duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
                    totalEl.innerText = this.formatTime(duration);
                }
            }

            formatTime(seconds) {
                return formatDuration(seconds);
            }
        }

        // --- 1.5 自定义资源管理器 (仿照图集浏览完美版逻辑) ---

/* ---- app/data/11-custom-creator-manager.js ---- */
/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
        class CustomCreatorManager {
            constructor() {
                this.STORAGE_KEY = 'douxiuxiu_custom_creators';
                // 配置 localForage
                localforage.config({
                    name: 'DouXiuXiuApp',
                    storeName: 'creators_db'
                });
            }

            // 获取所有自定义资源
            // --- 修改：变成异步方法 ---
            async getAll() {
                try {
                    const val = await localforage.getItem(this.STORAGE_KEY);
                    return val || {};
                } catch (e) {
                    console.error('读取本地资源数据失败', e);
                    return {};
                }
            }
            // 增加一个批量保存方法，供 BackupManager 恢复数据使用
            async saveAll(allCreators) {
                await localforage.setItem(this.STORAGE_KEY, allCreators);
            }
            // 保存资源 (合并模式)
            // --- 修改：变成异步方法 ---
            async save(creatorData) {
                app.logger.info(`Saving creator: ${creatorData.info.name}`);
                if (!creatorData || !creatorData.info || !creatorData.info.name) {
                    return { success: false, message: '数据格式不正确' };
                }

                try {
                    const all = await this.getAll(); // 添加 await
                    // 标记为自定义
                    creatorData.isCustom = true;
                    all[creatorData.info.name] = creatorData;

                    await localforage.setItem(this.STORAGE_KEY, all); // 添加 await
                    return { success: true };
                } catch (e) {
                    // IndexedDB 很难存满，通常是磁盘满了
                    console.error(e);
                    return { success: false, message: '保存失败: ' + e.message };
                }
            }

            // 删除资源
            // --- 修改：变成异步方法 ---
            async delete(name) {
                const all = await this.getAll();
                if (all[name]) {
                    delete all[name];
                    await localforage.setItem(this.STORAGE_KEY, all);
                    return true;
                }
                return false;
            }

            // 导出资源数据 (生成JSON文件下载)
            async export(name) {
                const all = await this.getAll();
                const data = all[name];
                if (!data) return;

                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                saveAs(blob, `douxiuxiu_${name}.json`);
            }
        }

        // --- 媒体分析工具类 (修复版) ---

/* ---- app/data/12-media-analyzer.js ---- */
/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
        class MediaAnalyzer {
            constructor() {
                // 取色用的画布
                this.canvas = document.createElement('canvas');
                this.ctx = this.canvas.getContext('2d');
                this.width = 50;
                this.height = 50;
                this.canvas.width = this.width;
                this.canvas.height = this.height;
            }

            /**
             * 提取主色调 (同步)
             */
            extractColor(source) {
                const fallback = { hex: '#333333', rgb: 'rgb(51,51,51)' };
                if (!source) return fallback;

                try {
                    this.ctx.clearRect(0, 0, this.width, this.height);
                    // 尝试绘制，如果图片跨域且未开启CORS，这里也不会报错，但在getImageData时会报错
                    this.ctx.drawImage(source, 0, 0, this.width, this.height);

                    const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
                    const data = imgData.data;
                    let r = 0, g = 0, b = 0, count = 0;

                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] < 128) continue; // 忽略透明
                        r += data[i]; g += data[i + 1]; b += data[i + 2];
                        count++;
                    }

                    if (count === 0) return fallback;

                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    return {
                        hex: "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(),
                        rgb: `rgb(${r}, ${g}, ${b})`
                    };
                } catch (e) {
                    // 捕获跨域污染画布错误
                    return fallback;
                }
            }

            /**
             * 获取文件大小 (异步 - 增强版)
             * 策略：DataURI -> Blob -> Performance API -> Direct HEAD -> Proxy HEAD
             */
            async getFileSize(url) {
                if (!url) return '未知';

                // 1. 本地 Data URI (Base64)
                if (url.startsWith('data:')) {
                    // 计算公式：(字符长度 * 3/4) - padding
                    const size = Math.round((url.length - url.indexOf(',') - 1) * 0.75);
                    return this.formatBytes(size);
                }

                // 2. 本地 Blob URL
                if (url.startsWith('blob:')) {
                    try {
                        // Blob URL 可以直接 fetch 获取大小
                        const res = await fetch(url);
                        const blob = await res.blob();
                        return this.formatBytes(blob.size);
                    } catch (e) {
                        return '本地资源';
                    }
                }

                // 3. Performance API (最快，读取缓存/网络日志)
                // 注意：跨域资源如果服务器未发送 Timing-Allow-Origin，transferSize 可能为 0
                const perf = performance.getEntriesByName(url);
                if (perf.length > 0) {
                    const last = perf[perf.length - 1];
                    // 优先取 encodedBodySize (压缩后大小)，其次 transferSize (网络传输大小)，最后 decodedBodySize
                    const size = last.encodedBodySize || last.transferSize || last.decodedBodySize;
                    if (size > 0) return this.formatBytes(size);
                }

                // 4. 尝试发送 HEAD 请求 (Direct)
                try {
                    const res = await fetch(url, { method: 'HEAD' });
                    const len = res.headers.get('content-length');
                    if (len && parseInt(len) > 0) {
                        return this.formatBytes(parseInt(len));
                    }
                } catch (e) {
                    // 忽略 CORS 错误，继续尝试代理
                }

                // 5. 尝试使用下载代理 (Proxy fallback)
                // 如果直连因为 CORS 失败，走 PHP 代理通常能拿到 header
                if (app && app.downloadMgr && app.downloadMgr.proxy) {
                    try {
                        const proxyUrl = app.downloadMgr.proxy + encodeURIComponent(url);
                        // 注意：有些简单代理不支持 HEAD，如果失败可以尝试极短超时的 GET
                        const res = await fetch(proxyUrl, { method: 'HEAD' });
                        const len = res.headers.get('content-length');
                        if (len && parseInt(len) > 0) {
                            return this.formatBytes(parseInt(len));
                        }
                    } catch (e) {
                        console.warn('Proxy size check failed');
                    }
                }

                return '未知大小';
            }

            // 字节格式化 helper
            formatBytes(bytes, decimals = 2) {
                if (!bytes || bytes === 0) return '0 B';
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
            }
        }
        // --- 任务9完全修复：点击即全屏+强制旋转 (移除系统方向锁) ---

/* ---- app/player/13-landscape-player.js ---- */
/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
class LandscapePlayer {
    constructor() {
        this.root = null;
        this.playerWrapper = null;
        this.video = null;
        this.image = null;
        this.uiLayer = null;
        this.sidePanel = null;
        this.sideTitle = null;
        this.sideBody = null;
        this.sideFooter = null;
        this.sourceVideo = null;
        this.landscapeBgmAudio = null;
        this.activePanel = null;
        this.chatHost = null;
        this.chatPlaceholder = null;
        this.chatOriginalParent = null;
        this.chatOriginalNext = null;
        this.musicContentHost = null;
        this.musicContentOriginalParent = null;
        this.musicContentOriginalNext = null;

        this.isActive = false;
        this.isSeeking = false;
        this.uiTimer = null;
        this.loopTimer = null;
        this.toastTimer = null;
        this.galleryTimer = null;
        this.galleryImages = [];
        this.galleryIndex = 0;
        this.isGallery = false;
        this.galleryPaused = false;
        this.galleryProgress = null;
        this.galleryStepStartedAt = 0;
        this.galleryStepDuration = 0;
        this.lastLandscapeMiniSync = 0;

        this.brightness = 1.0;
        this.currentData = null; // 当前播放的数据对象

        this._onResize = this._onResize.bind(this);
    }

    // ================== 1. 初始化与样式构建 ==================

    init() {
        if (this.root) return;

        this._injectStyles();

        this.root = document.createElement('div');
        this.root.className = 'lp-root';

        this.playerWrapper = document.createElement('div');
        this.playerWrapper.className = 'lp-player-wrapper';

        this.video = document.createElement('video');
        this.video.className = 'lp-video';
        this.video.setAttribute('playsinline', 'true');
        this.video.setAttribute('webkit-playsinline', 'true');
        this.video.setAttribute('poster', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

        this.video.addEventListener('ended', () => this.onVideoEnded());
        this.video.addEventListener('waiting', () => this.showLoading(true));
        this.video.addEventListener('playing', () => this.showLoading(false));
        this.video.addEventListener('timeupdate', () => this._syncTimeUI());

        this.image = document.createElement('img');
        this.image.className = 'lp-gallery-image';
        this.image.alt = '';
        // 点击视频区域显示/隐藏UI (保持不变)
        // 注意：_bindGestures 里的 touchend 已经处理了点击，这里其实可以移除，但为了双重保险保留也无妨，只要stopPropagation即可

        this.brightnessMask = document.createElement('div');
        this.brightnessMask.className = 'lp-brightness-mask';

        this.uiLayer = document.createElement('div');
        this.uiLayer.className = 'lp-ui-layer';

        const header = document.createElement('div');
        header.className = 'lp-header';

        const backBtn = document.createElement('div');
        backBtn.className = 'lp-btn-icon';
        backBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        backBtn.onclick = (e) => { e.stopPropagation(); this.exit(); };

        // --- 核心修改：标题容器结构 ---
        const metaContainer = document.createElement('div');
        metaContainer.className = 'lp-meta-container';
        metaContainer.innerHTML = `
            <div class="lp-title-box" onclick="app.landscapePlayer.toggleTitle(event)">
                <span id="lp-title" class="lp-title-text"></span>
            </div>
            <div class="lp-author-row">
                <img id="lp-avatar" src="">
                <div id="lp-author" class="lp-name"></div>
            </div>
        `;

        const settingBtn = document.createElement('div');
        settingBtn.className = 'lp-btn-icon lp-settings-toggle';
        settingBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
        settingBtn.onclick = (e) => { e.stopPropagation(); this.openPanel('settings'); };

        header.append(backBtn, metaContainer, settingBtn);

        // --- B. 右侧互动栏 ---
        const rightSidebar = document.createElement('div');
        rightSidebar.className = 'lp-right-sidebar';
        rightSidebar.innerHTML = `
            <div class="lp-sidebar-item" id="lp-btn-like">
                <i class="fa-solid fa-heart" id="lp-like-icon"></i>
                <span id="lp-like-count">0</span>
            </div>
            <div class="lp-sidebar-item" id="lp-btn-chat">
                <i class="fa-solid fa-comment-dots"></i>
                <span id="lp-comment-count">0</span>
            </div>
            <div class="lp-sidebar-item" id="lp-btn-share">
                <i class="fa-solid fa-share"></i>
                <span>分享</span>
            </div>
            <div class="lp-sidebar-item" id="lp-btn-music">
                <i class="fa-solid fa-music"></i>
                <span>音乐</span>
            </div>
        `;
        rightSidebar.querySelector('#lp-btn-like').onclick = (e) => {
            e.stopPropagation();
            this.toggleLike();
        };
        rightSidebar.querySelector('#lp-btn-chat').onclick = (e) => {
            e.stopPropagation();
            this.openPanel('chat');
        };
        rightSidebar.querySelector('#lp-btn-share').onclick = (e) => {
            e.stopPropagation();
            this.openPanel('share');
        };
        rightSidebar.querySelector('#lp-btn-music').onclick = (e) => {
            e.stopPropagation();
            this.openPanel('music');
        };

        // --- C. 中间控制区 ---
        this.centerControls = document.createElement('div');
        this.centerControls.className = 'lp-center-controls';

        const prevBtn = document.createElement('div');
        prevBtn.className = 'lp-ctrl-btn side';
        prevBtn.innerHTML = '<i class="fa-solid fa-backward-step"></i>';
        prevBtn.onclick = (e) => { e.stopPropagation(); this.switchVideo('prev'); };

        this.playPauseBtnBig = document.createElement('div');
        this.playPauseBtnBig.className = 'lp-ctrl-btn main';
        this.playPauseBtnBig.innerHTML = '<i class="fa-solid fa-play"></i>';
        this.playPauseBtnBig.onclick = (e) => { e.stopPropagation(); this.togglePlay(); };

        const nextBtn = document.createElement('div');
        nextBtn.className = 'lp-ctrl-btn side';
        nextBtn.innerHTML = '<i class="fa-solid fa-forward-step"></i>';
        nextBtn.onclick = (e) => { e.stopPropagation(); this.switchVideo('next'); };

        this.centerControls.append(prevBtn, this.playPauseBtnBig, nextBtn);

        // --- D. 底部进度栏 ---
        const footer = document.createElement('div');
        footer.className = 'lp-footer';

        this.timeCurrent = document.createElement('span');
        this.timeCurrent.innerText = "00:00";
        this.timeCurrent.className = 'lp-time';

        this.progressBar = document.createElement('input');
        this.progressBar.type = 'range';
        this.progressBar.className = 'lp-progress';
        this.progressBar.min = 0; this.progressBar.max = 100; this.progressBar.step = 0.1;

        this.progressBar.oninput = (e) => {
            this.isSeeking = true;
            this.showUI();
            const pct = e.target.value / 100;
            this.progressBar.style.setProperty('--lp-progress-pct', `${e.target.value}%`);
            if (this.isGallery) {
                const idx = Math.round(pct * Math.max(0, this.galleryImages.length - 1));
                this.galleryIndex = idx;
                this._renderGalleryImage();
                return;
            }
            if (this.video.duration) {
                this.timeCurrent.innerText = app.mediaManager.formatTime(pct * this.video.duration);
            }
        };
        this.progressBar.onchange = (e) => {
            if (this.isGallery) {
                this._syncSourceGallery();
                this.isSeeking = false;
                this._markGalleryInteraction();
                return;
            }
            if (this.video.duration) {
                this.video.currentTime = (e.target.value / 100) * this.video.duration;
            }
            this.isSeeking = false;
            this.resetHideTimer();
        };

        this.timeTotal = document.createElement('span');
        this.timeTotal.innerText = "00:00";
        this.timeTotal.className = 'lp-time';

        this.galleryProgress = document.createElement('div');
        this.galleryProgress.className = 'lp-gallery-progress';
        this.galleryProgress.style.display = 'none';

        footer.append(this.timeCurrent, this.progressBar, this.galleryProgress, this.timeTotal);

        // --- E. 辅助组件 ---
        this.toast = document.createElement('div');
        this.toast.className = 'lp-toast';

        this.settingsPanel = document.createElement('div');
        this.settingsPanel.className = 'lp-settings-panel';
        this._buildSettingsContent();

        this.sidePanel = document.createElement('aside');
        this.sidePanel.className = 'lp-side-panel';
        this.sidePanel.innerHTML = `
            <div class="lp-panel-header">
                <div class="lp-panel-title">面板</div>
                <div class="lp-panel-close" data-clickable><i class="fa-solid fa-xmark"></i></div>
            </div>
            <div class="lp-panel-body"></div>
            <div class="lp-panel-footer" style="display:none;"></div>
        `;
        this.sideTitle = this.sidePanel.querySelector('.lp-panel-title');
        this.sideBody = this.sidePanel.querySelector('.lp-panel-body');
        this.sideFooter = this.sidePanel.querySelector('.lp-panel-footer');
        this.sidePanel.querySelector('.lp-panel-close').onclick = (e) => {
            e.stopPropagation();
            this.closePanel();
        };

        this.loadingEl = document.createElement('div');
        this.loadingEl.className = 'lp-loading';
        this.loadingEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        this.uiLayer.append(header, rightSidebar, this.centerControls, footer);
        this.playerWrapper.append(this.video, this.image, this.brightnessMask, this.uiLayer, this.toast, this.loadingEl);
        this.root.append(this.playerWrapper, this.sidePanel);
        document.body.appendChild(this.root);

        this._bindGestures();
    }
    _injectStyles() {
        if (document.getElementById('lp-styles')) return;
        const style = document.createElement('style');
        style.id = 'lp-styles';
        style.innerHTML = `
        /* 1. 根容器改为 Flex 布局 */
        .lp-root {
            position: fixed; top: 0; left: 0;
            background-color: #000; z-index: 99999; display: none;
            overflow: hidden; transform-origin: center center;
            /* 关键：使用 Flex 布局管理左右分栏 */
            flex-direction: row; 
        }

        /* 2. 播放器包裹层 (左侧区域) */
        .lp-player-wrapper {
            position: relative;
            flex: 1 1 auto; /* 默认占满剩余空间 */
            min-width: 0;
            height: 100%;
            overflow: hidden;
            transition: width 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), flex-basis 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
            background: #000;
        }

        /* 视频和UI层现在相对于 player-wrapper 定位 */
        .lp-video,
        .lp-gallery-image { width: 100%; height: 100%; object-fit: contain; display: block; background: #000; }
        .lp-gallery-image { display: none; user-select: none; -webkit-user-drag: none; }
        .lp-brightness-mask {
            position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; z-index: 8;
        }
        .lp-ui-layer {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; flex-direction: column; justify-content: space-between;
            background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.8) 100%);
            transition: opacity 0.3s; z-index: 10; pointer-events: none;
        }
        /* 恢复UI内部点击 */
        .lp-ui-layer > * { pointer-events: auto; }

        /* 3. 右侧侧边栏 (评论/分享) */
        .lp-side-panel {
            width: 0;
            height: 100%;
            background: #111;
            border-left: 1px solid rgba(255,255,255,0.1);
            overflow: hidden;
            transform: translateX(100%);
            opacity: 0;
            visibility: hidden;
            transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease, visibility 0.2s ease;
            display: flex; flex-direction: column;
            flex: 0 0 0;
            box-shadow: -18px 0 40px rgba(0,0,0,0.35);
        }

        /* 激活状态：侧边栏展开 */
        .lp-root.split-mode .lp-side-panel {
            width: clamp(260px, 25vw, 360px);
            flex-basis: clamp(260px, 25vw, 360px);
            transform: translateX(0);
            opacity: 1;
            visibility: visible;
        }
        
        /* 移动端适配：如果是竖屏手机旋转过来的，宽度占比稍微大一点 */
        @media (max-height: 500px) {
            .lp-root.split-mode .lp-side-panel {
                width: 25vw;
                flex-basis: 25vw;
            }
        }

        /* --- 侧边栏内部样式 --- */
        .lp-panel-header {
            height: 54px; display: flex; align-items: center; justify-content: space-between;
            padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,0.08); color: #fff; font-size: 15px; font-weight: bold;
            flex: 0 0 54px;
        }
        .lp-panel-close { cursor: pointer; padding: 10px; color: #ccc; }
        .lp-panel-body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
        .lp-panel-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; }
        
        /* 评论输入框区域 */
        .lp-panel-footer {
            padding: 10px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            display: flex; gap: 10px;
        }
        .lp-input {
            flex: 1; background: rgba(255,255,255,0.1); border: none; border-radius: 18px;
            height: 36px; padding: 0 15px; color: #fff; font-size: 13px; outline: none;
        }
        
        /* 评论列表项 */
        .lp-comment-item { display: flex; gap: 10px; margin-bottom: 15px; }
        .lp-comment-avatar { width: 32px; height: 32px; border-radius: 50%; background: #333; flex-shrink: 0; }
        .lp-comment-info { flex: 1; font-size: 13px; }
        .lp-comment-user { color: #888; font-size: 12px; margin-bottom: 2px; }
        .lp-comment-text { color: #ddd; line-height: 1.4; }

        /* 分享网格 */
        .lp-share-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .lp-share-item { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 12px; }
        .lp-share-icon { 
            width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.1); 
            display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff;
            transition: background 0.2s;
        }
        .lp-share-item:active .lp-share-icon { background: rgba(255,255,255,0.2); }
        .lp-download-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px; border-top: 1px solid rgba(255,255,255,0.08); }
        .lp-action-btn {
            height: 34px; min-width: 0; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;
            background: rgba(255,255,255,0.1); color: #fff; font-size: 12px; cursor: pointer; user-select: none;
            white-space: nowrap; overflow: hidden;
        }
        .lp-action-btn i { font-size: 13px; flex: 0 0 auto; }
        .lp-action-btn span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .lp-action-btn.primary { background: #5cc9ff; color: #051018; font-weight: 700; }
        .lp-action-btn:active { transform: scale(0.98); }
        .lp-panel-body .chat-container { height: 100%; flex: 1; min-height: 0; background: transparent !important; }
        .lp-panel-body .chat-list { padding: 12px !important; }
        .lp-panel-body .comment-input-bar {
            flex-shrink: 0; padding: 8px; display: grid !important;
            grid-template-columns: 28px 28px minmax(0, 1fr) 48px; gap: 6px; align-items: center;
            width: 100%; box-sizing: border-box;
        }
        .lp-panel-body .chat-tool-btn {
            width: 28px; height: 32px; display: flex; align-items: center; justify-content: center;
            margin: 0 !important; flex: 0 0 auto; font-size: 16px;
        }
        .lp-panel-body .c-input {
            width: 100% !important; min-width: 0; height: 34px; box-sizing: border-box;
            padding: 0 10px; font-size: 12px;
        }
        .lp-panel-body .c-btn {
            width: 48px; min-width: 48px; height: 34px; padding: 0; font-size: 12px;
            display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
        }
        .lp-panel-body .dl-grid-container { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }
        .lp-panel-body .dl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .lp-panel-body .dl-item { aspect-ratio: 1 / 1.25; border-radius: 8px; overflow: hidden; }
        .lp-panel-body .lp-settings-panel {
            position: static; width: 100%; height: auto; transform: none !important; background: transparent;
            backdrop-filter: none; padding: 16px; z-index: auto; overflow-y: auto; flex: 1;
        }
            
            /* 头部样式 */
            .lp-header {
                display: flex; align-items: flex-start; padding: 20px 30px; gap: 15px; color: #fff;
                height: 80px; box-sizing: border-box; flex-shrink: 0; pointer-events: none;
            }
            .lp-btn-icon {
                font-size: 18px; cursor: pointer; width: 36px; height: 36px;
                display: flex; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.15); border-radius: 50%;
                backdrop-filter: blur(5px); pointer-events: auto; flex-shrink: 0;
            }
            
            /* 标题容器 */
            .lp-meta-container {
                flex: 1; display: flex; flex-direction: column; justify-content: center;
                margin-top: 5px; overflow: visible; pointer-events: auto; min-width: 0; position: relative;
            }
            .lp-title-box {
                position: relative; width: 100%; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }
            .lp-title-text {
                font-size: 15px; font-weight: bold;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                text-shadow: 0 1px 3px rgba(0,0,0,0.8); line-height: 1.4; color: #fff;
            }
            .lp-expand-btn {
                display: inline-block; font-size: 12px; color: rgba(255,255,255,0.7); 
                margin-left: 8px; cursor: pointer; background: rgba(255,255,255,0.1); 
                padding: 1px 6px; border-radius: 4px; vertical-align: middle;
            }
        
        /* === 核心修改：展开后的样式 === */
        .lp-title-box.expanded {
            /* 使用 fixed 脱离顶部 header 文档流，相对于 lp-root 定位 */
            position: fixed; 
            top: 60px; 
            left: 20px; 
            /* 宽度：预留右侧按钮空间 (右侧栏约占 80px) */
            width: calc(100% - 100px); 
            max-width: 650px; /* 大屏限制最大宽 */
            
            /* 高度核心限制：屏幕高度 - 顶部间距 - 底部进度条区域(约90px) */
            max-height: calc(100% - 110px);
            background: rgba(15,15,15,0.5);
            backdrop-filter: blur(20px); 
            -webkit-backdrop-filter: blur(20px);
            
            padding: 16px 20px; 
            border-radius: 16px; 
            z-index: 999; /* 确保在最上层 */
            
            box-shadow: 0 10px 40px rgba(0,0,0,0.8); 
            border: 1px solid rgba(255,255,255,0.1);
            
            display: flex;
            flex-direction: column;
            
            /* 动画优化 */
            will-change: transform, opacity;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .lp-title-text {
            font-size: 15px; font-weight: bold;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8); line-height: 1.4; color: #fff;
        }

     .lp-title-box.expanded .lp-title-text {
    white-space: normal !important;
    overflow: auto !important;
    max-height: calc(100vh - 150px);
    padding-right: 10px;
    line-height: 1.6;
}

        .lp-title-box.expanded::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 20px;
            background: linear-gradient(to top, rgba(15,15,15,0.9), transparent);
            border-radius: 0 0 16px 16px;
            pointer-events: none;
        }
            .lp-author-row {
                display: flex; align-items: center; gap: 8px; width: 100%; overflow: hidden;
            }
            #lp-avatar {
                width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.6); object-fit: cover; flex-shrink: 0;
            }
            .lp-name {
                font-size: 12px; color: #ddd; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }

            /* 右侧边栏 */
            .lp-right-sidebar {
                position: absolute; right: 25px; top: 50%; transform: translateY(-50%);
                display: flex; flex-direction: column; gap: 25px; align-items: center; pointer-events: auto;
                transition: right 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease;
            }
            .lp-root.split-mode .lp-right-sidebar {
                opacity: 0;
                pointer-events: none;
                transform: translateY(-50%) translateX(12px);
            }
            .lp-root.split-mode .lp-settings-toggle {
                opacity: 0;
                pointer-events: none;
            }
            .lp-sidebar-item {
                display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
            }
            .lp-sidebar-item:active { transform: scale(0.9); }
            .lp-sidebar-item i {
                font-size: 20px; color: #fff; text-shadow: 0 2px 5px rgba(0,0,0,0.5); transition: color 0.2s;
            }
            .lp-sidebar-item span {
                font-size: 11px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: 500;
            }

            /* 中间控制 */
            .lp-center-controls {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                display: flex; align-items: center; gap: 50px; pointer-events: auto;
            }
            .lp-ctrl-btn {
                display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff;
                opacity: 0.9; transition: transform 0.1s; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));
            }
            .lp-ctrl-btn:active { transform: scale(0.9); }
            .lp-ctrl-btn.side { font-size: 32px; opacity: 0.8; }
            
            /* === 核心修改：去除中间按钮背景 === */
            .lp-ctrl-btn.main { 
                font-size: 70px; /* 稍微放大 */
                width: 80px; height: 80px; 
                background: transparent; /* 透明 */
                border-radius: 50%; 
            }
            
            /* 底部 */
            .lp-footer {
                display: flex; align-items: center; padding: 12px 22px 22px 22px; gap: 8px; color: #fff; flex-shrink: 0; pointer-events: auto;
                background: linear-gradient(to top, rgba(0,0,0,0.45), transparent);
            }
            .lp-time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; opacity: 0.95; min-width: 38px; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.7); }
            .lp-progress {
                --lp-progress-pct: 0%;
                flex: 1; height: 12px; appearance: none; -webkit-appearance: none;
                background: transparent; outline: none; cursor: pointer; border-radius: 999px;
            }
            .lp-progress::-webkit-slider-runnable-track {
                height: 4px; border-radius: 999px;
                background: linear-gradient(90deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.85) var(--lp-progress-pct), rgba(255,255,255,0.35) var(--lp-progress-pct), rgba(255,255,255,0.35) 100%);
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
            }
            .lp-progress::-webkit-slider-thumb {
                -webkit-appearance: none; width: 0; height: 0; margin-top: 0; border: none; background: transparent; box-shadow: none;
            }
            .lp-progress::-webkit-slider-thumb:active { transform: none; }
            .lp-progress::-moz-range-track { height: 4px; border-radius: 999px; background: rgba(255,255,255,0.35); }
            .lp-progress::-moz-range-progress { height: 4px; border-radius: 999px; background: rgba(255,255,255,0.85); }
            .lp-progress::-moz-range-thumb { width: 0; height: 0; border: none; background: transparent; box-shadow: none; }
            .lp-gallery-progress {
                flex: 1; height: 10px; display: flex; align-items: center; gap: 4px; min-width: 0;
            }
            .lp-gallery-segment {
                flex: 1; height: 4px; border-radius: 999px; overflow: hidden;
                background: rgba(255,255,255,0.28); cursor: pointer; min-width: 8px;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
            }
            .lp-gallery-segment-fill {
                display: block; width: 0%; height: 100%; border-radius: inherit;
                background: rgba(255,255,255,0.92); transition: width 0.18s ease;
            }
            .lp-gallery-segment.done .lp-gallery-segment-fill { width: 100%; }
            .lp-gallery-segment.active .lp-gallery-segment-fill { width: var(--lp-gallery-active-pct, 0%); }
            .lp-music-panel { padding: 18px; color: #fff; display: flex; flex-direction: column; gap: 16px; }
            .lp-music-cover {
                width: 150px; height: 150px; border-radius: 12px; overflow: hidden; align-self: center;
                background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center;
                font-size: 46px; color: rgba(255,255,255,0.55);
            }
            .lp-music-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .lp-music-meta { text-align: center; min-width: 0; }
            .lp-music-title { font-size: 18px; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
            .lp-music-author { margin-top: 5px; font-size: 13px; color: rgba(255,255,255,0.62); overflow-wrap: anywhere; }
            .lp-music-progress { display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.72); }
            .lp-music-track { flex: 1; height: 4px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,0.22); }
            .lp-music-track span { display: block; width: 0%; height: 100%; background: #fff; border-radius: inherit; }
            .lp-music-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .lp-music-btn {
                border: 0; border-radius: 8px; background: rgba(255,255,255,0.12); color: #fff;
                padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px;
                font-size: 12px; cursor: pointer;
            }
            .lp-music-empty { color: rgba(255,255,255,0.55); text-align: center; font-size: 13px; }
            .lp-mounted-music-content {
                width: 100%; height: 100%; min-height: 0; padding: 16px;
                box-sizing: border-box; color: #fff; background: transparent;
            }
            .lp-mounted-music-content .music-mini-player { max-width: 100%; }
            .lp-mounted-music-content .music-actions-grid { margin-top: 0; }
            /* 辅助层 */
            .lp-toast {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.7); padding: 12px 20px; border-radius: 8px;
                display: flex; flex-direction: row; gap: 10px; align-items: center; color: #fff;
                pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 30;
                backdrop-filter: blur(5px);
            }
            .lp-settings-panel {
                position: absolute; top: 0; right: 0; width: 280px; height: 100%;
                background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
                transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                display: flex; flex-direction: column; padding: 30px; box-sizing: border-box; z-index: 40; pointer-events: auto;
            }
            .lp-loading {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                pointer-events: none; display: none; z-index: 5; font-size: 40px; color: rgba(255,255,255,0.8);
            }
        `;
        document.head.appendChild(style);
    }
    _buildSettingsContent() {
        const createGroup = (title, items, action) => {
            const group = document.createElement('div');
            group.style.marginBottom = '25px';
            const label = document.createElement('div');
            label.innerText = title;
            label.style.cssText = "color: #888; font-size: 12px; margin-bottom: 10px;";
            const row = document.createElement('div');
            row.style.cssText = "display: flex; flex-wrap: wrap; gap: 10px;";
            items.forEach(item => {
                const btn = document.createElement('div');
                btn.innerText = item.text;
                btn.dataset.val = item.val;
                btn.style.cssText = "padding: 6px 14px; border-radius: 20px; font-size: 13px; color: #fff; background: rgba(255,255,255,0.15); cursor: pointer; transition: all 0.2s;";
                btn.onclick = (e) => {
                    e.stopPropagation();
                    Array.from(row.children).forEach(b => {
                        b.style.color = '#fff'; b.classList.remove('active');
                    });
                    btn.style.background = '#5cc9ff'; btn.style.color = '#000'; btn.classList.add('active');
                    action(item.val);
                };
                row.appendChild(btn);
            });
            group.append(label, row);
            return group;
        };
        this.settingsPanel.appendChild(createGroup('播放速度', [
            { text: '0.75x', val: 0.75 }, { text: '1.0x', val: 1.0 }, { text: '1.25x', val: 1.25 }, { text: '1.5x', val: 1.5 }, { text: '2.0x', val: 2.0 }
        ], (v) => this.setSpeed(v)));
        this.settingsPanel.appendChild(createGroup('画面尺寸', [
            { text: '适应', val: 'contain' }, { text: '铺满', val: 'cover' }, { text: '拉伸', val: 'fill' }
        ], (v) => this.setFit(v)));
    }

    openPanel(type) {
        this.init();
        if (this.activePanel === type && this.root.classList.contains('split-mode')) {
            this.closePanel();
            return;
        }

        this._restoreChatHost();
        this._restoreMusicManageContent();
        this.sideBody.replaceChildren();
        this.sideFooter.replaceChildren();
        this.sideFooter.style.display = 'none';
        this.sideFooter.className = 'lp-panel-footer';

        this.activePanel = type;
        this.root.classList.add('split-mode');
        this.showUI();
        if (this.uiTimer) clearTimeout(this.uiTimer);

        if (type === 'chat') {
            this.sideTitle.innerText = '聊天室';
            this._mountChatPanel();
        } else if (type === 'share') {
            this.sideTitle.innerText = '分享/下载';
            this._renderSharePanel();
        } else if (type === 'music') {
            this.sideTitle.innerText = '音乐';
            this._mountMusicManagePanel();
        } else {
            this.sideTitle.innerText = '播放设置';
            this.sideBody.appendChild(this.settingsPanel);
            this._updateSettingsUI();
        }
    }

    closePanel() {
        if (!this.root) return;
        this._restoreChatHost();
        this._restoreMusicManageContent();
        this.root.classList.remove('split-mode');
        this.activePanel = null;
        this.sideBody.replaceChildren();
        this.sideFooter.replaceChildren();
        this.sideFooter.style.display = 'none';
        this.sideFooter.className = 'lp-panel-footer';
        this.resetHideTimer();
    }

    _mountChatPanel() {
        const chat = document.querySelector('#comment-layer .chat-container');
        if (!chat) {
            this.sideBody.innerHTML = '<div class="lp-panel-scroll" style="color:#aaa;">聊天室暂不可用</div>';
            return;
        }
        this.chatHost = chat;
        this.chatOriginalParent = chat.parentNode;
        this.chatOriginalNext = chat.nextSibling;
        this.chatPlaceholder = document.createComment('landscape-chat-placeholder');
        this.chatOriginalParent.insertBefore(this.chatPlaceholder, chat);
        document.getElementById('comment-layer')?.classList.remove('active');
        this.sideBody.appendChild(chat);
        if (app.chat) app.chat.checkLogin();
        setTimeout(() => {
            const list = document.getElementById('chat-list');
            if (list) list.scrollTop = list.scrollHeight;
        }, 50);
    }

    _restoreChatHost() {
        if (!this.chatHost || !this.chatOriginalParent) return;
        if (this.chatOriginalNext && this.chatOriginalNext.parentNode === this.chatOriginalParent) {
            this.chatOriginalParent.insertBefore(this.chatHost, this.chatOriginalNext);
        } else if (this.chatPlaceholder && this.chatPlaceholder.parentNode === this.chatOriginalParent) {
            this.chatOriginalParent.insertBefore(this.chatHost, this.chatPlaceholder);
        } else {
            this.chatOriginalParent.appendChild(this.chatHost);
        }
        if (this.chatPlaceholder && this.chatPlaceholder.parentNode) {
            this.chatPlaceholder.parentNode.removeChild(this.chatPlaceholder);
        }
        this.chatHost = null;
        this.chatPlaceholder = null;
        this.chatOriginalParent = null;
        this.chatOriginalNext = null;
    }

    _mountMusicManagePanel() {
        const content = document.getElementById('music-manage-content');
        if (!content || !app.renderer || !app.pageManager) {
            this._renderMusicPanel();
            return;
        }

        const data = this.currentData || (app.fullPlaylist && app.fullPlaylist[app.mainSwiper?.activeIndex]) || {};
        const music = data.music_info || {};
        if (!music.url && !music.title && app.interaction) {
            app.interaction.showToast('\u8be5\u4f5c\u54c1\u6682\u65e0\u6709\u6548\u97f3\u4e50\u4fe1\u606f');
        }

        this._setLandscapeAudioMode('music');
        const musicPage = document.getElementById('music-manage-page');
        const wasMusicPageActive = !!(musicPage && musicPage.classList.contains('active'));
        if (musicPage) musicPage.classList.add('active');
        app.renderer.renderMusicPage(music);
        app.pageManager.refreshMusicInfo(data);

        if (!this.musicContentHost) {
            this.musicContentHost = content;
            this.musicContentOriginalParent = content.parentNode;
            this.musicContentOriginalNext = content.nextSibling;
        }

        if (musicPage && !wasMusicPageActive) musicPage.classList.remove('active');
        content.classList.add('lp-mounted-music-content');
        this.sideBody.appendChild(content);

        if (app.mediaManager) {
            app.mediaManager.refreshMusicPageRefs(true);
            const media = app.mediaManager.currentMedia;
            if (media && media.duration && app.mediaManager._syncMusicPageUI) {
                app.mediaManager._syncMusicPageUI(media.currentTime || 0, ((media.currentTime || 0) / media.duration) * 100);
            }
            this._syncLandscapeMiniPreview(true);
        }
    }

    _restoreMusicManageContent() {
        if (!this.musicContentHost || !this.musicContentOriginalParent) return;
        this.musicContentHost.classList.remove('lp-mounted-music-content');
        if (this.musicContentOriginalNext && this.musicContentOriginalNext.parentNode === this.musicContentOriginalParent) {
            this.musicContentOriginalParent.insertBefore(this.musicContentHost, this.musicContentOriginalNext);
        } else {
            this.musicContentOriginalParent.appendChild(this.musicContentHost);
        }
        this.musicContentHost = null;
        this.musicContentOriginalParent = null;
        this.musicContentOriginalNext = null;
        this._setLandscapeAudioMode('default');
        if (app.mediaManager) app.mediaManager.refreshMusicPageRefs(true);
    }

    _getActiveSlideAudio() {
        const slide = app.mainSwiper?.slides?.[app.mainSwiper.activeIndex] || null;
        const audio = slide ? slide.querySelector('.bgm-audio') : null;
        return { slide, audio };
    }

    _syncAudioToLandscapeVideo(audio) {
        if (!audio || this.isGallery || !this.video) return;
        const videoTime = this.video.currentTime || 0;
        if (Math.abs((audio.currentTime || 0) - videoTime) > 0.35) {
            try { audio.currentTime = videoTime; } catch (e) { /* ignore */ }
        }
    }

    _syncLandscapeVideoToAudio(audio) {
        if (!audio || this.isGallery || !this.video) return;
        const audioTime = audio.currentTime || 0;
        if (Math.abs((this.video.currentTime || 0) - audioTime) > 0.25) {
            try { this.video.currentTime = audioTime; } catch (e) { /* ignore */ }
        }
    }

    _setLandscapeAudioMode(mode = 'default') {
        const { audio } = this._getActiveSlideAudio();
        this.landscapeBgmAudio = audio || null;

        if (!audio) {
            if (!this.isGallery && this.video) this.video.muted = false;
            if (app.mediaManager && !this.isGallery && this.video) {
                app.mediaManager.currentMedia = this.video;
                app.mediaManager.updatePlayBtnState(!this.video.paused);
            }
            return;
        }

        if (this.isGallery) {
            audio.muted = false;
            audio.play().catch(e => console.log('Landscape gallery music play failed', e));
            if (app.mediaManager) {
                app.mediaManager.currentMedia = audio;
                app.mediaManager.updatePlayBtnState(true);
                app.mediaManager.refreshMusicPageRefs(true);
            }
            return;
        }

        this._syncAudioToLandscapeVideo(audio);

        if (mode === 'music') {
            this.video.muted = true;
            if (this.video.paused) this.video.play().catch(e => console.log('Landscape video play failed', e));
            audio.muted = false;
            audio.play().catch(e => console.log('Landscape music play failed', e));
            if (app.mediaManager) {
                app.mediaManager.currentMedia = audio;
                app.mediaManager.updatePlayBtnState(true);
                app.mediaManager.refreshMusicPageRefs(true);
            }
            return;
        }

        if (!audio.paused && Math.abs((this.video.currentTime || 0) - (audio.currentTime || 0)) > 0.35) {
            try { this.video.currentTime = audio.currentTime || this.video.currentTime; } catch (e) { /* ignore */ }
        }
        audio.muted = true;
        audio.play().catch(e => console.log('Landscape muted music play failed', e));
        this.video.muted = false;
        if (app.mediaManager) {
            app.mediaManager.currentMedia = this.video;
            app.mediaManager.updatePlayBtnState(!this.video.paused);
            app.mediaManager.refreshMusicPageRefs(true);
        }
    }

    _syncLandscapeMusicPage() {
        if (!this.isActive || this.activePanel !== 'music' || !app.mediaManager) return;
        const { audio } = this._getActiveSlideAudio();
        const media = audio || app.mediaManager.currentMedia || this.video;
        if (!media) return;

        if (!this.isGallery && audio) {
            this._syncLandscapeVideoToAudio(audio);
        }

        const duration = media.duration || 0;
        const currentTime = media.currentTime || 0;
        const pct = duration ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
        app.mediaManager.refreshMusicPageRefs();
        if (app.mediaManager._syncMusicPageUI) {
            app.mediaManager._syncMusicPageUI(currentTime, pct);
        }
        this._syncLandscapeMiniPreview();
    }

    _syncLandscapeMiniPreview(force = false) {
        if (this.activePanel !== 'music') return;
        const mediaBox = document.getElementById('music-mini-media');
        if (!mediaBox) return;

        const now = performance.now();
        if (!force && now - this.lastLandscapeMiniSync < 180) return;
        this.lastLandscapeMiniSync = now;

        if (this.isGallery) {
            const src = this.galleryImages[this.galleryIndex] || '';
            if (!src) return;
            let img = mediaBox.querySelector('img');
            if (!img || mediaBox.querySelector('video')) {
                mediaBox.innerHTML = '<img alt="" loading="eager" decoding="async">';
                img = mediaBox.querySelector('img');
            }
            if (img && img.getAttribute('src') !== src) img.src = src;
            return;
        }

        if (!this.video) return;
        let miniVideo = mediaBox.querySelector('video[data-mini-sync="true"]');
        if (!miniVideo) {
            mediaBox.innerHTML = '<video class="music-mini-video" data-mini-sync="true" muted autoplay playsinline preload="metadata"></video>';
            miniVideo = mediaBox.querySelector('video[data-mini-sync="true"]');
            if (app.mediaManager) app.mediaManager.refreshMusicPageRefs(true);
        }

        const src = this.video.currentSrc || this.video.src || '';
        if (src && miniVideo.src !== src) miniVideo.src = src;
        const targetTime = this.landscapeBgmAudio ? (this.landscapeBgmAudio.currentTime || 0) : (this.video.currentTime || 0);
        if (Math.abs((miniVideo.currentTime || 0) - targetTime) > 0.25) {
            try { miniVideo.currentTime = Math.min(targetTime, miniVideo.duration || targetTime); } catch (e) { /* ignore */ }
        }
        miniVideo.playbackRate = this.video.playbackRate || 1;
        if (this.video.paused) {
            if (!miniVideo.paused) miniVideo.pause();
        } else if (miniVideo.paused) {
            const p = miniVideo.play();
            if (p) p.catch(() => { });
        }
    }

    _renderSharePanel() {
        const data = this.currentData || (app.fullPlaylist && app.fullPlaylist[app.mainSwiper?.activeIndex]);
        const assets = app.downloadMgr ? app.downloadMgr.prepareAssets(data) : [];
        const scroll = document.createElement('div');
        scroll.className = 'dl-grid-container';
        const grid = document.createElement('div');
        grid.className = 'dl-grid';
        grid.innerHTML = assets.map((asset, index) => {
            const url = asset.url || '';
            const thumb = asset.type === 'image'
                ? `<img src="${url}">`
                : `<div class="video-placeholder"></div><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:20px;"><i class="fa-solid fa-play"></i></div>`;
            return `<div class="dl-item selected lp-dl-item" data-index="${index}" data-clickable>${thumb}<div class="dl-checkbox active-all" data-index="${index}"></div></div>`;
        }).join('') || '<div style="color:#888; padding:16px;">未找到可下载资源</div>';
        scroll.appendChild(grid);
        this.sideBody.appendChild(scroll);

        grid.querySelectorAll('.lp-dl-item').forEach((item) => {
            item.onclick = (e) => {
                e.stopPropagation();
                item.classList.toggle('selected');
            };
        });

        this.sideFooter.className = 'lp-download-actions';
        this.sideFooter.style.display = 'grid';
        this.sideFooter.innerHTML = `
            <div class="lp-action-btn primary" id="lp-download-direct" data-clickable><i class="fa-solid fa-download"></i><span>直接下载</span></div>
            <div class="lp-action-btn" id="lp-download-zip" data-clickable><i class="fa-solid fa-file-zipper"></i><span>资源打包</span></div>
            <div class="lp-action-btn" id="lp-copy-links" data-clickable><i class="fa-solid fa-link"></i><span>复制链接</span></div>
            <div class="lp-action-btn" id="lp-share-work" data-clickable><i class="fa-solid fa-share-nodes"></i><span>分享作品</span></div>
        `;
        this.sideFooter.querySelector('#lp-download-direct').onclick = (e) => {
            e.stopPropagation();
            const selected = this._getSelectedAssetIndexes();
            if (!selected.length) return this._showToast('fa-circle-exclamation', '请先选择资源');
            app.downloadMgr.downloadDirect(selected);
        };
        this.sideFooter.querySelector('#lp-download-zip').onclick = (e) => {
            e.stopPropagation();
            const selected = this._getSelectedAssetIndexes();
            if (!selected.length) return this._showToast('fa-circle-exclamation', '请先选择资源');
            app.downloadMgr.downloadZip(selected);
        };
        this.sideFooter.querySelector('#lp-copy-links').onclick = (e) => {
            e.stopPropagation();
            const selected = this._getSelectedAssetIndexes();
            if (!selected.length) return this._showToast('fa-circle-exclamation', '请先选择资源');
            const text = app.downloadMgr.getLinks(selected);
            navigator.clipboard?.writeText(text).then(() => this._showToast('fa-link', '链接已复制')).catch(() => {
                app.interaction.copyText({ innerText: text });
            });
        };
        this.sideFooter.querySelector('#lp-share-work').onclick = (e) => {
            e.stopPropagation();
            if (app.menuManager) app.menuManager.shareCurrentWork();
        };
    }

    _escapeHtml(text) {
        return String(text || '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    _renderMusicPanel() {
        const data = this.currentData || (app.fullPlaylist && app.fullPlaylist[app.mainSwiper?.activeIndex]) || {};
        const music = data.music_info || {};
        const title = this._escapeHtml(music.title || data.music_title || '原声');
        const author = this._escapeHtml(music.author || data.music_author || '未知');
        const cover = this._escapeHtml(music.cover || data.music_cover || data.cover || data.images?.[0] || '');
        const hasMusic = !!(music.url || music.title || music.author);

        this.sideBody.innerHTML = `
            <div class="lp-music-panel">
                <div class="lp-music-cover">${cover ? `<img src="${cover}" alt="">` : '<i class="fa-solid fa-music"></i>'}</div>
                <div class="lp-music-meta">
                    <div class="lp-music-title">${title}</div>
                    <div class="lp-music-author">${author}</div>
                </div>
                <div class="lp-music-progress">
                    <span class="lp-music-current">00:00</span>
                    <div class="lp-music-track"><span></span></div>
                    <span class="lp-music-total">00:00</span>
                </div>
                <div class="lp-music-actions">
                    <button class="lp-music-btn" data-action="toggle" data-clickable><i class="fa-solid fa-pause"></i><span>播放</span></button>
                    <button class="lp-music-btn" data-action="fav" data-clickable><i class="fa-solid fa-heart"></i><span>收藏</span></button>
                    <button class="lp-music-btn" data-action="copy" data-clickable><i class="fa-solid fa-link"></i><span>链接</span></button>
                </div>
                ${hasMusic ? '' : '<div class="lp-music-empty">该作品暂无有效音乐信息</div>'}
            </div>
        `;

        this.sideBody.querySelector('[data-action="toggle"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (app.mediaManager) app.mediaManager.toggleCurrent();
            this._syncMusicPanel();
        });
        this.sideBody.querySelector('[data-action="fav"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!app.userDataManager || !hasMusic) return;
            const liked = await app.userDataManager.toggleMusic(music, data);
            this._showToast('fa-music', liked ? '已收藏音乐' : '已取消收藏');
        });
        this.sideBody.querySelector('[data-action="copy"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = music.url || music.play_url || music.playUrl || '';
            if (!url) return this._showToast('fa-circle-exclamation', '暂无音乐链接');
            navigator.clipboard?.writeText(url).then(() => this._showToast('fa-link', '链接已复制')).catch(() => {
                app.interaction?.copyText?.({ innerText: url });
            });
        });

        this._syncMusicPanel();
    }

    _syncMusicPanel() {
        if (this.activePanel !== 'music' || !this.sideBody) return;
        const media = app.mediaManager?.currentMedia;
        const fill = this.sideBody.querySelector('.lp-music-track span');
        const curr = this.sideBody.querySelector('.lp-music-current');
        const total = this.sideBody.querySelector('.lp-music-total');
        const toggleIcon = this.sideBody.querySelector('[data-action="toggle"] i');
        if (!media) return;
        const duration = media.duration || 0;
        const pct = duration ? Math.max(0, Math.min(100, (media.currentTime / duration) * 100)) : 0;
        if (fill) fill.style.width = `${pct}%`;
        if (curr) curr.innerText = app.mediaManager.formatTime(media.currentTime || 0);
        if (total) total.innerText = duration ? app.mediaManager.formatTime(duration) : '00:00';
        if (toggleIcon) toggleIcon.className = media.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }

    _getSelectedAssetIndexes() {
        return Array.from(this.sideBody.querySelectorAll('.lp-dl-item.selected'))
            .map((item) => Number(item.dataset.index))
            .filter((n) => Number.isInteger(n) && n >= 0);
    }

    // ================== 2. 核心控制 ==================
    enter(sourceVideo, data) {
        if (!sourceVideo && !this._hasGalleryImages(data)) return;
        this.init();

        this.sourceVideo = sourceVideo;
        this.currentData = data;
        this.isActive = true;
        this.isGallery = this._hasGalleryImages(data);
        this.galleryPaused = false;
        this._clearGalleryTimer();

        // 1. 同步媒体状态
        if (this.isGallery) {
            this.video.pause();
            this.video.style.display = 'none';
            this.image.style.display = 'block';
            this.galleryImages = (data.images || []).map((img) => this._getImageUrl(img)).filter(Boolean);
            this.galleryIndex = this._getSourceGalleryIndex() || 0;
            if (this.galleryProgress) this.galleryProgress.innerHTML = '';
            this._renderGalleryImage();
        } else {
            const currentSrc = sourceVideo.currentSrc || sourceVideo.src;
            if (this.video.src !== currentSrc) this.video.src = currentSrc;
            this.video.currentTime = sourceVideo.currentTime;
            this.video.volume = sourceVideo.volume;
            this.video.muted = false;
            this.video.playbackRate = sourceVideo.playbackRate;
            this.video.style.display = 'block';
            this.image.style.display = 'none';
            this.galleryImages = [];
            this.galleryIndex = 0;
            if (this.galleryProgress) {
                this.galleryProgress.style.display = 'none';
                this.galleryProgress.innerHTML = '';
            }
            this.progressBar.style.display = '';
        }

        // 2. 填充标题 (带展开逻辑)
        const titleBox = this.root.querySelector('.lp-title-box');
        const titleText = this.root.querySelector('#lp-title');

        // 重置样式
        titleBox.classList.remove('expanded');

        const fullTitle = data.title || '无标题';

        // 判断长度 (超过 25 字显示展开按钮)
        if (fullTitle.length > 25) {
            // 记录完整和简略标题
            titleBox.dataset.fullTitle = fullTitle;
            titleBox.dataset.shortTitle = fullTitle.substring(0, 25) + '...';
            // 初始显示简略版
            titleText.innerHTML = `${titleBox.dataset.shortTitle} <span class="lp-expand-btn">展开</span>`;
        } else {
            titleText.innerHTML = fullTitle;
            delete titleBox.dataset.fullTitle;
        }

        // 3. 填充作者信息
        document.getElementById('lp-author').innerText = data.author || '未知';

        // --- 核心修复：头像获取逻辑 ---
        let avatar = data.avatar;
        // 尝试从全局创作者数据中查找头像
        if (!avatar && window.app && app.dataLoader && app.dataLoader.globalCreators) {
            const creator = app.dataLoader.globalCreators[data.author];
            if (creator && creator.info) avatar = creator.info.avatar;
        }
        // 兜底：随机生成
        if (!avatar && window.getDiceBearAvatar) avatar = window.getDiceBearAvatar(data.author);

        const avatarEl = document.getElementById('lp-avatar');
        avatarEl.src = avatar || '';
        avatarEl.style.display = 'block';

        // 4. 刷新状态
        this._updateLikeUI();
        document.getElementById('lp-comment-count').innerText = app.renderer.formatNumber(data.comment);
        if (this.activePanel === 'share') {
            this.activePanel = null;
            this.openPanel('share');
        } else if (this.activePanel === 'music') {
            this._restoreMusicManageContent();
            this.sideBody.replaceChildren();
            this._mountMusicManagePanel();
        }

        // 5. 开始播放
        if (this.sourceVideo) this.sourceVideo.pause();
        this.root.style.display = 'flex';

        if (this.isGallery) {
            this._updatePlayBtnUI(true);
            this._setLandscapeAudioMode(this.activePanel === 'music' ? 'music' : 'default');
            this._scheduleGalleryAuto();
        } else {
            const p = this.video.play();
            if (p) {
                p.then(() => {
                    this._setLandscapeAudioMode(this.activePanel === 'music' ? 'music' : 'default');
                    this._updatePlayBtnUI(true);
                }).catch(e => {
                    this._setLandscapeAudioMode(this.activePanel === 'music' ? 'music' : 'default');
                    console.warn("LP Autoplay blocked", e);
                });
            } else {
                this._setLandscapeAudioMode(this.activePanel === 'music' ? 'music' : 'default');
            }
        }

        this._enterFullscreen();
        this.showUI();
        this._updateSettingsUI();
        this._startLoop();
    }

    exit() {
        if (!this.isActive) return;

        // 退出前同步进度回竖屏播放器
        if (this.isGallery) {
            this._syncSourceGallery();
        }
        if (this.sourceVideo) {
            this.sourceVideo.currentTime = this.video.currentTime;
            if (this.landscapeBgmAudio) {
                try { this.landscapeBgmAudio.currentTime = this.video.currentTime || this.landscapeBgmAudio.currentTime; } catch (e) { /* ignore */ }
                this.landscapeBgmAudio.muted = true;
            }
            this.sourceVideo.muted = app.mediaManager ? (app.mediaManager.isGlobalMuted || app.mediaManager._isMutedByLayer()) : false;
            if (!this.video.paused) {
                this.sourceVideo.play();
                if (app.mediaManager) {
                    app.mediaManager.currentMedia = this.sourceVideo;
                    app.mediaManager.updatePlayBtnState(true);
                }
            } else {
                if (app.mediaManager) app.mediaManager.updatePlayBtnState(false);
            }
        }

        this.isActive = false;
        this.closePanel();
        this._clearGalleryTimer();
        this.video.pause();
        this._exitFullscreen();
        this.root.style.display = 'none';
        this.root.style.transform = 'none';
        this.root.style.width = '100%';
        this.root.style.height = '100%';
        if (this.loopTimer) cancelAnimationFrame(this.loopTimer);
    }

    // ================== 3. 交互逻辑 (点赞/播放/切歌) ==================

    _hasGalleryImages(data) {
        return !!(data && Array.isArray(data.images) && data.images.length > 0);
    }

    _getImageUrl(img) {
        if (!img) return '';
        if (Array.isArray(img)) return img[0] || '';
        if (typeof img === 'object') return img.url || img.src || img.cover || '';
        return String(img);
    }

    _getSourceGalleryIndex() {
        try {
            const slide = app.mainSwiper?.slides?.[app.mainSwiper.activeIndex];
            const gallery = slide?.querySelector('.gallery-swiper')?.swiper;
            return gallery ? Math.max(0, gallery.realIndex || 0) : 0;
        } catch (e) {
            return 0;
        }
    }

    _renderGalleryImage() {
        if (!this.isGallery || !this.galleryImages.length) return;
        this.galleryIndex = Math.max(0, Math.min(this.galleryImages.length - 1, this.galleryIndex));
        this.image.src = this.galleryImages[this.galleryIndex];
        this.timeCurrent.innerText = `${this.galleryIndex + 1}/${this.galleryImages.length}`;
        this.timeTotal.innerText = '图集';
        const pct = this.galleryImages.length <= 1 ? 100 : (this.galleryIndex / (this.galleryImages.length - 1)) * 100;
        this.progressBar.value = pct;
        this.progressBar.style.setProperty('--lp-progress-pct', `${pct}%`);
        this._renderGalleryProgress();
        this._syncLandscapeMiniPreview(true);
    }

    _renderGalleryProgress() {
        if (!this.galleryProgress) return;
        if (!this.isGallery || !this.galleryImages.length) {
            this.galleryProgress.style.display = 'none';
            this.progressBar.style.display = '';
            return;
        }
        this.progressBar.style.display = 'none';
        this.galleryProgress.style.display = 'flex';
        if (this.galleryProgress.children.length !== this.galleryImages.length) {
            this.galleryProgress.innerHTML = this.galleryImages.map((_, index) => (
                `<div class="lp-gallery-segment" data-index="${index}" data-clickable><span class="lp-gallery-segment-fill"></span></div>`
            )).join('');
            this.galleryProgress.querySelectorAll('.lp-gallery-segment').forEach((seg) => {
                seg.onclick = (e) => {
                    e.stopPropagation();
                    const index = Number(seg.dataset.index);
                    if (!Number.isInteger(index)) return;
                    this.galleryIndex = Math.max(0, Math.min(this.galleryImages.length - 1, index));
                    this._renderGalleryImage();
                    this._syncSourceGallery();
                    this._markGalleryInteraction();
                };
            });
        }
        Array.from(this.galleryProgress.children).forEach((seg, index) => {
            seg.classList.toggle('done', index < this.galleryIndex);
            seg.classList.toggle('active', index === this.galleryIndex);
        });
    }

    switchGalleryImage(direction, manual = false) {
        if (!this.isGallery || !this.galleryImages.length) return;
        const delta = direction === 'next' ? 1 : -1;
        const nextIndex = this.galleryIndex + delta;
        if (nextIndex < 0) {
            this.galleryIndex = this.galleryImages.length - 1;
            this._renderGalleryImage();
            this._syncSourceGallery();
            this._scheduleGalleryAuto(manual ? 3000 : undefined);
            return;
        }
        if (nextIndex >= this.galleryImages.length) {
            this.galleryIndex = 0;
            this._renderGalleryImage();
            this._syncSourceGallery();
            this._scheduleGalleryAuto(manual ? 3000 : undefined);
            return;
        }
        this.galleryIndex = nextIndex;
        this._renderGalleryImage();
        this._syncSourceGallery();
        this._scheduleGalleryAuto(manual ? 3000 : undefined);
    }

    _syncSourceGallery() {
        try {
            const slide = app.mainSwiper?.slides?.[app.mainSwiper.activeIndex];
            const gallery = slide?.querySelector('.gallery-swiper')?.swiper;
            if (!gallery) return;
            if (gallery.params?.loop && gallery.slideToLoop) gallery.slideToLoop(this.galleryIndex, 0);
            else gallery.slideTo(this.galleryIndex, 0);
        } catch (e) {
            // ignore gallery sync failures
        }
    }

    _markGalleryInteraction() {
        if (!this.isGallery) return;
        this._clearGalleryTimer();
        this._scheduleGalleryAuto(3000);
    }

    _scheduleGalleryAuto(delayOverride) {
        this._clearGalleryTimer();
        if (!this.isActive || !this.isGallery || this.galleryPaused || !this.galleryImages.length) return;
        const isLast = this.galleryIndex >= this.galleryImages.length - 1;
        if (!isLast && Number(CONFIG.GALLERY_AUTOPLAY_DELAY) <= 0) return;
        const delay = isLast
            ? this._getGalleryMusicWait(typeof delayOverride === 'number' ? delayOverride : 3000)
            : (typeof delayOverride === 'number' ? delayOverride : Math.max(1200, Number(CONFIG.GALLERY_AUTOPLAY_DELAY) || 2500));
        this.galleryStepStartedAt = performance.now();
        this.galleryStepDuration = delay;
        this._updateGalleryProgressFill();
        this.galleryTimer = setTimeout(() => {
            if (!this.isActive || !this.isGallery || this.galleryPaused) return;
            if (this.galleryIndex >= this.galleryImages.length - 1) {
                this.switchVideo('next');
            } else {
                this.switchGalleryImage('next', false);
            }
        }, delay);
    }

    _getGalleryMusicWait(baseDelayMs = 3000) {
        const slide = app.mainSwiper?.slides?.[app.mainSwiper.activeIndex];
        const audio = slide ? slide.querySelector('.bgm-audio') : null;
        if (!audio || audio.paused) return baseDelayMs;
        const duration = audio.duration;
        if (!isFinite(duration) || isNaN(duration) || duration <= 0) return baseDelayMs;
        const remainingMs = Math.max(0, (duration - audio.currentTime) * 1000);
        return Math.max(baseDelayMs, remainingMs);
    }

    _clearGalleryTimer() {
        if (this.galleryTimer) {
            clearTimeout(this.galleryTimer);
            this.galleryTimer = null;
        }
        this.galleryStepStartedAt = 0;
        this.galleryStepDuration = 0;
        this._updateGalleryProgressFill();
    }

    _updateGalleryProgressFill() {
        if (!this.galleryProgress || !this.isGallery) return;
        let pct = 0;
        if (this.galleryStepStartedAt && this.galleryStepDuration > 0 && !this.galleryPaused) {
            pct = Math.max(0, Math.min(100, ((performance.now() - this.galleryStepStartedAt) / this.galleryStepDuration) * 100));
        }
        this.galleryProgress.style.setProperty('--lp-gallery-active-pct', `${pct}%`);
    }

    // 核心：横屏内部点赞
    async toggleLike() {
        if (!this.currentData) return;

        // 1. 调用全局点赞逻辑 (异步获取最新状态)
        const isLiked = await app.userDataManager.toggleLike(this.currentData);

        // 2. 更新数据模型
        if (isLiked) {
            this.currentData.like = (parseInt(this.currentData.like) || 0) + 1;
            this._showToast('fa-heart', '已喜欢', '#ff4d4f'); // 红色心提示
        } else {
            this.currentData.like = Math.max(0, (parseInt(this.currentData.like) || 0) - 1);
            this._showToast('fa-heart-crack', '取消喜欢');
        }

        // 3. 刷新横屏 UI
        this._updateLikeUI();

        // 4. 同步刷新竖屏页面 (找到当前 slide 刷新 DOM)
        // 这一步是为了退出横屏时，竖屏界面的状态也是对的
        if (app.mainSwiper) {
            const slide = app.mainSwiper.slides[app.mainSwiper.activeIndex];
            if (slide) {
                const heartBtn = slide.querySelector('.stats-item .fa-heart');
                const countText = slide.querySelector('.stats-item span');
                if (heartBtn) {
                    heartBtn.style.color = isLiked ? '#ff4d4f' : '#fff';
                }
                if (countText) countText.innerText = app.renderer.formatNumber(this.currentData.like);
            }
        }

        // 5. 刷新“我的”页面列表 (如果激活)
        app.pageManager.refreshMyPageListIfActive('likes');
    }

    _updateLikeUI() {
        if (!this.currentData) return;
        const isLiked = app.userDataManager.isLiked(this.currentData);
        const icon = document.getElementById('lp-like-icon');
        const count = document.getElementById('lp-like-count');

        if (icon) {
            icon.style.color = isLiked ? '#ff4d4f' : '#fff';
        }
        if (count) {
            count.innerText = app.renderer.formatNumber(this.currentData.like);
        }
    }

    togglePlay() {
        if (this.isGallery) {
            this.galleryPaused = !this.galleryPaused;
            if (this.galleryPaused) this._clearGalleryTimer();
            else this._scheduleGalleryAuto();
            this._updatePlayBtnUI(!this.galleryPaused);
            return;
        }
        if (this.video.paused) {
            this.video.play();
            if (this.landscapeBgmAudio) {
                this.landscapeBgmAudio.play().catch(e => console.log('Landscape music resume failed', e));
            }
            this._updatePlayBtnUI(true);
        } else {
            this.video.pause();
            if (this.landscapeBgmAudio) this.landscapeBgmAudio.pause();
            this._updatePlayBtnUI(false);
        }
    }

    _updatePlayBtnUI(isPlaying) {
        const centerIcon = this.playPauseBtnBig.querySelector('i');
        if (isPlaying) {
            centerIcon.className = 'fa-solid fa-pause';
            this.resetHideTimer(); // 播放时如果没有交互会自动隐藏
        } else {
            centerIcon.className = 'fa-solid fa-play';
            this.showUI(); // 暂停时保持 UI 显示
        }
    }

    // 自动连播/循环
    onVideoEnded() {
        if (this.isGallery) return;
        if (CONFIG.AUTO_NEXT_VIDEO) {
            this.switchVideo('next');
        } else {
            // 循环播放
            this.video.currentTime = 0;
            this.video.play();
            if (this.landscapeBgmAudio) {
                try { this.landscapeBgmAudio.currentTime = 0; } catch (e) { /* ignore */ }
                this.landscapeBgmAudio.play().catch(err => console.log('Landscape music loop failed', err));
            }
            this._updatePlayBtnUI(true); // 确保UI是播放状态
        }
    }

    switchVideo(direction) {
        if (!app.mainSwiper) return;
        const currentIndex = app.mainSwiper.activeIndex;
        let targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

        if (targetIndex < 0) return this._showToast('fa-circle-exclamation', '已经是第一个了');
        if (targetIndex >= app.mainSwiper.slides.length) {
            app.appendNextBatch();
            setTimeout(() => {
                if (targetIndex < app.mainSwiper.slides.length) this._doSwitch(targetIndex);
                else this._showToast('fa-circle-exclamation', '没有更多视频了');
            }, 200);
            return;
        }
        this._doSwitch(targetIndex);
    }

    _doSwitch(index) {
        this.showLoading(true);
        this.video.pause();
        this._clearGalleryTimer();

        // 标记正在切换，防止触发主页的播放逻辑
        app.landscapePlayer.isSwitching = true;
        app.mainSwiper.slideTo(index, 0);

        const newSlide = app.mainSwiper.slides[index];
        const newData = app.fullPlaylist[index];
        const newSourceVideo = newSlide ? newSlide.querySelector('video') : null;

        // 确保新视频有 src
        if (newSourceVideo && !newSourceVideo.src && newSourceVideo.dataset.src) {
            newSourceVideo.src = newSourceVideo.dataset.src;
        }

        setTimeout(() => {
            if (!newData || (newData.type !== '视频' && !this._hasGalleryImages(newData))) {
                this._showToast('fa-image', '当前作品不支持横屏');
                this.exit();
            } else {
                this.enter(newSourceVideo, newData);
                // 自动播放
                // this._showToast('fa-play', '已切换');
            }
            this.showLoading(false);
            app.landscapePlayer.isSwitching = false;
        }, 300);
    }

    _syncTimeUI() {
        if (!this.isActive || this.isSeeking) return;
        if (this.isGallery) {
            this._renderGalleryImage();
            return;
        }
        if (this.landscapeBgmAudio && !this.landscapeBgmAudio.muted) {
            this._syncLandscapeVideoToAudio(this.landscapeBgmAudio);
        }
        if (this.video.duration) {
            const cur = this.video.currentTime;
            const dur = this.video.duration;
            const pct = (cur / dur) * 100;
            this.progressBar.value = pct;
            this.progressBar.style.setProperty('--lp-progress-pct', `${pct}%`);
            this.timeCurrent.innerText = app.mediaManager.formatTime(cur);
            this.timeTotal.innerText = app.mediaManager.formatTime(dur);
        }
    }
    // 替换 LandscapePlayer 中的 toggleTitle 方法为下面这段
    toggleTitle(e) {
        if (e) e.stopPropagation();

        // 如果选中了文本（复制操作），不触发收起/展开
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;

        const titleBox = this.root.querySelector('.lp-title-box');
        const titleText = this.root.querySelector('#lp-title');

        if (!titleBox || !titleBox.dataset.fullTitle) return;

        const isExpanded = titleBox.classList.contains('expanded');

        if (isExpanded) {
            // === 收起 ===
            titleBox.classList.remove('expanded');

            // 恢复简略文本
            titleText.innerHTML = `${titleBox.dataset.shortTitle} <span class="lp-expand-btn">展开</span>`;

            // 恢复自动隐藏UI计时器
            this.resetHideTimer();

            // 清理事件监听（防止内存泄漏 / 保证手势恢复）
            titleText.ontouchstart = null;
            titleText.ontouchmove = null;
            titleText.onpointerdown = null;
            titleText.onpointermove = null;

            // 恢复样式（防万一）
            titleText.style.overflowY = '';
            titleText.style.whiteSpace = '';
            titleText.scrollTop = 0;

        } else {
            // === 展开 ===
            titleBox.classList.add('expanded');

            // 显示全文
            titleText.innerHTML = `${titleBox.dataset.fullTitle} <span class="lp-expand-btn">收起</span>`;

            // 展开时不自动隐藏UI
            if (this.uiTimer) clearTimeout(this.uiTimer);

            // 阻止事件向上冒泡，隔离播放器的全局手势（不 preventDefault）
            const stopProp = (evt) => evt.stopPropagation();

            // 绑定到实际可滚动的文本节点（#lp-title），不要只绑定到 titleBox
            titleText.ontouchstart = stopProp;
            titleText.ontouchmove = stopProp;
            titleText.onpointerdown = stopProp;
            titleText.onpointermove = stopProp;

            // 让内部可以原生滚动（必要的内联样式，辅以 CSS）
            titleText.style.overflowY = 'auto';
            titleText.style.whiteSpace = 'normal';
            // iOS 惯性滚动
            titleText.style.WebkitOverflowScrolling = 'touch';
        }
    }


    // ================== 4. 设置与辅助 ==================

    setSpeed(rate) {
        this.video.playbackRate = rate;
        this._showToast('fa-gauge-high', `倍速: ${rate}x`);
        setTimeout(() => this.toggleSettings(), 300);
    }
    setFit(mode) {
        this.video.style.objectFit = mode;
        this.image.style.objectFit = mode;
        this._showToast('fa-expand', `模式: ${mode === 'contain' ? '适应' : (mode === 'cover' ? '铺满' : '拉伸')}`);
        setTimeout(() => this.toggleSettings(), 300);
    }
    toggleSettings() {
        if (this.activePanel === 'settings') this.closePanel();
        else this.openPanel('settings');
    }
    _updateSettingsUI() {
        const rate = this.video.playbackRate;
        const fit = (this.isGallery ? this.image.style.objectFit : this.video.style.objectFit) || 'contain';
        this.settingsPanel.querySelectorAll('[data-val]').forEach(btn => {
            const val = btn.dataset.val;
            let match = false;
            if (!isNaN(parseFloat(val))) match = Math.abs(parseFloat(val) - rate) < 0.01;
            else match = val === fit;

            btn.style.background = match ? '#5cc9ff' : 'rgba(255,255,255,0.15)';
            btn.style.color = match ? '#000' : '#fff';
        });
    }
    showLoading(show) { this.loadingEl.style.display = show ? 'block' : 'none'; }

    // 使用内部 Toast 确保方向正确 (旋转后 HTML 元素也会旋转)
    _showToast(icon, text, color = '#fff') {
        this.toast.innerHTML = `<i class="fa-solid ${icon}" style="font-size:20px; color:${color}"></i><span style="font-size:14px;font-weight:bold">${text}</span>`;
        this.toast.style.opacity = '1';
        setTimeout(() => { this.toast.style.opacity = '0'; }, 2000);
    }

    // ================== 5. 全屏与布局 ==================

    _enterFullscreen() {
        const el = this.root;
        this.css(el, { position: 'fixed', zIndex: '99999', backgroundColor: '#000', top: '0', left: '0' });
        this._updateLayout();
        window.addEventListener('resize', this._onResize);
        setTimeout(() => this._updateLayout(), 300);
        window.webapp?.设置全屏模式?.(true);
    }
    _exitFullscreen() {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
        window.removeEventListener('resize', this._onResize);
        this.css(this.root, { width: '100%', height: '100%', top: '0', left: '0', transform: 'none', zIndex: '', position: '', backgroundColor: '' });
        window.webapp?.设置全屏模式?.(false);

    }
    _onResize() { if (this.isActive) this._updateLayout(); }
    _updateLayout() {
        const w = window.innerWidth; const h = window.innerHeight;
        if (w < h) {
            this.css(this.root, { width: h + 'px', height: w + 'px', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(90deg)', position: 'fixed', zIndex: '99999' });
        } else {
            this.css(this.root, { width: '100%', height: '100%', top: '0', left: '0', transform: 'none', position: 'fixed', zIndex: '99999' });
        }
    }

    // ================== 6. 手势与 UI 显隐 ==================

    showUI() {
        this.uiLayer.style.opacity = '1';
        if (this.uiTimer) clearTimeout(this.uiTimer);
    }
    resetHideTimer() {
        if (this.uiTimer) clearTimeout(this.uiTimer);

        // 检查标题是否展开
        const titleBox = this.root.querySelector('.lp-title-box');
        const isTitleExpanded = titleBox && titleBox.classList.contains('expanded');
        const mediaPaused = this.isGallery ? this.galleryPaused : this.video.paused;

        // 条件：侧栏打开 OR 视频暂停 OR 拖动进度条 OR 标题展开 -> 不隐藏
        if (this.activePanel || mediaPaused || this.isSeeking || isTitleExpanded) return;

        this.uiTimer = setTimeout(() => { this.uiLayer.style.opacity = '0'; }, 3000);
    }
    toggleUI() {
        if (this.uiLayer.style.opacity === '1') {
            this.uiLayer.style.opacity = '0';
            this.closePanel();
        } else {
            this.showUI();
            this.resetHideTimer();
        }
    }

    _bindGestures() {
        let startX, startY, initTime, initVol, initBright;
        let isDragging = false;
        let dragType = null;
        this.originalRate = 1.0;

        // 1. 触摸开始
        this.root.addEventListener('touchstart', (e) => {
            // === ★★★ 核心修复：如果是触摸在展开的标题框上，直接退出 ★★★ ===
            // 这样就不会触发长按倍速，也不会记录 startX，完全把控制权交给浏览器原生滚动
            if (e.target.closest('.lp-title-box.expanded')) {
                e.stopPropagation(); // 阻止冒泡，防止触发底层的点击隐藏UI逻辑
                return;
            }

            if (e.target.closest('.lp-side-panel') || e.target.closest('input') || e.target.closest('[onclick]') || e.target.closest('[data-clickable]')) return;
            if (e.target !== this.root && e.target !== this.uiLayer && e.target !== this.centerControls) return;

            const touch = e.touches[0];
            startX = touch.clientX; startY = touch.clientY;
            initTime = this.isGallery ? this.galleryIndex : this.video.currentTime;
            initVol = this.video.volume;
            initBright = this.brightness;
            isDragging = false; dragType = null;
            this.originalRate = this.video.playbackRate;
            if (this.isGallery) this._clearGalleryTimer();
        }, { passive: false });

        // 2. 触摸移动
        this.root.addEventListener('touchmove', (e) => {
            if (startX === undefined || startY === undefined) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            const isRotated = this.root.style.transform.includes('rotate(90deg)');
            const visualX = isRotated ? deltaY : deltaX;
            const visualY = isRotated ? -deltaX : deltaY;
            const visualStartX = isRotated ? startY : startX;
            const visualWidth = isRotated ? window.innerHeight : window.innerWidth;
            const visualHeight = isRotated ? window.innerWidth : window.innerHeight;
            const absX = Math.abs(visualX);
            const absY = Math.abs(visualY);

            if (!dragType) {
                if (absX < 18 && absY < 18) return;
                if (absX > absY * 1.25) {
                    dragType = 'seek';
                    this.isSeeking = true;
                } else if (absY > absX * 1.25) {
                    dragType = visualStartX > visualWidth / 2 ? 'volume' : 'brightness';
                } else {
                    return;
                }
            }

            if (dragType) {
                isDragging = true;
                e.preventDefault();
                this.showUI();

                if (dragType === 'seek') {
                    if (this.isGallery) {
                        const step = Math.round(visualX / Math.max(36, visualWidth / Math.max(3, this.galleryImages.length)));
                        let nextIndex = Math.max(0, Math.min(this.galleryImages.length - 1, initTime + step));
                        if (initTime >= this.galleryImages.length - 1 && step > 0) {
                            nextIndex = 0;
                        } else if (initTime <= 0 && step < 0) {
                            nextIndex = this.galleryImages.length - 1;
                        }
                        if (nextIndex !== this.galleryIndex) {
                            this.galleryIndex = nextIndex;
                            this._renderGalleryImage();
                            this._syncSourceGallery();
                        }
                        this._showToast('fa-images', `${this.galleryIndex + 1}/${this.galleryImages.length}`);
                    } else if (this.video.duration) {
                        const target = Math.max(0, Math.min(this.video.duration, initTime + (visualX / visualWidth) * 90));
                        this.video.currentTime = target;
                        this._syncTimeUI();
                        this._showToast(visualX > 0 ? 'fa-forward' : 'fa-backward', app.mediaManager.formatTime(target));
                    }
                } else {
                    const change = -visualY / (visualHeight * 0.75);
                    if (dragType === 'volume') {
                        let v = Math.max(0, Math.min(1, initVol + change));
                        this.video.volume = v;
                        this.video.muted = v === 0;
                        this._showToast(v === 0 ? 'fa-volume-off' : 'fa-volume-high', `音量 ${Math.round(v * 100)}%`);
                    } else {
                        let b = Math.max(0, Math.min(1, initBright + change));
                        this.brightness = b;
                        this.brightnessMask.style.opacity = (1 - b) * 0.8;
                        this._showToast('fa-sun', `亮度 ${Math.round(b * 100)}%`);
                    }
                }
            }
        }, { passive: false });

        // 3. 触摸结束 (保持不变)
        this.root.addEventListener('touchend', (e) => {
            if (!isDragging) {
                const isControl = e.target.closest('.lp-btn-icon, .lp-ctrl-btn, .lp-sidebar-item, .lp-follow-btn, input, .lp-title-box, [data-clickable]');
                const isPanel = this.sidePanel && this.sidePanel.contains(e.target);

                if (!isControl && !isPanel) {
                    if (this.activePanel) {
                        this.closePanel();
                    } else {
                        this.toggleUI();
                    }
                }
            }

            if (dragType === 'seek') this.isSeeking = false;
            if (this.isGallery) this._markGalleryInteraction();
            isDragging = false;
            dragType = null;
            startX = undefined;
            startY = undefined;
            this.toast.style.opacity = '0';
        });
    }

    // 显示提示
    _showToast(icon, text, color = '#fff') {
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toast.innerHTML = `<i class="fa-solid ${icon}" style="font-size:20px; color:${color}"></i><span style="font-size:14px;font-weight:bold;z-index:99999">${text}</span>`;
        this.toast.style.opacity = '1';
        this.toastTimer = setTimeout(() => {
            this.toast.style.opacity = '0';
            this.toastTimer = null;
        }, 900);
    }
    _startLoop() {
        const loop = () => {
            if (!this.isActive) return;
            this._syncMusicPanel();
            if (this.isGallery) this._updateGalleryProgressFill();
            this._syncLandscapeMusicPage();
            this.loopTimer = requestAnimationFrame(loop);
        };
        loop();
    }
    css(el, styles) { for (let k in styles) el.style[k] = styles[k]; }

    // 7. 外部接口
    toggle() {
        if (this.isActive) this.exit();
        else {
            if (!app.mainSwiper) return;
            const index = app.mainSwiper.activeIndex;
            const slide = app.mainSwiper.slides[index];
            if (!slide) return;
            const video = slide.querySelector('video');
            const data = app.fullPlaylist[index];
            if (video || this._hasGalleryImages(data)) this.enter(video, data);
            else app.interaction.showToast('当前作品不支持横屏');
        }
    }

    syncBtnState() { /* 保持原逻辑 */
        if (!app.mainSwiper) return;
        const index = app.mainSwiper.activeIndex;
        const data = app.fullPlaylist[index];
        const slide = app.mainSwiper.slides[index];
        const video = slide ? slide.querySelector('video') : null;
        const btn = slide ? slide.querySelector('.landscape-toggle-btn') : null;
        if (!btn) return;
        let w = data ? data.width : 0;
        let h = data ? data.height : 0;
        if ((!w || !h) && video) { w = video.videoWidth; h = video.videoHeight; }
        btn.style.display = (w && h && w > h) ? 'flex' : 'none';
    }
}

/* ---- app/features/interaction/14-interaction-manager.js ---- */
/* v3 semantic split: class from js/app/05-interaction-download-user.js | keep script order */
        class InteractionManager {
            constructor() {
                this.clickTimer = null;
                this.lastTapTime = 0;

                // 双指手势变量
                this.initialPinchDist = 0;
                this.isPinching = false;

                this.bindEvents();
                this.toastTimer = null;
            }
            bindEvents() {
                const videoList = document.getElementById('video-list');

                // 定义变量
                let touchTimer = null;
                let isLongPress = false;
                let startX = 0, startY = 0;
                let hasMoved = false;

                // 辅助：判断当前触点是否在横屏展开标题区域（任何在标题内部的触摸都应放行）
                const isInExpandedTitle = (target) => {
                    if (!target) return false;
                    return !!target.closest('.lp-title-box.expanded') || !!target.closest('#lp-title');
                };

                // 1. 触摸开始
                videoList.addEventListener('touchstart', (e) => {
                    const currentTime = Date.now();
                    // 如果触点在展开的标题上，放行（不做交互拦截）
                    if (isInExpandedTitle(e.target)) {
                        // 不 stopPropagation，这里也不记录 startX/startY，让原生滚动生效
                        // 但为了避免后续全局 touchstart 逻辑误判，直接返回
                        return;
                    }

                    if (e.touches.length > 1) {
                        if (touchTimer) {
                            clearTimeout(touchTimer);
                            touchTimer = null;
                        }
                        return;
                    }

                    // 忽略 UI 控件点击（保留原有的忽略项）
                    // 忽略 UI 控件
                    if (e.target.closest('.nav-icon, .top-tab, .custom-pagination-container, .swiper-pagination-bullet, .footer-icon, .expand-btn, .author-info, .stats-item, .modal-sheet, .token-modal, .overlay-mask, .music-pill, .landscape-toggle-btn, .clickable-text, .ctrl-btn, .desc-text-container, button, a, input, textarea, select, [onclick], [data-clickable]')) {
                        this.lastTapTime = currentTime;
                        return;
                    }
                    isLongPress = false;
                    hasMoved = false;

                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;

                    touchTimer = setTimeout(() => {
                        if (hasMoved || e.touches.length > 1) return;

                        isLongPress = true;
                        if (CONFIG.HAPTIC_FEEDBACK && navigator.vibrate) navigator.vibrate(50);
                        app.menuManager.open();
                    }, 500);
                }, { passive: true });

                // 2. 触摸移动
                videoList.addEventListener('touchmove', (e) => {
                    // 如果触点在展开标题上，放行——不要 preventDefault，不要把事件当作全局拖拽
                    if (isInExpandedTitle(e.target)) {
                        // 直接返回，不改变 hasMoved / touchTimer（这样可以让标题内部滚动）
                        return;
                    }

                    const moveX = Math.abs(e.touches[0].clientX - startX);
                    const moveY = Math.abs(e.touches[0].clientY - startY);

                    if (moveX > 5 || moveY > 5) {
                        hasMoved = true;
                        if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
                    }

                    // 保留 pinch/other 处理
                    this.handlePinchMove(e);

                    // 如果后续逻辑需要 preventDefault（例如横向拖动进度），它会在做出判断后调用，
                    // 但现在我们已经确保在标题内部不会触发这一段。
                }, { passive: false });

                // 3. 触摸结束
                videoList.addEventListener('touchend', (e) => {
                    const currentTime = new Date().getTime();
                    const tapLength = currentTime - this.lastTapTime;

                    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }

                    this.handlePinchEnd(e);

                    const endTouch = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                    const endX = endTouch ? endTouch.clientX : startX;
                    const endY = endTouch ? endTouch.clientY : startY;
                    const deltaX = endX - startX;
                    const deltaY = endY - startY;
                    const absX = Math.abs(deltaX);
                    const absY = Math.abs(deltaY);
                    const isHorizontalSwipe = absX > 60 && absX > absY * 1.2;
                    const sidebarEl = document.getElementById('sidebar-page');
                    const quickEl = document.getElementById('fav-quick-panel');

                    if (!isLongPress && isHorizontalSwipe) {
                        const isControl = e.target.closest('.nav-icon, .top-tab, .custom-pagination-container, .swiper-pagination-bullet, .footer-icon, .expand-btn, .author-info, .stats-item, .modal-sheet, .token-modal, .overlay-mask, .music-pill, .landscape-toggle-btn, .clickable-text, .ctrl-btn, .desc-text-container, button, a, input, textarea, select, [onclick], [data-clickable]');
                        const inGallery = e.target.closest('.gallery-swiper');
                        const hasActiveLayer = document.querySelector('.modal-sheet.active, .comment-layer.active, .page-layer.active');

                        if (sidebarEl && sidebarEl.classList.contains('active') && deltaX < 0) {
                            history.back();
                            this.lastTapTime = currentTime;
                            return;
                        }

                        if (quickEl && quickEl.classList.contains('active') && deltaX > 0) {
                            history.back();
                            this.lastTapTime = currentTime;
                            return;
                        }

                        if (!isControl && !inGallery && !hasActiveLayer) {
                            const feedMap = {
                                recommend: { left: 'double', right: 'single' },
                                double: { left: 'recommend', right: 'single' }
                            };
                            const feedMode = app.feedMode || 'single';
                            const direction = deltaX > 0 ? 'right' : 'left';
                            const targetFeed = feedMap[feedMode] ? feedMap[feedMode][direction] : null;
                            if (targetFeed && targetFeed !== feedMode && app.switchFeedMode) {
                                app.switchFeedMode(targetFeed);
                                this.lastTapTime = currentTime;
                                return;
                            }

                            if (deltaX > 0) {
                                if (app.safeOpenPage) {
                                    app.safeOpenPage(e, () => app.pageManager.openSidebar());
                                } else {
                                    app.pageManager.openSidebar();
                                }
                            } else {
                                if (app.safeOpenPage) {
                                    app.safeOpenPage(e, () => app.favManager.openQuickPanel());
                                } else {
                                    app.favManager.openQuickPanel();
                                }
                            }
                        }
                        this.lastTapTime = currentTime;
                        return;
                    }

                    if (isLongPress || hasMoved) return;

                    // 忽略 UI 控件
                    if (e.target.closest('.nav-icon, .top-tab, .custom-pagination-container, .swiper-pagination-bullet, .footer-icon, .expand-btn, .author-info, .stats-item, .modal-sheet, .token-modal, .overlay-mask, .music-pill, .landscape-toggle-btn, .clickable-text, .ctrl-btn, .desc-text-container, button, a, input, textarea, select, [onclick], [data-clickable]')) {
                        this.lastTapTime = currentTime;
                        return;
                    }

                    // 判定双击
                    if (tapLength < 300 && tapLength > 0) {
                        if (this.clickTimer) clearTimeout(this.clickTimer);
                        this.clickTimer = null;
                        this.handleDoubleTapLike(e);
                    } else {
                        // 单击（延迟判定，保证不是双击）
                        this.clickTimer = setTimeout(() => {
                            const activeSlide = app.mainSwiper.slides[app.mainSwiper.activeIndex];
                            if (CONFIG.CLICK_TO_TOGGLE && activeSlide) {
                                app.mediaManager.toggle(activeSlide);
                            } else if (activeSlide) {
                                const overlay = activeSlide.querySelector('.play-overlay');
                                if (overlay) {
                                    overlay.style.opacity = '0.3';
                                    setTimeout(() => overlay.style.opacity = '0', 200);
                                }
                            }
                            this.clickTimer = null;
                        }, 300);
                    }
                    this.lastTapTime = currentTime;
                });

                // 2. 双指缩放
                videoList.addEventListener('touchstart', (e) => this.handlePinchStart(e), { passive: false });
                videoList.addEventListener('touchmove', (e) => this.handlePinchMove(e), { passive: false });
                videoList.addEventListener('touchend', (e) => this.handlePinchEnd(e));

                // 3. 全选按钮
                const toggleSel = document.getElementById('btn-toggle-select');
                if (toggleSel) toggleSel.onclick = () => {
                    const all = document.querySelectorAll('.dl-item');
                    const isFull = document.getElementById('select-all-indicator').classList.contains('active-all');
                    all.forEach(i => isFull ? i.classList.remove('selected') : i.classList.add('selected'));
                    this.updateSelectAllState();
                };

                // 4. 全屏状态监听
                const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
                fsEvents.forEach(evt => document.addEventListener(evt, () => {
                    app.landscapePlayer.syncBtnState();
                    if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                }));

                // 绑定其他事件
                this.bindMusicPillEvents();

                // 5. 侧栏滑动关闭（在侧栏区域内）
                const bindSideSwipeClose = (el, closeOnRight) => {
                    if (!el) return;
                    let sx = 0, sy = 0;
                    el.addEventListener('touchstart', (ev) => {
                        if (!ev.touches || ev.touches.length !== 1) return;
                        sx = ev.touches[0].clientX;
                        sy = ev.touches[0].clientY;
                    }, { passive: true });
                    el.addEventListener('touchend', (ev) => {
                        if (!ev.changedTouches || ev.changedTouches.length !== 1) return;
                        const ex = ev.changedTouches[0].clientX;
                        const ey = ev.changedTouches[0].clientY;
                        const dx = ex - sx;
                        const dy = ey - sy;
                        const absX = Math.abs(dx);
                        const absY = Math.abs(dy);
                        if (absX > 60 && absX > absY * 1.2) {
                            if (closeOnRight ? dx > 0 : dx < 0) {
                                history.back();
                            }
                        }
                    }, { passive: true });
                };

                bindSideSwipeClose(document.getElementById('sidebar-page'), false);
                bindSideSwipeClose(document.getElementById('fav-quick-panel'), true);

                const dlZip = document.getElementById('btn-download-zip');
                if (dlZip) dlZip.onclick = () => app.executeDownload();

                const dlDirect = document.getElementById('btn-download-direct');
                if (dlDirect) dlDirect.onclick = () => app.executeDirectDownload();

                const cpLink = document.getElementById('btn-copy-links');
                if (cpLink) cpLink.onclick = () => app.executeCopyLinks();

                const commentInput = document.querySelector('.c-input');
                if (commentInput) {
                    commentInput.addEventListener('focus', () => {
                        const layer = document.getElementById('comment-layer');
                        const toggleBtn = layer ? layer.querySelector('.expand-toggle-btn') : null;
                        if (layer && !layer.classList.contains('layer-fullscreen')) {
                            layer.classList.add('layer-fullscreen');
                            if (toggleBtn) {
                                const icon = toggleBtn.querySelector('i');
                                if (icon) icon.className = 'fa-solid fa-down-left-and-up-right-to-center';
                            }
                        }
                    });
                }
            }

            // 2. 点击爱心按钮：切换状态 (点赞/取消)
            async toggleLikeBtn(btn) { // 【修改点1】添加 async
                if (event) event.stopPropagation();

                const idx = app.mainSwiper.activeIndex;
                const work = app.fullPlaylist[idx];
                const slide = app.mainSwiper.slides[idx];

                if (!work) return;

                // 【修改点2】添加 await，获取真正的 true/false 结果
                // true = 点赞成功, false = 取消点赞成功
                const isLiked = await app.userDataManager.toggleLike(work);

                // 更新内存数据 (防止 UI 显示错误)
                if (isLiked) {
                    work.like = (parseInt(work.like) || 0) + 1;
                } else {
                    work.like = Math.max(0, (parseInt(work.like) || 0) - 1);
                }

                // 强制更新当前 Slide 内所有的爱心图标
                const allHearts = slide.querySelectorAll('.fa-heart');
                allHearts.forEach(icon => {
                    if (isLiked) {
                        // 状态：已点赞 (红心)
                        icon.style.color = '#ff4d4f';
                        icon.classList.remove('fa-regular');
                        icon.classList.add('fa-solid', 'fa-bounce');
                        setTimeout(() => icon.classList.remove('fa-bounce'), 1000);
                    } else {
                        // 状态：取消点赞 (白心)
                        icon.style.color = '#fff';
                        icon.classList.remove('fa-bounce'); // 移除可能的动画
                    }
                });

                // 更新数字
                const countText = slide.querySelector('.stats-item span');
                if (countText) countText.innerText = app.renderer.formatNumber(work.like);

                this.showToast(isLiked ? '已添加到喜欢' : '取消喜欢');

                // 实时刷新“我的”页面数据
                app.pageManager.refreshMyPageListIfActive('likes');
            }
            /* --- 在 InteractionManager 类内部添加 --- */

            previewImage(url) {
                if (!url) return;

                // 1. 创建全屏遮罩
                const overlay = document.createElement('div');
                overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.95); z-index: 99999;
        display: flex; justify-content: center; align-items: center;
        opacity: 0; transition: opacity 0.3s;
    `;

                // 2. 创建图片元素
                const img = document.createElement('img');
                img.src = url;
                img.style.cssText = `
        max-width: 100%; max-height: 100%; object-fit: contain;
        transform: scale(0.9); transition: transform 0.3s;
    `;

                // 3. 点击关闭
                overlay.onclick = () => {
                    overlay.style.opacity = '0';
                    setTimeout(() => document.body.removeChild(overlay), 300);
                };

                overlay.appendChild(img);
                document.body.appendChild(overlay);

                // 4. 动画入场
                requestAnimationFrame(() => {
                    overlay.style.opacity = '1';
                    img.style.transform = 'scale(1)';
                });
            }
            // 1. 双击屏幕：仅点赞 (不取消)
            handleDoubleTapLike(e) {
                // 1. 播放爱心动画 (视觉反馈)
                let x, y;
                if (e.changedTouches && e.changedTouches.length > 0) {
                    x = e.changedTouches[0].clientX;
                    y = e.changedTouches[0].clientY;
                } else {
                    x = e.clientX;
                    y = e.clientY;
                }
                this.createHeartEffect(x, y);

                // 2. 获取当前作品
                const idx = app.mainSwiper.activeIndex;
                const work = app.fullPlaylist[idx];
                const mainSlide = app.mainSwiper.slides[idx];

                if (!work || !mainSlide) return;

                // 3. 检查是否已点赞
                const isAlreadyLiked = app.userDataManager.isLiked(work);

                // 4. 获取 UI 元素
                const heartBtn = mainSlide.querySelector('.stats-item .fa-heart');
                const countText = mainSlide.querySelector('.stats-item span');

                if (!isAlreadyLiked) {
                    // --- 未点赞 -> 执行点赞 ---
                    app.userDataManager.toggleLike(work);

                    // 更新内存数据
                    work.like = (parseInt(work.like) || 0) + 1;

                    // 更新 UI 样式
                    if (heartBtn) {
                        heartBtn.style.color = '#ff4d4f';
                        heartBtn.classList.remove('fa-regular');
                        heartBtn.classList.add('fa-solid', 'fa-bounce');
                        setTimeout(() => heartBtn.classList.remove('fa-bounce'), 1000);
                    }
                    if (countText) countText.innerText = app.renderer.formatNumber(work.like);

                    // 【新增】如果当前是在"我的-喜欢"列表播放，刷新列表
                    app.pageManager.refreshMyPageListIfActive('likes');

                } else {
                    // --- 已点赞 -> 仅播放按钮动画 (不重复计数，不取消点赞) ---
                    if (heartBtn) {
                        heartBtn.style.color = '#ff4d4f';
                        heartBtn.classList.remove('fa-bounce');
                        void heartBtn.offsetWidth; // 触发重绘
                        heartBtn.classList.add('fa-bounce');
                        setTimeout(() => heartBtn.classList.remove('fa-bounce'), 1000);
                    }
                    // 这里不调用 toggleLike，也不弹 Toast，纯视觉反馈
                }
            }

            createHeartEffect(x, y) {
                const heart = document.createElement('div');
                heart.className = 'like-heart-animation';
                heart.style.left = x + 'px';
                heart.style.top = y + 'px';
                heart.style.animation = 'like-fly 0.8s ease-out forwards';
                document.body.appendChild(heart);
                setTimeout(() => heart.remove(), 800);
            }

            // --- 双指手势处理 (视觉缩放+震动反馈版) ---

            handlePinchStart(e) {
                if (e.touches.length === 2) {
                    this.isPinching = true;
                    this.hasTriggeredPinch = false;

                    // 1. 锁死 Swiper，防止滑动
                    if (app.mainSwiper) {
                        app.mainSwiper.allowTouchMove = false;
                    }

                    // 2. 获取当前操作的媒体容器
                    const idx = app.mainSwiper.activeIndex;
                    const slide = app.mainSwiper.slides[idx];
                    this.targetContainer = slide ? slide.querySelector('.media-container') : null;

                    // 3. 移除过渡动画 (保证拖拽跟手，无延迟)
                    if (this.targetContainer) {
                        this.targetContainer.style.transition = 'none';
                    }

                    // 4. 计算初始距离
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    this.startPinchDist = Math.hypot(dx, dy);
                }
            }

            handlePinchMove(e) {
                if (this.isPinching && e.touches.length === 2) {
                    // 阻止浏览器默认缩放和滚动
                    if (e.cancelable) e.preventDefault();

                    // 计算当前距离
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const currentDist = Math.hypot(dx, dy);

                    // --- A. 视觉跟随效果 ---
                    // 计算缩放比例
                    let scale = currentDist / this.startPinchDist;

                    // 限制缩放范围 (0.5x ~ 1.5x)，防止过度变形
                    scale = Math.max(0.5, Math.min(1.5, scale));

                    // 应用到容器
                    if (this.targetContainer) {
                        this.targetContainer.style.transform = `scale(${scale})`;
                    }

                    // --- B. 触发逻辑判断 ---
                    if (this.hasTriggeredPinch) return; // 本次手势已触发过，仅执行视觉缩放，不再触发模式切换

                    const diff = currentDist - this.startPinchDist;
                    const isImmersive = document.body.classList.contains('immersive-mode');

                    // 阈值判定
                    // 1. 向内捏 (缩小) -> 隐藏界面
                    if (!isImmersive && (diff < -60 || scale < 0.7)) {
                        // 震动提示
                        if (navigator.vibrate) navigator.vibrate(50);

                        this.setImmersiveMode(true);
                        this.hasTriggeredPinch = true;
                    }
                    // 2. 向外捏 (放大) -> 显示界面
                    else if (isImmersive && (diff > 60 || scale > 1.3)) {
                        // 震动提示
                        if (navigator.vibrate) navigator.vibrate(50);

                        this.setImmersiveMode(false);
                        this.hasTriggeredPinch = true;
                    }
                }
            }

            handlePinchEnd(e) {
                if (this.isPinching && e.touches.length < 2) {
                    this.isPinching = false;
                    this.hasTriggeredPinch = false;

                    // --- A. 恢复视觉状态 (回弹) ---
                    if (this.targetContainer) {
                        // 添加过渡动画，让回弹平滑
                        this.targetContainer.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                        // 重置为原始大小
                        this.targetContainer.style.transform = 'scale(1)';

                        // 清理引用
                        setTimeout(() => {
                            // 动画结束后清理内联样式，避免影响后续操作
                            if (this.targetContainer) {
                                this.targetContainer.style.transition = '';
                                this.targetContainer.style.transform = '';
                            }
                            this.targetContainer = null;
                        }, 300);
                    }

                    // --- B. 结算 Swiper 锁定状态 ---
                    const isImmersive = document.body.classList.contains('immersive-mode');
                    if (app.mainSwiper) {
                        if (isImmersive) {
                            app.mainSwiper.allowTouchMove = false; // 沉浸模式保持锁定
                        } else {
                            app.mainSwiper.allowTouchMove = true;  // 普通模式恢复滑动
                        }
                    }
                }
            }

            // --- 核心：设置沉浸模式状态 (逻辑增强) ---
            setImmersiveMode(enable) {
                const isCurrentlyImmersive = document.body.classList.contains('immersive-mode');

                if (enable && !isCurrentlyImmersive) {
                    // 开启沉浸模式
                    document.body.classList.add('immersive-mode');
                    this.showToast('已隐藏界面 (双指外捏恢复)');


                } else if (!enable && isCurrentlyImmersive) {
                    // 关闭沉浸模式
                    document.body.classList.remove('immersive-mode');
                    this.showToast('已显示界面(双指内捏隐藏)');

                    // 3. 【核心优化】如果是手势正在进行中，暂不恢复 Swiper
                    // 避免手指还没离开屏幕，Swiper 就解锁导致画面滑动
                    if (!this.isPinching) {
                        if (app.mainSwiper) app.mainSwiper.allowTouchMove = true;
                    }
                }

                // 同步清屏按钮状态 (如果菜单开着)
                const clearBtn = document.getElementById('btn-clearmode-toggle');
                if (clearBtn) {
                    const span = clearBtn.querySelector('span');
                    if (enable) {
                        clearBtn.classList.add('active');
                        if (span) span.innerText = "退出清屏";
                    } else {
                        clearBtn.classList.remove('active');
                        if (span) span.innerText = "清屏模式";
                    }
                }
            }

            // --- 修复版：音乐胶囊事件绑定 ---
            bindMusicPillEvents() {
                // 使用 document 代理监听，确保动态生成的元素也能响应
                // 触摸事件 (移动端核心)
                document.addEventListener('touchstart', this.handlePillTouchStart.bind(this), { passive: false });
                document.addEventListener('touchmove', this.handlePillTouchMove.bind(this), { passive: false });
                document.addEventListener('touchend', this.handlePillTouchEnd.bind(this), { passive: false });

                // 鼠标事件 (PC调试用)
                document.addEventListener('mousedown', this.handlePillMouseDown.bind(this));
                document.addEventListener('mousemove', this.handlePillMouseMove.bind(this));
                document.addEventListener('mouseup', this.handlePillMouseUp.bind(this));
            }

            // 1. 触摸开始 (修改版：长按倍速显示在气泡中)
            handlePillTouchStart(e) {
                const pill = e.target.closest('.music-pill');
                if (!pill) return;

                this.activePill = pill;
                this.startX = e.touches[0].clientX;
                this.startY = e.touches[0].clientY;
                this.isPillDragging = false;
                this.isPillIntentChecked = false;
                this.isPillSpeedUp = false;

                // --- 任务7：长按 2 倍速逻辑 ---
                this.pillLongPressTimer = setTimeout(() => {
                    // 只有在未发生拖拽且当前还按住的情况下触发
                    if (!this.isPillDragging && this.activePill) {
                        const video = app.mediaManager.currentMedia;

                        // 仅对视频生效
                        if (video && video.tagName === 'VIDEO' && !video.paused) {
                            this.isPillSpeedUp = true;

                            // 1. 震动反馈
                            if (navigator.vibrate) navigator.vibrate(50);

                            // 2. 设置倍速
                            this.originalRate = video.playbackRate;
                            video.playbackRate = 2.0;

                            // 3. 【修改】在预览气泡中显示提示
                            const bubble = document.getElementById('scrub-preview-bubble');
                            const timeText = document.getElementById('scrub-time');

                            if (bubble && timeText) {
                                // 设置加粗斜体样式，增加动感
                                timeText.innerHTML = '<i class="fa-solid fa-forward" style="margin-right:5px;"></i><span style="font-weight:bold; font-style:italic;">2倍速播放中</span>';
                                bubble.classList.add('show');
                            }

                            // 4. 胶囊轻微放大反馈 (保持不变)
                            this.activePill.style.transition = 'transform 0.2s';
                            this.activePill.style.transform = 'scale(1.05)';
                        }
                    }
                }, 500); // 500ms 长按触发
            }

            // 3. 触摸结束 (修改版：隐藏气泡)
            handlePillTouchEnd(e) {
                if (!this.activePill) return;
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                // 清除定时器
                if (this.pillLongPressTimer) {
                    clearTimeout(this.pillLongPressTimer);
                    this.pillLongPressTimer = null;
                }

                // --- 场景 A: 长按倍速结束 ---
                if (this.isPillSpeedUp) {
                    const video = app.mediaManager.currentMedia;
                    if (video && video.tagName === 'VIDEO') {
                        // 恢复原倍速
                        video.playbackRate = this.originalRate || 1.0;
                    }

                    // 恢复 UI
                    if (this.activePill) {
                        this.activePill.style.transform = 'scale(1)';
                    }

                    // 【修改】隐藏预览气泡
                    const bubble = document.getElementById('scrub-preview-bubble');
                    if (bubble) bubble.classList.remove('show');

                    this.isPillSpeedUp = false;
                    this.activePill = null;
                    // 释放 seeking 锁
                    setTimeout(() => { if (app.mediaManager) app.mediaManager.isSeeking = false; }, 200);
                    return; // 阻止后续点击逻辑
                }

                // --- 场景 B: 正常点击或拖拽 ---
                if (this.isPillDragging) {
                    this.activePill.classList.remove('dragging');
                    document.getElementById('scrub-preview-bubble').classList.remove('show');
                } else {
                    // 点击行为 -> 打开音乐页
                    if (app.safeOpenPage) {
                        app.safeOpenPage(e, () => app.pageManager.openMusicManage());
                    } else {
                        app.pageManager.openMusicManage();
                    }
                }

                this.activePill = null;
                this.isPillDragging = false;
                setTimeout(() => {
                    if (app.mediaManager) app.mediaManager.isSeeking = false;
                }, 200);
                // 在方法结束前添加：
                if (this.seekRaf) {
                    cancelAnimationFrame(this.seekRaf);
                    this.seekRaf = null;
                }

                this.activePill = null;
                this.isPillDragging = false;
            }

            handlePillTouchMove(e) {
                if (!this.activePill) return;

                const x = e.touches[0].clientX;
                const y = e.touches[0].clientY;
                const deltaX = Math.abs(x - this.startX);
                const deltaY = Math.abs(y - this.startY);

                if (this.isPillDragging) {
                    e.preventDefault();
                    // 如果开始拖动，取消长按加速
                    if (this.pillLongPressTimer) clearTimeout(this.pillLongPressTimer);
                    const rect = this.activePill.getBoundingClientRect();
                    let pct = (x - rect.left) / rect.width;
                    pct = Math.max(0, Math.min(1, pct));

                    this.updatePillProgress(x, this.activePill);

                    // --- 修复 Task 1: 显示总时长 ---
                    const bubble = document.getElementById('scrub-preview-bubble');
                    const timeText = document.getElementById('scrub-time');
                    const media = app.mediaManager.currentMedia;

                    if (media && media.duration) {
                        const previewTime = pct * media.duration;
                        const currStr = app.mediaManager.formatTime(previewTime);
                        const totalStr = app.mediaManager.formatTime(media.duration);

                        // 格式化为: 00:45 / 03:20
                        timeText.innerText = `${currStr} / ${totalStr}`;

                        bubble.classList.add('show');
                    }
                    // -----------------------------

                    return;
                }

                if (!this.isPillIntentChecked) {
                    if (deltaX < 5 && deltaY < 5) return;
                    this.isPillIntentChecked = true;

                    if (deltaX > deltaY) {
                        this.isPillDragging = true;
                        this.activePill.classList.add('dragging');
                        if (app.mediaManager) app.mediaManager.isSeeking = true;
                        e.preventDefault();
                        this.updatePillProgress(x, this.activePill);
                    } else {
                        this.activePill = null;
                        if (app.mediaManager) app.mediaManager.isSeeking = false;
                    }
                }
            }





            handlePillMouseDown(e) {
                const pill = e.target.closest('.music-pill');
                if (!pill) return;
                this.activePillMouse = pill;
                this.isPillDraggingMouse = false;
                this.startMouseX = e.clientX;
            }

            handlePillMouseMove(e) {
                if (!this.activePillMouse) return;

                // 鼠标按下并移动即视为拖拽 (不需要像触摸那样判断垂直滚动)
                if (!this.isPillDraggingMouse) {
                    const deltaX = Math.abs(e.clientX - this.startMouseX);
                    if (deltaX > 5) {
                        this.isPillDraggingMouse = true;
                        this.activePillMouse.classList.add('dragging');
                        if (app.mediaManager) app.mediaManager.isSeeking = true;
                    }
                }

                if (this.isPillDraggingMouse) {
                    e.preventDefault();
                    this.updatePillProgress(e.clientX, this.activePillMouse);
                }
            }

            handlePillMouseUp(e) {
                if (!this.activePillMouse) return;
                e.stopPropagation();

                if (!this.isPillDraggingMouse) {
                    app.pageManager.openMusicManage();
                } else {
                    this.activePillMouse.classList.remove('dragging');
                }

                this.activePillMouse = null;
                this.isPillDraggingMouse = false;
                if (app.mediaManager) app.mediaManager.isSeeking = false;
            }

            // --- 通用：计算并更新进度 (跟手优化版) ---
            updatePillProgress(clientX, pill) {
                const rect = pill.getBoundingClientRect();
                let pct = (clientX - rect.left) / rect.width;

                // 限制在 0 - 1 之间
                pct = Math.max(0, Math.min(1, pct));

                // 【核心修复 2】: 视觉更新 (立即执行)
                // 直接操作 DOM 样式，没有任何延迟，保证“跟手”
                const fill = pill.querySelector('.progress-fill');
                if (fill) fill.style.width = `${pct * 100}%`;

                // 【核心修复 3】: 视频跳转 (节流执行)
                // 视频 seek 操作很重，如果在 touchmove 中每一帧都做，会导致 UI 掉帧
                // 使用 requestAnimationFrame 确保在一帧内只执行一次 seek
                if (!this.seekRaf) {
                    this.seekRaf = requestAnimationFrame(() => {
                        if (app.mediaManager) {
                            app.mediaManager.seek(pct);
                        }
                        this.seekRaf = null; // 释放锁
                    });
                }
            }

            handleMouseDown(e) { const pill = e.target.closest('.music-pill'); if (!pill) return; e.stopPropagation(); this.startX = e.clientX; this.startY = e.clientY; this.isDragging = false; this.longPressTimer = setTimeout(() => { this.isDragging = true; this.startDrag(pill); }, 300); }
            handleMouseMove(e) { if (!this.longPressTimer) return; const pill = e.target.closest('.music-pill'); if (!pill) return; const deltaX = Math.abs(e.clientX - this.startX); const deltaY = Math.abs(e.clientY - this.startY); if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) { clearTimeout(this.longPressTimer); this.longPressTimer = null; this.isDragging = true; this.startDrag(pill); this.handleDragProgress(e, pill); } }
            handleMouseUp(e) { const pill = e.target.closest('.music-pill'); if (!pill) return; if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; } this.isDragging = false; this.endDrag(pill); }
            handleTouchStart(e) { const pill = e.target.closest('.music-pill'); if (!pill) return; const touch = e.touches[0]; this.startX = touch.clientX; this.startY = touch.clientY; this.isDragging = false; this.longPressTimer = setTimeout(() => { this.isDragging = true; this.startDrag(pill); app.pageManager.openMusicManage(); if (navigator.vibrate) navigator.vibrate(50); }, 800); }
            handleTouchMove(e) { if (!this.longPressTimer && !this.isDragging) return; const pill = e.target.closest('.music-pill'); if (!pill) return; const touch = e.touches[0]; const deltaX = Math.abs(touch.clientX - this.startX); const deltaY = Math.abs(touch.clientY - this.startY); if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) { if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; } this.isDragging = true; e.preventDefault(); this.handleDragProgress(e, pill); } }
            handleTouchEnd(e) { const pill = e.target.closest('.music-pill'); if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; if (pill && !this.isDragging) { app.pageManager.openMusicManage(); } } this.isDragging = false; if (pill) this.endDrag(pill); }
            handleClick(e) { const pill = e.target.closest('.music-pill'); if (!pill) return; if (!this.isDragging) { e.stopPropagation(); app.pageManager.openMusicManage(); } }
            startDrag(pill) { pill.style.cursor = 'grabbing'; pill.classList.add('dragging'); }
            endDrag(pill) { pill.style.cursor = ''; pill.classList.remove('dragging'); }
            handleDragProgress(e, pill) { const rect = pill.getBoundingClientRect(); let clientX; if (e.type.includes('touch')) { clientX = e.touches[0].clientX; } else { clientX = e.clientX; } let pct = (clientX - rect.left) / rect.width; pct = Math.max(0, Math.min(1, pct)); const progressFill = pill.querySelector('.progress-fill'); if (progressFill) { progressFill.style.width = `${pct * 100}%`; } if (app.mediaManager) { app.mediaManager.seek(pct); } }
            /* 在 InteractionManager 类中 */
            toggleDesc(el, event) {
                if (event) event.stopPropagation();

                // 1. 获取元素
                const textEl = el.classList.contains('desc-text') ? el : el.closest('.desc-text');
                if (!textEl) return;

                const container = textEl.closest('.desc-text-container');
                const fullText = textEl.dataset.fullText;
                const isExpanded = textEl.classList.contains('expanded');

                // 2. 获取存储的时间文本
                const timeText = textEl.dataset.time || '';
                const timeHtml = timeText
                    ? `<span class="release-time-tag"><i class="fa-regular fa-clock"></i>${timeText}</span>`
                    : '';

                // === 新增：获取当前 slide 内的横屏按钮 ===
                const slide = textEl.closest('.swiper-slide');
                const landscapeBtn = slide ? slide.querySelector('.landscape-toggle-btn') : null;

                if (!isExpanded) {
                    // ====== 展开逻辑 ======
                    textEl.classList.add('expanded');
                    if (container) container.classList.add('scroll-mode', 'swiper-no-swiping');

                    // 全文 + 时间 + 收起按钮
                    textEl.innerHTML = `${fullText}${timeHtml}<span class="expand-btn">收起</span>`;

                    // 【新增】隐藏横屏按钮
                    if (landscapeBtn) {
                        landscapeBtn.style.opacity = '0';
                        landscapeBtn.style.pointerEvents = 'none'; // 防止误触
                    }

                } else {
                    // ====== 收起逻辑 ======
                    textEl.classList.remove('expanded');
                    if (container) {
                        container.classList.remove('scroll-mode', 'swiper-no-swiping');
                        container.scrollTop = 0;
                    }

                    // 截断文本 + ... + 时间 + 展开按钮
                    textEl.innerHTML = `${fullText.substring(0, 35)}...${timeHtml}<span class="expand-btn">展开</span>`;

                    // 【新增】恢复横屏按钮显示
                    if (landscapeBtn) {
                        landscapeBtn.style.opacity = '1';
                        landscapeBtn.style.pointerEvents = 'auto';
                    }
                }

                // 同步按钮位置 (保持原有逻辑，防止位置错乱)
                if (app.landscapePlayer) {
                    app.landscapePlayer.syncBtnState();
                }
            }
            toggleDlItem(el) { el.classList.toggle('selected'); this.updateSelectAllState(); }
            updateSelectAllState() { const t = document.querySelectorAll('.dl-item').length; const s = document.querySelectorAll('.dl-item.selected').length; const ind = document.getElementById('select-all-indicator'); if (t > 0 && t === s) ind.classList.add('active-all'), ind.style.background = 'var(--theme-color)', ind.style.borderColor = 'var(--theme-color)'; else ind.classList.remove('active-all'), ind.style.background = 'transparent', ind.style.borderColor = '#999'; }
            copyText(element) { const text = element.innerText; if (!text || text === '未知') return; navigator.clipboard.writeText(text).then(() => { element.style.color = '#5cc9ff'; setTimeout(() => element.style.color = '', 300); this.showToast(`已复制：${text}`); }).catch(err => { this.showToast("复制失败，请手动复制"); }); }
            // --- 在 InteractionManager 类内部新增/替换以下方法 ---

            // 1. 升级版 showToast (支持 HTML + 自定义时长)
            showToast(msg, duration = 2000, allowHtml = false) {
                // 动态注入样式修复 pointer-events (仅执行一次)
                if (!document.getElementById('toast-style-fix')) {
                    const style = document.createElement('style');
                    style.id = 'toast-style-fix';
                    style.innerHTML = `
                        .toast-msg { 
                            pointer-events: none !important; /* 默认不拦截点击 */
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            gap: 8px;
                            z-index: 99999 !important; /* 强制置顶 */
                        }
                        .toast-action-text {
                            color: var(--theme-color);
                            font-weight: bold;
                            cursor: pointer;
                            padding: 2px 5px;
                        }
                    `;
                    document.head.appendChild(style);
                }

                let toast = document.getElementById('global-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'global-toast';
                    toast.className = 'toast-msg';
                    document.body.appendChild(toast);
                }

                // v4: plain text by default; trusted internal snippets can opt in with allowHtml=true.
                if (allowHtml) toast.innerHTML = msg;
                else toast.textContent = String(msg ?? '');
                toast.classList.add('show');

                if (this.toastTimer) clearTimeout(this.toastTimer);

                this.toastTimer = setTimeout(() => {
                    toast.classList.remove('show');
                }, duration);
            }

            // 2. 新增：次数不足专用提示
            showQuotaAlert() {
                const html = `
        <span>下载次数不足</span> 
        <span class="toast-action-text" onclick="app.interaction.goToGetQuota()">
            去获取
        </span>
    `;
                // 显示 5 秒
                this.showToast(html, 5000, true);
            }

            // 3. 新增：跳转逻辑
            goToGetQuota() {
                // 立即关闭 Toast
                const toast = document.getElementById('global-toast');
                if (toast) toast.classList.remove('show');

                // 关闭可能存在的下载弹窗
                app.pageManager.closeAll();

                // 1. 打开设置页
                app.pageManager.openSettings();

                // 2. 稍微延迟后弹出口令框 (给页面切换一点过渡时间)
                setTimeout(() => {
                    app.quotaManager.openTokenModal();
                }, 300);
            }

        }

        /* --- 修复版 DownloadManager (适配 Api 模块) --- */

/* ---- app/features/download/15-download-manager.js ---- */
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

/* ---- app/features/user/16-user-data-manager.js ---- */
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

/* ---- app/features/user/17-fav-manager.js ---- */
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

/* ---- app/features/account/18-account-manager.js ---- */
/* v3 semantic split: class from js/app/06-account-resource-data-chat.js | keep script order */
        class AccountManager {
            constructor() {
                this.user = JSON.parse(localStorage.getItem('dxx_account_user') || 'null');
                setTimeout(() => this.updateAllUI(), 100);
            }

            // --- UI: 打开/关闭弹窗 ---
            openModal() {
                // 确保 ID 正确：login-modal
                const modal = document.getElementById('login-modal');
                const mask = document.getElementById('auth-mask');

                if (mask) mask.classList.add('active');
                if (modal) {
                    modal.style.display = 'block';
                    requestAnimationFrame(() => modal.classList.add('active'));
                } else {
                    console.error("找不到 ID 为 login-modal 的元素，请检查 HTML");
                }

                this.switchView('login');
            }

            closeModal() {
                const modal = document.getElementById('login-modal');
                const mask = document.getElementById('auth-mask');

                if (modal) modal.classList.remove('active');
                if (mask) mask.classList.remove('active');

                setTimeout(() => {
                    if (modal) modal.style.display = 'none';
                }, 300);
            }

            // --- UI: 切换登录/注册视图 ---
            switchView(view) {
                const title = document.getElementById('login-title');
                const loginForm = document.getElementById('login-form-view');
                const regForm = document.getElementById('register-form-view');
                const switchText = document.getElementById('auth-switch-text');

                if (view === 'login') {
                    if (title) title.innerText = '账号登录';
                    if (loginForm) loginForm.style.display = 'block';
                    if (regForm) regForm.style.display = 'none';
                    if (switchText) {
                        switchText.innerHTML = '没有账号？ <span onclick="app.accountManager.switchView(\'register\')" style="cursor:pointer; color:var(--theme-color);">立即注册</span>';
                    }
                } else {
                    if (title) title.innerText = '注册新账号';
                    if (loginForm) loginForm.style.display = 'none';
                    if (regForm) regForm.style.display = 'block';
                    if (switchText) {
                        switchText.innerHTML = '已有账号？ <span onclick="app.accountManager.switchView(\'login\')" style="cursor:pointer; color:var(--theme-color);">去登录</span>';
                    }
                }
            }

            // 核心: 统一请求处理 (重构)
            async _submitAuth(username, password) {
                app.interaction.showToast('正在连接服务器...');

                // 使用 Api.Auth
                const res = await Api.Auth.loginOrRegister(
                    username,
                    password,
                    window.device_id || 'browser_web',
                    this.isWebIDE // 假设类中有此属性，或者直接传 false
                );

                if (res.code === 200) {
                    this.user = res.data;
                    this.saveLocal();
                    this.closeModal();
                    this.updateAllUI();

                    if (app.chat) app.chat.checkLogin();
                    if (app.circleManager) app.circleManager.loadFeed(true);

                    app.interaction.showToast(res.msg || '欢迎回来');
                } else {
                    app.interaction.showToast(res.msg || '操作失败');
                }
            }

            // --- 业务逻辑 ---
            showAuthModal() {
                const modal = document.getElementById('auth-modal');
                const mask = document.getElementById('auth-mask');
                if (modal) modal.classList.add('active');
                if (mask) mask.classList.add('active');
            }

            bindAccount() {
                this.showAuthModal();
            }

            async doLogin() {
                const uInput = document.getElementById('auth-user');
                const pInput = document.getElementById('auth-pass');
                const u = uInput ? uInput.value.trim() : '';
                const p = pInput ? pInput.value.trim() : '';
                if (!u || !p) return app.interaction.showToast('请输入账号密码');

                await this._submitAuth(u, p);
            }

            async doRegister() {
                const uInput = document.getElementById('reg-username');
                const p1Input = document.getElementById('reg-pwd');
                const p2Input = document.getElementById('reg-pwd2');

                const username = uInput ? uInput.value.trim() : '';
                const pwd = p1Input ? p1Input.value.trim() : '';
                const pwd2 = p2Input ? p2Input.value.trim() : '';

                if (!username || !pwd) return app.interaction.showToast('请填写完整信息');
                if (pwd.length < 6) return app.interaction.showToast('密码至少需要6位');
                if (pwd !== pwd2) return app.interaction.showToast('两次密码不一致');

                await this._submitAuth(username, pwd);
            }

            logout() {
                if (!confirm('确定要退出当前账号吗？')) return;
                this.user = null;
                localStorage.removeItem('dxx_account_user');
                this.updateAllUI();
                app.interaction.showToast('已安全退出');
                setTimeout(() => window.location.reload(), 500);
            }

            // --- AccountManager 类内部 ---

            updateAllUI() {
                const isLogin = !!this.user;

                // 1. 统一准备数据 (这是关键：所有地方都使用这组变量)
                let displayName = '未登录';
                // 默认头像 (游客)
                let displayAvatar = getDiceBearAvatar('Guest');
                let displayIdText = '点击头像登录';
                let displayCoins = '0';
                let displayIdNumber = '';

                if (isLogin) {
                    displayName = this.user.username || '用户';

                    // 核心：优先使用用户设置的头像，没有则生成随机头像
                    if (this.user.avatar && this.user.avatar !== 'null' && this.user.avatar.trim() !== '') {
                        displayAvatar = this.user.avatar;
                    } else {
                        displayAvatar = getDiceBearAvatar(this.user.username);
                    }

                    const dbId = this.user.id;
                    displayIdText = `ID: ${dbId}`;
                    displayIdNumber = `ID: ${dbId}`;
                    displayCoins = this.user.coins !== undefined ? this.user.coins : 0;
                }

                // 2. 更新【我的页面】(My Page)
                const myNameEl = document.getElementById('my-view-name');
                const myIdEl = document.getElementById('my-view-id');
                const myAvatarEl = document.getElementById('my-view-avatar');

                if (myNameEl) myNameEl.innerText = displayName;
                if (myIdEl) myIdEl.innerText = displayIdText;
                if (myAvatarEl) {
                    myAvatarEl.src = displayAvatar;
                    // 强制刷新缓存 (可选，防止图片不更新)
                    // myAvatarEl.src = displayAvatar + (displayAvatar.includes('?') ? '&' : '?') + 't=' + Date.now();
                }

                // 3. 更新【圈子页面】顶部卡片 (Circle Page)
                const circleName = document.getElementById('circle-user-name');
                const circleAvatar = document.getElementById('circle-user-avatar');
                const circleCoins = document.getElementById('circle-user-coins');
                const circleHid = document.getElementById('circle-user-hid');

                if (circleName) circleName.innerText = displayName;
                if (circleAvatar) circleAvatar.src = displayAvatar;
                if (circleCoins) circleCoins.innerText = displayCoins;
                if (circleHid) circleHid.innerText = displayIdNumber;

                // 4. 更新【资源管理/编辑页】预览图 (如果有)
                const previewImg = document.getElementById('rm-avatar-preview');
                if (previewImg && isLogin) previewImg.src = displayAvatar;

                // 5. 更新侧边栏/备份页状态
                const settingsStatus = document.getElementById('account-device-status') || document.getElementById('account-email-status');
                if (settingsStatus) {
                    settingsStatus.innerText = isLogin ? displayName : '未登录';
                    settingsStatus.style.color = isLogin ? '#52c41a' : '#666';
                }

                const cloudStatus = document.getElementById('backup-cloud-status');
                const loginBtn = document.getElementById('backup-login-btn');
                const logoutBtn = document.getElementById('backup-logout-btn');

                if (cloudStatus) {
                    cloudStatus.innerText = isLogin ? `已连接: ${displayName}` : '未登录 (离线)';
                    cloudStatus.style.color = isLogin ? '#52c41a' : '#888';
                }
                if (loginBtn) loginBtn.style.display = isLogin ? 'none' : 'block';
                if (logoutBtn) logoutBtn.style.display = isLogin ? 'block' : 'none';

                // 6. 通知聊天室系统更新状态
                if (app.chat) app.chat.checkLogin();
            }

            saveLocal() {
                localStorage.setItem('dxx_account_user', JSON.stringify(this.user));
                this.updateAllUI(); // 保存时立即刷新UI
            }


            // ==========================================
            // ★★★ 修复点：补全了以下缺失的方法 ★★★
            // ==========================================

            // 1. 设备账号 (设置页点击)
            openDeviceAccount() {
                if (this.user) {
                    app.interaction.showToast(`当前登录账号: ${this.user.username}`);
                } else {
                    this.openModal();
                }
            }

            openBindEmail() {
                this.openDeviceAccount();
            }

            // 2. 修改密码 (设置页点击)
            openChangePassword() {
                if (!this.user) return this.openModal();
                // 简单提示，实际开发需要对接修改密码API
                app.interaction.showToast('请联系管理员或使用找回密码功能');
            }

            // 3. 账号安全 (设置页点击)
            openSecuritySettings() {
                if (!this.user) return this.openModal();
                // 跳转到备份页面作为安全设置的一部分
                app.backupManager.openBackupPage();
            }
        }

        // --- 资源管理页控制器 (修复版：适配 DB) ---

/* ---- app/data/19-resource-manager.js ---- */
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

/* ---- app/data/20-data-system.js ---- */
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

/* ---- app/features/chat/21-chat-system.js ---- */
/* v7: ChatSystem fixes - emoji, demo message, stable active user, safer rendering */
        class ChatSystem {
            constructor() {
                this.API_URL = Api.config.BASE_URL + '/chat_api.php';
                this.currentUser = null;
                this.lastMsgId = 0;
                this.pollingTimer = null;
                this.isPolling = false;
                this.isWebIDE = false;
                this.demoRendered = false;
                this.emojiList = [
                    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😍','😘','😋','😜','🤪','🤗','🤔','🤭','🤫','😎','🥳',
                    '😭','🥺','😤','😡','😱','😴','🤮','🤧','😷','🤕','🤯','😵‍💫','👍','👎','👌','✌️','🤞','🤟','🤘','👏','🙌','🙏','💪','👀',
                    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💞','💯','🔥','✨','⭐','🌟','🎉','🎁','🌈','🍉','🍻','☕','🚀','🐱'
                ];
                this.quoteMsg = null;
                this.settings = JSON.parse(localStorage.getItem('chat_settings') || '{"notify":true}');
                this.initEvents();
                this.initEmojiPicker();
            }

            getActiveUser() {
                const user = app?.accountManager?.user || this.currentUser || null;
                if (user) this.currentUser = user;
                return user;
            }

            initEvents() {
                const input = document.getElementById('chat-input');
                if (input) {
                    input.onkeydown = (e) => this.handleKeyDown(e);
                    input.oninput = (e) => this.handleInput(e);
                }

                document.addEventListener('contextmenu', (e) => {
                    if (e.target.classList.contains('chat-avatar')) {
                        e.preventDefault();
                        const uid = e.target.dataset.uid;
                        const uname = e.target.dataset.name;
                        this.showAvatarContextMenu(e.clientX, e.clientY, uid, uname);
                    }
                });

                document.addEventListener('contextmenu', (e) => {
                    const bubble = e.target.closest('.chat-bubble');
                    if (bubble) {
                        e.preventDefault();
                        const msgItem = e.target.closest('.chat-msg-item');
                        if (!msgItem || msgItem.dataset.demo === '1') return;
                        const msgId = msgItem.dataset.msgId;
                        const msgContent = msgItem.querySelector('.chat-bubble')?.innerText || '';
                        const msgUserId = msgItem.dataset.userId;
                        this.showMsgContextMenu(e.clientX, e.clientY, msgId, msgContent, msgUserId);
                    }
                });

                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.context-menu') && !e.target.closest('.emoji-picker') && !e.target.closest('#emoji-btn')) {
                        ['admin-menu', 'self-menu', 'msg-menu'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.style.display = 'none';
                        });
                        this.hideEmojiPicker();
                    }
                });
            }

            initEmojiPicker() {
                const emojiGrid = document.getElementById('emoji-grid');
                if (!emojiGrid) return;
                emojiGrid.innerHTML = '';
                this.emojiList.forEach(emoji => {
                    const emojiItem = document.createElement('div');
                    emojiItem.className = 'emoji-item';
                    emojiItem.textContent = emoji;
                    emojiItem.onclick = () => this.insertEmoji(emoji);
                    emojiGrid.appendChild(emojiItem);
                });
            }

            handleKeyDown(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendText();
                }
            }

            handleInput(e) {
                const val = e.target.value;
                if (val.endsWith('@')) {
                    // 预留 @ 好友触发位
                }
            }

            async checkLogin() {
                const active = app?.accountManager?.user;
                if (active) {
                    this.currentUser = active;
                    this.startPolling();
                    return;
                }
                const localUser = JSON.parse(localStorage.getItem('chat_user') || 'null');
                if (localUser) {
                    this.currentUser = localUser;
                    this.startPolling();
                } else if (this.isWebIDE && this.deviceId) {
                    Api.Auth.loginOrRegister(null, null, this.deviceId, true).then(res => {
                        if (res.code === 200) {
                            this.saveUser?.(res.data);
                            if (!res.data.password) {
                                setTimeout(() => {
                                    if (confirm('您当前使用设备ID登录，是否绑定账号密码以便跨设备使用？')) {
                                        this.showAuthModal?.();
                                    }
                                }, 2000);
                            }
                        } else {
                            this.showAuthModal?.();
                        }
                    });
                } else {
                    this.renderDemoMessage();
                }
            }

            startPolling() {
                if (this.isPolling) return;
                this.isPolling = true;
                this.renderDemoMessage();
                this.fetchMessages();
                this.pollingTimer = setInterval(() => this.fetchMessages(), 3000);
            }

            stopPolling() {
                if (this.pollingTimer) clearInterval(this.pollingTimer);
                this.pollingTimer = null;
                this.isPolling = false;
            }

            renderDemoMessage(force = false) {
                const list = document.getElementById('chat-list');
                if (!list) return;
                if (this.demoRendered && !force) return;
                if (list.querySelector('[data-demo="1"]')) return;
                this.demoRendered = true;
                const demoAvatar = getDiceBearAvatar('聊天室调试助手');
                const html = `
                    <div class="chat-msg-item chat-demo-msg" data-demo="1" data-msg-id="demo" data-user-id="0">
                        <div class="chat-avatar-box">
                            <img class="chat-avatar" src="${demoAvatar}" data-uid="0" data-name="调试助手">
                        </div>
                        <div style="max-width:75%;">
                            <div class="chat-username">调试助手</div>
                            <div class="chat-bubble">
                                <div class="chat-demo-title">聊天室调试信息</div>
                                <div>表情面板、发送按钮、图片入口和长按菜单已初始化。登录后会自动拉取真实消息。</div>
                                <div class="chat-demo-muted">这是一条本地 demo，不会写入后端。</div>
                            </div>
                            <div class="msg-time">本地调试</div>
                        </div>
                    </div>`;
                list.insertAdjacentHTML('beforeend', html);
            }

            removeDemoMessage() {
                const demo = document.querySelector('#chat-list [data-demo="1"]');
                if (demo) demo.remove();
            }

            async fetchMessages() {
                const user = this.getActiveUser();
                if (!user) {
                    this.renderDemoMessage();
                    return;
                }
                const res = await Api.Chat.getMessages(this.lastMsgId);
                if (res.code === 200) {
                    if (res.data && res.data.length > 0) {
                        this.removeDemoMessage();
                        this.renderMessages(res.data);
                        this.lastMsgId = res.data[res.data.length - 1].id;
                        const lastMsg = res.data[res.data.length - 1];
                        if (lastMsg.user_id != user.id && this.settings.notify) {
                            // 后续可接入 WebView 通知 / Notification
                        }
                    }
                    if (res.ad) this.renderAd(res.ad);
                }
            }

            normalizeImageUrl(url) {
                if (!url) return '';
                if (String(url).startsWith('data:image/')) return url;
                if (/^https?:\/\//i.test(url)) return url;
                const baseUrl = this.API_URL.substring(0, this.API_URL.lastIndexOf('/'));
                const cleanPath = String(url).replace(/^\/?api\//, '').replace(/^\/+/, '');
                return `${baseUrl}/${cleanPath}`;
            }

            renderMessages(msgs) {
                const list = document.getElementById('chat-list');
                if (!list) return;
                const currentUser = this.getActiveUser() || { id: 0 };
                const isAtBottom = (list.scrollHeight - list.scrollTop - list.clientHeight) < 150;

                msgs.forEach(msg => {
                    const isSelf = msg.user_id == currentUser.id;
                    const isAdmin = msg.role == 1;
                    const isSuper = msg.role == 2;
                    const isVip = msg.vip_expire > Date.now() / 1000;
                    const username = escapeHTML(msg.username || '用户');
                    let displayAvatar = msg.avatar;
                    const defaultAvatar = getDiceBearAvatar(msg.username || 'Guest');
                    if (!displayAvatar || displayAvatar === 'null' || String(displayAvatar).trim() === '') {
                        displayAvatar = defaultAvatar;
                    }

                    let badgesHtml = '';
                    if (isSuper) badgesHtml = '<div class="role-badge super">超管</div>';
                    else if (isAdmin) badgesHtml = '<div class="role-badge admin">管理</div>';
                    if (isVip) badgesHtml += '<div class="vip-badge">VIP</div>';

                    let contentHtml = this.escapeHtml(msg.content);
                    if (msg.type === 'image') {
                        const imgUrl = this.normalizeImageUrl(msg.content);
                        contentHtml = `<img src="${escapeAttr(imgUrl)}" class="chat-img-msg" onclick="app.interaction.previewImage(${jsStringArg(imgUrl)})" style="max-width:150px; border-radius:8px; margin-top:5px;">`;
                    } else {
                        contentHtml = this.parseLinks(contentHtml);
                        contentHtml = this.parseAtUsers(contentHtml);
                    }

                    let quoteHtml = '';
                    if (msg.quote_id && msg.quote_content) {
                        quoteHtml = `
                            <div class="chat-quote">
                                <span class="quote-user">@${escapeHTML(msg.quote_user || '用户')}</span>: 
                                <span class="quote-content">${this.escapeHtml(msg.quote_content)}</span>
                            </div>`;
                    }

                    const timeStr = this.formatTime(msg.created_at);
                    const html = `
                        <div class="chat-msg-item ${isSelf ? 'self' : ''}" data-msg-id="${escapeAttr(msg.id)}" data-user-id="${escapeAttr(msg.user_id)}">
                            <div class="chat-avatar-box">
                                <img class="chat-avatar"
                                     src="${escapeAttr(displayAvatar)}"
                                     onclick="app.circleManager.openUserProfile(${jsStringArg(msg.user_id)})"
                                     data-uid="${escapeAttr(msg.user_id)}"
                                     data-name="${escapeAttr(msg.username || '用户')}"
                                     onerror="this.onerror=null;this.src='${escapeAttr(defaultAvatar)}'">
                            </div>
                            <div style="max-width:75%;">
                                <div class="chat-username">${username}${badgesHtml}</div>
                                <div class="chat-bubble">${quoteHtml}${contentHtml}</div>
                                <div class="msg-time">${escapeHTML(timeStr)}</div>
                            </div>
                        </div>`;
                    list.insertAdjacentHTML('beforeend', html);
                });

                if (isAtBottom || this.lastMsgId === 0) {
                    setTimeout(() => list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }), 100);
                }
            }

            async sendText() {
                const user = this.getActiveUser();
                if (!user) return app.interaction.showToast('请先登录');
                const input = document.getElementById('chat-input');
                let text = input.value.trim();
                if (!text) return;

                const quoteData = this.quoteMsg ? {
                    quote_id: this.quoteMsg.id,
                    quote_content: this.quoteMsg.content,
                    quote_user: this.quoteMsg.username
                } : {};

                if (this.quoteMsg) this.clearQuote();
                input.value = '';

                const res = await Api.Chat.sendMessage(user.id, text, 'text', quoteData);
                if (res.code !== 200) app.interaction.showToast(res.msg);
                else this.fetchMessages();
            }

            async sendImage(fileInput) {
                const user = this.getActiveUser();
                if (!user) return app.interaction.showToast('请先登录');
                if (!fileInput.files.length) return;
                const file = fileInput.files[0];
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target.result;
                    app.interaction.showToast('正在上传图片...');
                    const quoteData = this.quoteMsg ? {
                        quote_id: this.quoteMsg.id,
                        quote_content: this.quoteMsg.content,
                        quote_user: this.quoteMsg.username
                    } : {};
                    if (this.quoteMsg) this.clearQuote();
                    const res = await Api.Chat.sendMessage(user.id, base64, 'image', quoteData);
                    if (res.code !== 200) app.interaction.showToast(res.msg);
                    else this.fetchMessages();
                };
                reader.readAsDataURL(file);
                fileInput.value = '';
            }

            renderAd(ad) {
                const banner = document.getElementById('chat-banner');
                const img = document.getElementById('chat-ad-img');
                const user = this.getActiveUser() || {};
                const isVip = (user.vip_expire > Date.now() / 1000) || (user.role > 0);
                if (ad && !isVip) {
                    if (banner) banner.style.display = 'block';
                    if (img) img.src = ad.image_url;
                    if (banner) banner.onclick = () => {
                        if (ad.link_url) window.open(ad.link_url, '_blank');
                    };
                } else if (banner) {
                    banner.style.display = 'none';
                }
            }

            showAvatarContextMenu(x, y, uid, uname) {
                this.targetUid = uid;
                const currentUser = this.getActiveUser();
                if (!currentUser) return;
                let menu;
                if (uid == currentUser.id) {
                    menu = document.getElementById('self-menu');
                    const notifyState = document.getElementById('notify-state');
                    if (notifyState) notifyState.innerText = this.settings.notify ? '开' : '关';
                } else if (currentUser.role > 0) {
                    menu = document.getElementById('admin-menu');
                } else {
                    const input = document.getElementById('chat-input');
                    input.value += `@${uname} `;
                    input.focus();
                    return;
                }
                if (menu) this.positionMenu(menu, x, y);
            }

            showMsgContextMenu(x, y, msgId, content, userId) {
                this.selectedMsg = { id: msgId, content, userId };
                const currentUser = this.getActiveUser();
                if (!currentUser) return;
                const menu = document.getElementById('msg-menu');
                if (!menu) return;
                const deleteBtn = document.getElementById('msg-delete-btn');
                const canDelete = (userId == currentUser.id) || (currentUser.role > 0);
                const canQuote = (currentUser.role > 0) || (currentUser.vip_expire > Date.now() / 1000);
                if (deleteBtn) deleteBtn.style.display = canDelete ? 'block' : 'none';
                const quoteItem = menu.querySelector('.context-item:first-child');
                if (quoteItem) {
                    quoteItem.style.opacity = canQuote ? '1' : '0.5';
                    quoteItem.style.pointerEvents = canQuote ? 'auto' : 'none';
                }
                this.positionMenu(menu, x, y);
            }

            positionMenu(menu, x, y) {
                menu.style.display = 'block';
                const w = window.innerWidth;
                const h = window.innerHeight;
                if (x + 150 > w) x = w - 160;
                if (y + 120 > h) y = h - 130;
                menu.style.left = x + 'px';
                menu.style.top = y + 'px';
            }

            quoteMessage() {
                if (!this.selectedMsg) return;
                this.quoteMsg = { id: this.selectedMsg.id, content: this.selectedMsg.content, username: '用户' };
                const input = document.getElementById('chat-input');
                input.placeholder = `回复: ${this.selectedMsg.content.substring(0, 10)}...`;
                input.focus();
                app.interaction.showToast('已进入引用模式');
                const menu = document.getElementById('msg-menu');
                if (menu) menu.style.display = 'none';
            }

            async deleteMessage() {
                const user = this.getActiveUser();
                if (!this.selectedMsg || !user) return;
                if (confirm('确定要撤回这条消息吗？')) {
                    const isAdmin = user.role > 0 ? 1 : 0;
                    const res = await Api.Chat.deleteMessage(this.selectedMsg.id, user.id, isAdmin);
                    app.interaction.showToast(res.msg);
                    if (res.code === 200) this.fetchMessages();
                }
                const menu = document.getElementById('msg-menu');
                if (menu) menu.style.display = 'none';
            }

            toggleEmojiPicker() {
                const picker = document.getElementById('emoji-picker');
                if (picker) picker.classList.toggle('active');
            }
            hideEmojiPicker() {
                const picker = document.getElementById('emoji-picker');
                if (picker) picker.classList.remove('active');
            }
            insertEmoji(emoji) {
                const input = document.getElementById('chat-input');
                if (!input) return;
                const start = input.selectionStart ?? input.value.length;
                const end = input.selectionEnd ?? input.value.length;
                input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
                const nextPos = start + emoji.length;
                input.setSelectionRange?.(nextPos, nextPos);
                input.focus();
                this.hideEmojiPicker();
            }

            clearQuote() {
                this.quoteMsg = null;
                const input = document.getElementById('chat-input');
                if (input) input.placeholder = '说点什么... (支持@用户)';
            }
            async adminAction(type, val) {
                const user = this.getActiveUser();
                if (!user) return app.interaction.showToast('请先登录');
                if (!val && val !== 0) return;
                const res = await Api.Auth.adminOp(user.id, this.targetUid, type, val);
                app.interaction.showToast(res.msg);
            }
            updateBanUI(user) {
                const lock = document.getElementById('banned-lock');
                const reason = document.getElementById('ban-reason-text');
                if (user.is_banned == 1 && lock) {
                    lock.style.display = 'flex';
                    if (reason) reason.innerText = '被封禁: ' + (user.ban_reason || '违规');
                } else if (lock) {
                    lock.style.display = 'none';
                }
            }

            formatTime(ts) {
                if (!ts) return '';
                const timestamp = ts > 10000000000 ? ts : ts * 1000;
                const date = new Date(timestamp);
                const diff = Math.floor((Date.now() - date.getTime()) / 1000);
                if (diff < 60) return '刚刚';
                if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
                if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
                return formatMonthDayTime(timestamp);
            }
            escapeHtml(text) { return escapeHTML(text || ''); }
            parseLinks(text) {
                return String(text || '').replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${escapeAttr(u)}" target="_blank" rel="noopener" style="color:var(--theme-color)">${escapeHTML(u)}</a>`);
            }
            parseAtUsers(text) { return String(text || '').replace(/@(\S+)/g, '<span style="color:#ff4d4f">@$1</span>'); }

            toggleNotify() {
                this.settings.notify = !this.settings.notify;
                localStorage.setItem('chat_settings', JSON.stringify(this.settings));
                app.interaction.showToast('通知已' + (this.settings.notify ? '开启' : '关闭'));
            }
        }

        // --- 日志管理器 ---

/* ---- app/core/22-log-manager.js ---- */
/* v3 semantic split: class from js/app/07-log-backup-clean-menu.js | keep script order */
        class LogManager {
            constructor() {
                this.logs = [];
                this.maxLogs = 200; // 最大保留条数
                this.container = document.getElementById('log-list-container');

                // 初始化时捕获全局错误
                this.initGlobalErrorHandling();
                this.log('system', '日志系统初始化完成');
                this.log('system', `UserAgent: ${navigator.userAgent}`);
            }

            // 拦截全局错误和 Promise 拒绝
            initGlobalErrorHandling() {
                window.onerror = (msg, url, line, col, error) => {
                    this.error(`Global: ${msg} (${line}:${col})`);
                    return false;
                };

                window.addEventListener('unhandledrejection', (event) => {
                    this.warn(`Unhandled Promise: ${event.reason}`);
                });

                // 可选：拦截 console.log (慎用，可能会导致无限循环如果这里面也调用了console)
                // const originalLog = console.log;
                // console.log = (...args) => {
                //    originalLog.apply(console, args);
                //    this.info(args.join(' '));
                // };
            }

            addEntry(level, msg) {
                const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" }) + "." + new Date().getMilliseconds().toString().padStart(3, '0');

                // 如果是对象，尝试转字符串
                if (typeof msg === 'object') {
                    try { msg = JSON.stringify(msg); } catch (e) { msg = '[Object]'; }
                }

                this.logs.push({ time, level, msg });
                if (this.logs.length > this.maxLogs) this.logs.shift();
            }

            log(level, msg) { this.addEntry(level, msg); }
            info(msg) { this.addEntry('info', msg); }
            warn(msg) { this.addEntry('warn', msg); }
            error(msg) { this.addEntry('error', msg); }

            // 渲染日志到界面
            renderLogs() {
                if (!this.container) this.container = document.getElementById('log-list-container');
                if (!this.container) return;

                if (this.logs.length === 0) {
                    this.container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">暂无日志</div>';
                    return;
                }

                // 倒序显示（最新的在最上面）或者正序，这里用最新的在最下面
                // 为了方便手机看，最新的在最上面可能更好？通常日志是追加在底部。
                // 这里采用：追加在底部，自动滚动。

                let html = this.logs.map(l => {
                    let colorClass = `log-level-${l.level}`; // default
                    if (l.level === 'system') colorClass = 'log-level-system';

                    return `
                        <div class="log-entry">
                            <div class="log-meta">
                                <div>${l.time}</div>
                                <div class="${colorClass}">[${l.level.toUpperCase()}]</div>
                            </div>
                            <div class="log-content ${colorClass}">${this.escapeHtml(l.msg)}</div>
                        </div>
                    `;
                }).join('');

                this.container.innerHTML = html;
                // 滚动到底部
                this.container.scrollTop = this.container.scrollHeight;
            }

            clearLogs() {
                this.logs = [];
                this.log('system', '日志已手动清空');
                this.renderLogs();
            }

            copyLogs() {
                const text = this.logs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
                navigator.clipboard.writeText(text).then(() => {
                    alert('日志已复制到剪贴板');
                }).catch(err => {
                    alert('复制失败，请手动长按选择');
                });
            }

            escapeHtml(str) {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }
        }

        // ==========================================
        //  4. BackupManager (云备份管理 - 完整版)
        // ==========================================
        // --- 独立的数据备份与恢复管理器 (终极融合版) ---

/* ---- app/core/23-backup-manager.js ---- */
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

/* ---- app/core/24-auto-cleaner.js ---- */
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

/* ---- app/features/menu/25-menu-manager.js ---- */
/* v3 semantic split: class from js/app/07-log-backup-clean-menu.js | keep script order */
        class MenuManager {
            constructor() {
                // 默认自动连播状态
                this.isAutoPlay = false;
                this.sheet = document.getElementById('work-settings-sheet');
            }

            open() {
                if (!this.sheet) return;

                const activeIndex = app.mainSwiper.activeIndex;
                const slide = app.mainSwiper.slides[activeIndex];
                const data = app.fullPlaylist[activeIndex];

                if (!slide || !data) return;

                // --- 1. 停止图集自动轮播 (新增逻辑) ---
                const gallerySwiper = slide.querySelector('.gallery-swiper');
                if (gallerySwiper && gallerySwiper.swiper && gallerySwiper.swiper.autoplay.running) {
                    gallerySwiper.swiper.autoplay.stop();
                    // 标记一下，以便关闭菜单时可以决定是否恢复（可选，目前需求只说停止）
                }

                this.initUI(slide, data);
                app.pageManager.pushState('work-settings');
                this.sheet.classList.add('active');
            }

            close() {
                history.back();
            }

            initUI(slide, data) {
                const isVideo = data.type === '视频';

                // 1. 基础 UI 显隐控制
                const speedSection = document.getElementById('ws-speed-section');
                const landscapeBtn = document.getElementById('btn-ws-landscape');
                const autoBtn = document.getElementById('btn-autoplay-toggle');
                const muteBtn = document.getElementById('btn-mute-toggle');

                // 更新收藏按钮状态
                const favBtn = document.getElementById('btn-favorite-toggle');
                if (favBtn) {
                    const isFav = app.userDataManager.isFavorite(data);
                    this.updateFavoriteBtnState(favBtn, isFav);
                }

                // 视频特有控件
                if (isVideo) {
                    if (speedSection) speedSection.style.display = 'block';

                    // 【核心修复】：获取视频当前的实际倍速，并更新 UI
                    const video = slide.querySelector('video');
                    const currentRate = video ? video.playbackRate : (CONFIG.DEFAULT_SPEED || 1.0);
                    this.updateSpeedUI(currentRate);

                    // 横屏按钮逻辑
                    if (landscapeBtn) {
                        let w = data.width; let h = data.height;
                        if (video) {
                            const vw = video.videoWidth;
                            const vh = video.videoHeight;
                            if (data.is_random_api || !w || !h) {
                                if (vw && vh) {
                                    w = vw;
                                    h = vh;
                                    data.width = vw;
                                    data.height = vh;
                                }
                            }
                        }
                        const ratio = (w && h) ? (w / h) : 0;
                        landscapeBtn.style.display = ratio >= 1.5 ? 'flex' : 'none';
                        if ((data.is_random_api || !w || !h) && video) {
                            const refreshLandscapeBtn = () => {
                                const vw = video.videoWidth || 0;
                                const vh = video.videoHeight || 0;
                                if (vw && vh) {
                                    data.width = vw;
                                    data.height = vh;
                                }
                                const nextRatio = (vw && vh) ? (vw / vh) : 0;
                                landscapeBtn.style.display = nextRatio >= 1.5 ? 'flex' : 'none';
                            };
                            video.addEventListener('loadedmetadata', refreshLandscapeBtn, { once: true });
                            video.addEventListener('loadeddata', refreshLandscapeBtn, { once: true });
                        }
                    }
                } else {
                    // 图集隐藏倍速和横屏按钮
                    if (speedSection) speedSection.style.display = 'none';
                    if (landscapeBtn) landscapeBtn.style.display = 'none';
                }

                // 按钮状态同步
                if (autoBtn) {
                    autoBtn.classList.toggle('active', CONFIG.AUTO_NEXT_VIDEO);
                }

                if (muteBtn) {
                    this.updateMuteBtnState(muteBtn, app.mediaManager.isGlobalMuted);
                }
                this._updateClearModeBtn();

                // 执行媒体信息分析
                this._analyzeMedia(slide, data);
            }
            /**
       * 分析媒体信息 (视频/图片) 并展示
       * 修改点：图集模式下隐藏图标，点击色块复制色值
       */
            async _analyzeMedia(slide, data) {
                // UI 元素
                const iconBox = document.getElementById('ws-info-icon-box');
                const icon = document.getElementById('ws-info-icon');
                const mainText = document.getElementById('ws-info-main');
                const subText = document.getElementById('ws-info-sub');
                const detailText = document.getElementById('ws-info-detail');

                // 重置状态
                mainText.innerText = '分析中...';
                subText.innerText = '--';
                detailText.innerText = '计算文件大小...';

                // 重置图标盒子样式
                iconBox.style.background = 'rgba(255,255,255,0.1)';
                iconBox.style.cursor = 'default';
                iconBox.onclick = null; // 清除旧事件
                iconBox.removeAttribute('title');

                // 重置图标显示状态 (默认显示白色图标)
                icon.style.display = 'block';
                icon.style.color = '#fff';

                // === 场景 A: 视频 ===
                if (data.type === '视频') {
                    const video = slide.querySelector('video');
                    icon.className = 'fa-solid fa-film';

                    if (video) {
                        // 1. 分辨率
                        const w = video.videoWidth || data.width || 0;
                        const h = video.videoHeight || data.height || 0;
                        if (w && h && (data.is_random_api || !data.width || !data.height)) {
                            data.width = w;
                            data.height = h;
                        }
                        // 2. 时长
                        const duration = video.duration || 0;
                        const timeStr = app.mediaManager.formatTime(duration);
                        // 3. 比例
                        const ratio = w && h ? (w / h).toFixed(2) : '-';

                        mainText.innerText = w && h ? `${w} × ${h} (${ratio})` : '分辨率未知';
                        subText.innerText = `视频时长: ${timeStr}`;

                        const landscapeBtn = document.getElementById('btn-ws-landscape');
                        if (landscapeBtn) {
                            const ratioVal = w && h ? (w / h) : 0;
                            landscapeBtn.style.display = ratioVal >= 1.5 ? 'flex' : 'none';
                        }

                        // 4. 获取大小 (异步)
                        const url = video.currentSrc || video.src || data.url;
                        if (url) {
                            const sizeStr = await app.mediaAnalyzer.getFileSize(url);
                            detailText.innerText = `文件大小: ${sizeStr}`;
                        } else {
                            detailText.innerText = '文件地址无效';
                        }
                    }
                }
                // === 场景 B: 图集 ===
                else {
                    // 【核心修改】隐藏图标，只显示纯色背景
                    icon.style.display = 'none';

                    // 获取图集信息
                    const gallerySwiper = slide.querySelector('.gallery-swiper');
                    const totalImages = data.images ? data.images.length : 0;
                    let currentIdx = 1;
                    let currentImg = null;

                    if (gallerySwiper && gallerySwiper.swiper) {
                        currentIdx = gallerySwiper.swiper.realIndex + 1;
                        const activeSlide = gallerySwiper.swiper.slides[gallerySwiper.swiper.activeIndex];
                        if (activeSlide) currentImg = activeSlide.querySelector('img');
                    }

                    // 1. 显示数量
                    mainText.innerText = `图集: 第 ${currentIdx} / ${totalImages} 张`;

                    // 2. 分析当前图片
                    if (currentImg) {
                        const w = currentImg.naturalWidth || 0;
                        const h = currentImg.naturalHeight || 0;

                        subText.innerText = w && h ? `当前分辨率: ${w} × ${h}` : '加载中...';

                        // 提取色调
                        try {
                            const color = app.mediaAnalyzer.extractColor(currentImg);

                            // 设置背景色
                            iconBox.style.background = color.rgb;

                            // 【核心修改】添加点击复制色值功能
                            iconBox.style.cursor = 'pointer';
                            iconBox.title = '点击复制主题色';

                            // 添加点击波纹反馈效果（简单的透明度变化）
                            iconBox.onclick = () => {
                                // 视觉反馈
                                iconBox.style.opacity = '0.7';
                                setTimeout(() => iconBox.style.opacity = '1', 150);

                                // 执行复制
                                if (navigator.clipboard) {
                                    navigator.clipboard.writeText(color.hex).then(() => {
                                        app.interaction.showToast(`已复制色值: <span style="font-family:monospace; font-weight:bold;">${color.hex}</span>`);
                                    }).catch(() => {
                                        app.interaction.showToast(`色值: ${color.hex}`);
                                    });
                                } else {
                                    // 兼容性兜底
                                    const input = document.createElement('textarea');
                                    input.value = color.hex;
                                    document.body.appendChild(input);
                                    input.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(input);
                                    app.interaction.showToast(`已复制色值: ${color.hex}`);
                                }
                            };

                        } catch (e) {
                            console.log('Color extract failed', e);
                            iconBox.style.background = '#555';
                        }

                        // 3. 获取大小 (异步)
                        const url = currentImg.currentSrc || currentImg.src;
                        if (url) {
                            const sizeStr = await app.mediaAnalyzer.getFileSize(url);
                            detailText.innerText = `当前图片大小: ${sizeStr}`;
                        }
                    } else {
                        subText.innerText = '图片未加载';
                        detailText.innerText = '-';
                    }
                }
            }

            toggleFavorite(btn) {
                // 打开收藏夹选择面板
                app.favManager.openAddToSheet();

                // 关闭长按菜单（为了体验更好，可以选择不关闭，或者延迟关闭）
                this.close();
            }

            // 增加一个无参的更新状态方法，供 FavManager 调用
            updateFavoriteBtnState(btn = null) {
                if (!btn) btn = document.getElementById('btn-favorite-toggle');
                if (!btn) return;

                const idx = app.mainSwiper.activeIndex;
                const work = app.fullPlaylist[idx];
                const isFav = app.userDataManager.isFavorite(work);

                const icon = btn.querySelector('i');
                const text = btn.querySelector('span');

                if (isFav) {
                    btn.classList.add('active');
                    icon.style.color = '#face15';
                    text.innerText = '已收藏';
                } else {
                    btn.classList.remove('active');
                    icon.style.color = '#fff';
                    text.innerText = '收藏';
                }
            }


            // 【新增】调用系统分享或自定义分享
            triggerShareMenu() {
                this.close(); // 先关闭菜单

                const currentWork = app.fullPlaylist[app.mainSwiper.activeIndex];
                const title = currentWork.title || '精彩作品';
                const text = `我在抖咻咻发现了一个很棒的作品：@${currentWork.author}`;
                // 构造带定位的链接
                const baseUrl = window.location.href.split('?')[0];
                const shareUrl = `${baseUrl}?share_type=work&author=${encodeURIComponent(currentWork.author)}&work_index=${app.mainSwiper.activeIndex}`;

                // 1. 优先尝试调用浏览器原生分享 (支持微信/QQ/系统面板)
                if (navigator.share) {
                    navigator.share({
                        title: title,
                        text: text,
                        url: shareUrl
                    }).catch((err) => {
                        console.log('分享取消或不支持', err);
                        // 如果取消了，不做处理；如果不支持，走降级
                    });
                } else {
                    // 2. 降级处理：模拟一个简单的选择弹窗
                    const choice = prompt(`【分享到】\n1. 复制链接 (发给微信/QQ好友)\n2. 分享到聊天室\n3. 分享到圈子\n\n请输入数字:`, "1");

                    if (choice === '1') {
                        app.interaction.copyText({ innerText: shareUrl });
                        app.interaction.showToast('链接已复制，请去微信/QQ粘贴');
                    } else if (choice === '2') {
                        // 简单的内部跳转模拟
                        app.pageManager.openComments();
                        setTimeout(() => {
                            const input = document.getElementById('chat-input');
                            if (input) {
                                input.value = `分享作品：${shareUrl}`;
                                input.focus();
                            }
                        }, 500);
                    } else if (choice === '3') {
                        app.pageManager.openPage('圈子');
                    }
                }
            }
            /**
            * 切换静音 (更新全局状态)
            */
            toggleMute(btn) {
                // 1. 切换全局运行时状态
                app.mediaManager.isGlobalMuted = !app.mediaManager.isGlobalMuted;
                const isMuted = app.mediaManager.isGlobalMuted;

                // 2. 立即应用到当前正在播放的媒体
                const slide = app.mainSwiper.slides[app.mainSwiper.activeIndex];
                const video = slide.querySelector('video');
                const audio = slide.querySelector('.bgm-audio');

                if (video) video.muted = isMuted;
                if (audio) audio.muted = isMuted;

                // 3. 更新 UI
                this.updateMuteBtnState(btn, isMuted);

                if (isMuted) {
                    app.interaction.showToast('已开启静音');
                } else {
                    app.interaction.showToast('已取消静音');
                }

                // 操作后保持菜单打开或关闭，看你喜好，原逻辑是关闭
                //this.close();
            }

            // [新增] 更新静音按钮 UI
            updateMuteBtnState(btn, isMuted) {
                const icon = btn.querySelector('i');
                const text = btn.querySelector('span');

                if (isMuted) {
                    btn.classList.add('active'); // 激活状态（绿点）
                    icon.className = 'fa-solid fa-volume-xmark';
                    text.innerText = "取消静音";
                } else {
                    btn.classList.remove('active');
                    icon.className = 'fa-solid fa-volume-high';
                    text.innerText = "静音播放";
                }
            }
            // 分析媒体信息 (尺寸 + 色调 + 大小)
            async _analyzeImageForUI(slide) {
                const mainText = document.getElementById('ws-info-main');
                const subText = document.getElementById('ws-info-sub');
                const colorCircle = document.getElementById('ws-color-circle');

                if (!mainText) return;

                // 1. 确定目标媒体 (Video 或 Img)
                const video = slide.querySelector('video');
                let targetMedia = video;

                if (!targetMedia) {
                    const gallerySwiper = slide.querySelector('.gallery-swiper');
                    if (gallerySwiper && gallerySwiper.swiper) {
                        const activeIdx = gallerySwiper.swiper.activeIndex;
                        const activeSlide = gallerySwiper.swiper.slides[activeIdx];
                        if (activeSlide) targetMedia = activeSlide.querySelector('img');
                    }
                }

                if (targetMedia) {
                    // --- A. 获取尺寸 (同步) ---
                    const w = targetMedia.videoWidth || targetMedia.naturalWidth || 0;
                    const h = targetMedia.videoHeight || targetMedia.naturalHeight || 0;
                    const dimText = w && h ? `${w} × ${h}` : "获取中...";

                    // --- B. 获取色调 (同步) ---
                    const colorInfo = app.mediaAnalyzer.extractColor(targetMedia);
                    colorCircle.style.background = colorInfo.rgb;

                    // --- C. 初始 UI 更新 ---
                    // Main 显示尺寸 (因为这最重要)
                    mainText.innerText = dimText;
                    // Sub 先显示 HEX 颜色
                    subText.innerText = `${colorInfo.hex} · 计算大小...`;

                    // --- D. 获取文件大小 (异步) ---
                    // 获取当前实际的 URL (currentSrc 对视频很重要，src 对图片很重要)
                    const url = targetMedia.currentSrc || targetMedia.src || targetMedia.dataset.src;

                    if (url) {
                        const sizeStr = await app.mediaAnalyzer.getFileSize(url);
                        // 更新 Sub Text：增加文件大小
                        subText.innerText = `${colorInfo.hex} · ${sizeStr}`;
                    } else {
                        subText.innerText = `${colorInfo.hex} · 未知`;
                    }

                } else {
                    mainText.innerText = "无法分析";
                    subText.innerText = "-";
                    colorCircle.style.background = '#333';
                }
            }

            // 清屏按钮状态辅助方法
            _updateClearModeBtn() {
                const clearBtn = document.getElementById('btn-clearmode-toggle');
                const isImmersive = document.body.classList.contains('immersive-mode');
                if (clearBtn) {
                    const span = clearBtn.querySelector('span');
                    if (isImmersive) {
                        clearBtn.classList.add('active');
                        if (span) span.innerText = "退出清屏";
                    } else {
                        clearBtn.classList.remove('active');
                        if (span) span.innerText = "清屏模式";
                    }
                }
            }

            // 原有的 analyzeImage 方法 (保持不变)
            analyzeImage(img) {
                const mainText = document.getElementById('ws-info-main');
                const subText = document.getElementById('ws-info-sub');
                const colorCircle = document.getElementById('ws-color-circle');
                if (!mainText) return;

                if (!img || !img.complete) {
                    mainText.innerText = "分析中...";
                    subText.innerText = "-";
                    return;
                }
                subText.innerText = `${img.naturalWidth} x ${img.naturalHeight} px`;
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1; canvas.height = 1;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const p = ctx.getImageData(0, 0, 1, 1).data;
                    colorCircle.style.background = `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
                    mainText.innerText = `主色调: ${this.rgbToHex(p[0], p[1], p[2])}`;
                } catch (e) {
                    colorCircle.style.background = '#333';
                    mainText.innerText = "色调获取受限";
                }
            }
            rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(); }

            // ================= 功能操作方法 =================

            /**
             * 1. 设置倍速 
             */
            // --- MenuManager 类中 ---

            /**
             * 设置播放速度
             */
            setSpeed(rate) {
                const slide = app.mainSwiper.slides[app.mainSwiper.activeIndex];
                const video = slide.querySelector('video');

                // 设置视频倍速
                if (video) {
                    video.playbackRate = rate;
                    app.interaction.showToast(`播放速度: ${rate}x`);
                }

                // 更新 UI 高亮
                this.updateSpeedUI(rate);

                // 关闭菜单
                // this.close();
            }

            /**
             * 更新倍速按钮高亮状态 (修复版)
             */
            updateSpeedUI(rate) {
                // 1. 【核心修复】限定选择器范围
                // 只查找 ID 为 ws-speed-section 下的 .glass-pill，避免误伤其他页面的胶囊按钮
                const pills = document.querySelectorAll('#ws-speed-section .glass-pill');

                pills.forEach(el => {
                    el.classList.remove('active');

                    // 2. 解析按钮文本 (例如 "1.0x" -> 1.0)
                    const textVal = parseFloat(el.innerText);

                    // 3. 比较数值 (使用 Math.abs 处理浮点数微小差异，虽然 1.0 通常是精确的)
                    // 确保 rate (如 1) 和 textVal (如 1) 能匹配上
                    if (!isNaN(textVal) && Math.abs(textVal - rate) < 0.01) {
                        el.classList.add('active');
                    }
                });
            }

            /**
             * 2. 切换自动连播 (修改版：直接操作 SettingsManager)
             */
            toggleAutoPlay(btn) {
                // 1. 获取新状态
                const newState = !CONFIG.AUTO_NEXT_VIDEO;

                // 2. 调用设置管理器更新 (会自动保存到本地存储)
                app.settingsManager.update('AUTO_NEXT_VIDEO', newState);
                this.isAutoPlay = newState;

                // 3. 更新当前按钮 UI
                if (newState) {
                    btn.classList.add('active');
                    app.interaction.showToast('自动连播: 开启');
                } else {
                    btn.classList.remove('active');
                    app.interaction.showToast('自动连播: 关闭');
                }
            }

            /**
             * 3. 重新加载 (修复：真正的重新加载数据渲染)
             */
            reloadCurrent() {
                this.close(); // 关闭菜单

                const index = app.mainSwiper.activeIndex;
                const slide = app.mainSwiper.slides[index];
                const data = app.fullPlaylist[index];

                if (!slide || !data) return;

                // 1. UI 提示
                app.interaction.showToast('正在重新加载...');

                // 2. 停止当前媒体
                app.mediaManager.stop();

                // 3. 重新生成 HTML
                // 这会将 video/img 重置回初始状态 (只有 data-src，没有 src)
                const newHtml = app.renderer.createSlideHtml(data, index);
                slide.innerHTML = newHtml;

                // 4. 重新初始化组件
                if (data.type !== '视频') {
                    // 如果是图集，必须重新初始化 Swiper 实例
                    app.initGallery();
                }

                // 5. 核心修复：强制资源加载
                // 这一步会将 data-src 赋值给 src，并触发浏览器的下载
                app.coordinator.processSlide(slide, 'active');

                // 6. 稍微延迟后尝试自动播放
                // 等待 DOM 更新和 ResourceCoordinator 处理完毕
                setTimeout(() => {
                    // 尝试调整布局 (封面图等)
                    const media = slide.querySelector('.lazy-media');
                    if (media) app.adjustLayout(media);

                    // 播放
                    app.mediaManager.play(slide);
                }, 150);
            }
            /** 4. 分享当前作品（修复：生成包含作者和索引的链接） */
            shareCurrentWork() {
                const currentWork = app.fullPlaylist[app.mainSwiper.activeIndex];
                const authorName = currentWork.author;
                const workId = currentWork.id;

                // 获取资源的源头信息 (用于判断是否是本地)
                // 这里的逻辑假设 dataLoader.globalCreators 能通过 authorName 找到资源包
                // 如果找不到，或者 origin_type 是 local，则视为本地资源
                const creatorData = app.dataLoader.globalCreators[authorName];
                const isLocal = !creatorData || creatorData.info.origin_type === 'local' || !creatorData.info.source_url;

                const baseUrl = window.location.href.split('?')[0];
                let shareUrl = "";
                let shareTip = "";

                // === 分支 1：如果是网络导入的资源，且保留了 share_url，优先分享源链接 ===
                if (currentWork.share_url && currentWork.share_url.startsWith('http')) {
                    // 直接分享原始链接，让接收方自己去解析
                    shareUrl = currentWork.share_url;
                    shareTip = "已复制原始分享链接";
                }
                // === 分支 2：如果是纯本地数据，或者是解析后的直链数据 ===
                else if (isLocal) {
                    // 提取最小化核心数据 (防止 URL 过长)
                    const miniData = {
                        t: currentWork.title,       // title
                        a: currentWork.author,      // author
                        u: currentWork.url,         // url (视频/音频直链)
                        c: currentWork.cover,       // cover
                        tp: currentWork.type,       // type
                        i: currentWork.images       // images (如果是图集)
                    };

                    try {
                        // 序列化 -> Base64 编码 -> URL 编码
                        const jsonStr = JSON.stringify(miniData);
                        // 处理中文编码问题
                        const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));

                        shareUrl = `${baseUrl}?share_type=payload&data=${base64Data}`;
                        shareTip = "已生成数据便携链接";
                    } catch (e) {
                        console.error("生成长链接失败", e);
                        app.interaction.showToast("数据过长，无法生成分享链接");
                        return;
                    }
                }
                // === 分支 3：普通的 ID 定位分享 (原有逻辑) ===
                else {
                    shareUrl = `${baseUrl}?share_type=work&author=${encodeURIComponent(authorName)}`;
                    if (workId) shareUrl += `&work_id=${encodeURIComponent(workId)}`;
                    shareUrl += `&work_index=${app.mainSwiper.activeIndex}`;
                    shareTip = "作品链接已复制";
                }

                const text = `我在抖咻咻发现了一个很棒的作品：\n${currentWork.title || '分享作品'} \n@${authorName}\n\n查看链接：\n${shareUrl}`;

                // 执行复制
                const doCopy = (content) => {
                    const input = document.createElement('textarea');
                    input.value = content;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    app.interaction.showToast(shareTip);
                };

                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(() => app.interaction.showToast(shareTip)).catch(() => doCopy(text));
                } else {
                    doCopy(text);
                }
            }

            triggerLandscape() {
                this.close(); // 先关闭菜单
                setTimeout(() => {
                    // 【关键修改】调用新方法
                    if (app.landscapePlayer) {
                        app.landscapePlayer.toggle();
                    }
                }, 300);
            }

            toggleClearMode(btn) {
                // 1. 获取当前状态
                const isCurrentlyImmersive = document.body.classList.contains('immersive-mode');

                // 2. 计算目标状态 (取反)
                const targetState = !isCurrentlyImmersive;

                // 3. 调用统一管理方法 (处理 body class、Swiper 锁定、Toast 提示)
                app.interaction.setImmersiveMode(targetState);

                // 4. 【核心修改】立即更新按钮文字和高亮状态
                const span = btn.querySelector('span');

                if (targetState) {
                    // 进入清屏模式
                    btn.classList.add('active');
                    if (span) span.innerText = "退出清屏";
                } else {
                    // 退出清屏模式
                    btn.classList.remove('active');
                    if (span) span.innerText = "清屏模式";
                }

                // 5. 操作完成后自动关闭菜单，提升体验
                this.close();
            }

            // 3. 保存本地 (修复版：通用支持多视频/多图片/单视频)
            downloadCurrent() {
                const idx = app.mainSwiper.activeIndex;
                const data = app.fullPlaylist[idx];
                const slide = app.mainSwiper.slides[idx];

                // 1. 准备资源数据 (按顺序生成 currentAssets)
                app.downloadMgr.prepareAssets(data);

                let targetIndices = [];
                let msg = '';

                // 2. 检查是否存在轮播组件 (Swiper)
                // 无论 type 是 '视频' 还是 '图集'，只要 UI 上是轮播的，就按轮播索引取
                const galleryEl = slide.querySelector('.gallery-swiper');

                if (galleryEl && galleryEl.swiper) {
                    // --- 多资源模式 (图集 或 视频合集) ---
                    const currentIndex = galleryEl.swiper.realIndex;
                    targetIndices = [currentIndex];

                    // 尝试判断资源类型以优化提示语
                    const asset = app.downloadMgr.currentAssets[currentIndex];
                    const typeName = (asset && asset.type === 'video') ? '视频' : '图片';
                    msg = `正在保存第 ${currentIndex + 1} 个${typeName}...`;
                } else {
                    // --- 单资源模式 (单视频 或 单图) ---
                    // 默认为第 0 个资源
                    targetIndices = [0];
                    msg = '正在保存当前作品...';
                }

                // 3. 执行下载
                if (targetIndices.length > 0 && app.downloadMgr.currentAssets.length > 0) {
                    // 边界检查：防止索引越界 (例如数据只有1个，但Swiper错乱指向了2)
                    if (targetIndices[0] >= app.downloadMgr.currentAssets.length) {
                        targetIndices = [0]; // 回退到第一个
                    }

                    app.interaction.showToast(msg);
                    setTimeout(() => {
                        app.downloadMgr.downloadDirect(targetIndices);
                        this.close();
                    }, 300);
                } else {
                    app.interaction.showToast('未找到可下载资源');
                }
            }

            triggerDislike() {

                app.interaction.showToast('将减少此类作品推荐');
                setTimeout(() => app.mainSwiper.slideNext(), 500);
            }

            triggerReport() {

                setTimeout(() => {
                    if (confirm("确定要举报该作品吗？")) {
                        app.interaction.showToast('举报已提交');
                    }
                }, 300);
            }
        }

/* ---- app/features/settings/26-settings-manager.js ---- */
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

/* ---- app/features/search/27-search-manager.js ---- */
/* v3 semantic split: class from js/app/08-settings-search-circle-page.js | keep script order */
        class SearchManager {
            constructor() {
                this.HISTORY_KEY = 'dxx_search_history';
                this.history = []; // 初始为空，异步加载
                this.currentTab = 'local-video';
                this.keyword = '';
                this.inputEl = document.getElementById('global-search-input');

                this.debounceTimer = null;
                this.currentLocalResults = [];
                this.currentOnlineResults = [];
                this.bannerSwiper = null;
                this.localScopeWorks = null;
                this.localScopeName = '';
                this.defaultSuggestTags = ['美女', '风景', '情感', '4K', '游戏'];

                // 初始化加载历史
                this.initHistory();

                if (this.inputEl) {
                    this.inputEl.addEventListener('keyup', (e) => {
                        if (e.key === 'Enter') this.doSearch();
                    });
                    this.inputEl.addEventListener('input', (e) => {
                        this.onInput(e.target.value);
                    });
                }
            }

            async initHistory() {
                this.history = await StorageService.get(this.HISTORY_KEY, []);
            }

            setLocalScope(works, name) {
                this.localScopeWorks = Array.isArray(works) ? works : null;
                this.localScopeName = name || '';
                if (this.inputEl) {
                    this.inputEl.placeholder = this.localScopeWorks
                        ? `搜索 @${this.localScopeName || '该博主'} 的作品...`
                        : '本地 / 联网搜索...';
                }
                this.updateScopeTabs();
                this.updateScopeDefaultView();
            }

            clearLocalScope() {
                this.setLocalScope(null, '');
            }

            updateScopeTabs() {
                const onlineTab = document.getElementById('search-tab-online');
                if (onlineTab) {
                    onlineTab.style.display = this.localScopeWorks ? 'none' : '';
                }
                const labelMap = {
                    'local-video': this.localScopeWorks ? '他的视频' : '本地视频',
                    'local-image': this.localScopeWorks ? '他的图集' : '本地图集',
                    'local-music': this.localScopeWorks ? '他的音乐' : '本地音乐'
                };
                document.querySelectorAll('#search-result-view .view-btn').forEach(btn => {
                    const onclick = btn.getAttribute('onclick') || '';
                    if (onclick.includes('local-video')) btn.innerText = labelMap['local-video'];
                    if (onclick.includes('local-image')) btn.innerText = labelMap['local-image'];
                    if (onclick.includes('local-music')) btn.innerText = labelMap['local-music'];
                });
            }

            updateScopeDefaultView() {
                const hotSection = document.getElementById('search-hot-section');
                if (hotSection) {
                    hotSection.style.display = this.localScopeWorks ? 'none' : '';
                }
                this.renderSuggestTags();
            }

            renderSuggestTags() {
                const container = document.getElementById('search-suggest-tags');
                if (!container) return;

                let tags = [];
                if (this.localScopeWorks && this.localScopeWorks.length > 0) {
                    const tagSet = new Set();
                    this.localScopeWorks.forEach(w => {
                        const title = (w.title || w.desc || '');
                        const musicTitle = (w.music_info?.title || '');
                        const author = (w.author || '');
                        const matches = title.match(/#([^#\\s]+)/g) || [];
                        matches.forEach(t => tagSet.add(t.replace('#', '').trim()));
                        if (musicTitle) tagSet.add(musicTitle.trim());
                        if (author) tagSet.add(author.trim());
                    });
                    tags = Array.from(tagSet).filter(Boolean).slice(0, 6);
                }

                if (tags.length === 0) tags = [...this.defaultSuggestTags];

                container.innerHTML = tags.map((t, i) => {
                    const fireClass = i === 0 ? ' fire' : '';
                    const fireIcon = i === 0 ? '<i class="fa-solid fa-fire"></i> ' : '';
                    return `<div class="search-tag${fireClass}" onclick="app.searchManager.quickSearch(${jsStringArg(t)})">${fireIcon}${escapeHTML(t)}</div>`;
                }).join('');
            }

            open() {
                app.pageManager.pushState('search');
                document.getElementById('search-page').classList.add('active');

                // 1. 渲染历史 (确保数据已加载)
                this.renderHistory();

                // 2. 初始化轮播
                this.initBanner();

                // 3. 初始化热榜
                this.renderHotList();

                const val = this.inputEl.value;
                this.toggleClearBtn();
                if (val) {
                    this.onInput(val);
                } else {
                    this.showDefaultView();
                }
                this.updateScopeTabs();
                this.updateScopeDefaultView();
                setTimeout(() => this.inputEl.focus(), 300);
            }

            openProfileSearch() {
                this.setLocalScope(app.currentProfileWorks || [], app.currentProfileName || '');
                this.open();
                const firstTab = document.querySelector('#search-result-view .view-btn');
                this.switchTab('local-video', firstTab);
            }

            // --- 历史记录操作 (异步化) ---
            renderHistory() {
                const container = document.getElementById('search-history-tags');
                if (!container) return;

                if (this.history.length === 0) {
                    container.innerHTML = '<div style="font-size:12px;color:#666;padding:10px;">暂无搜索记录</div>';
                    return;
                }
                container.innerHTML = this.history.map(k => `<div class="search-tag" onclick="app.searchManager.quickSearch(${jsStringArg(k)})">${escapeHTML(k)}</div>`).join('');
            }

            async saveHistory(val) {
                // 内存操作
                this.history = this.history.filter(h => h !== val);
                this.history.unshift(val);
                if (this.history.length > 10) this.history.pop();

                // 渲染更新
                this.renderHistory();

                // 异步存入 DB
                await StorageService.set(this.HISTORY_KEY, this.history);
            }

            async clearHistory() {
                if (confirm('清空所有搜索历史？')) {
                    this.history = [];
                    await StorageService.remove(this.HISTORY_KEY);
                    this.renderHistory();
                }
            }

            // ... 以下方法保持不变，直接复制即可 ...
            // onInput, showDefaultView, toggleClearBtn, clearInput, quickSearch, doSearch, switchTab
            // initBanner, renderHotList, searchLocal, searchOnline, renderList, playLocalWork, playOnlineWork
            // 为了节省篇幅，请保留你原有代码中这些方法的实现，不需要改动

            onInput(val) {
                val = val.trim();
                this.keyword = val;
                this.toggleClearBtn();
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                if (val) {
                    document.getElementById('search-default-view').style.display = 'none';
                    document.getElementById('search-result-view').style.display = 'flex';
                    this.debounceTimer = setTimeout(() => {
                        if (this.currentTab === 'online') return;
                        this.searchLocal(this.currentTab);
                    }, 300);
                } else {
                    this.showDefaultView();
                }
            }
            showDefaultView() {
                document.getElementById('search-default-view').style.display = 'block';
                document.getElementById('search-result-view').style.display = 'none';
            }
            toggleClearBtn() {
                const btn = document.getElementById('search-clear-btn');
                if (btn) btn.style.display = this.inputEl.value ? 'block' : 'none';
            }
            clearInput() {
                this.inputEl.value = '';
                this.keyword = '';
                this.toggleClearBtn();
                this.showDefaultView();
                this.inputEl.focus();
            }
            quickSearch(kw) {
                this.inputEl.value = kw;
                this.doSearch();
            }
            doSearch() {
                const val = this.inputEl.value.trim();
                if (!val) return app.interaction.showToast('请输入关键词');
                this.keyword = val;
                this.inputEl.blur();
                this.saveHistory(val); // 调用新的异步保存
                document.getElementById('search-default-view').style.display = 'none';
                document.getElementById('search-result-view').style.display = 'flex';
                if (this.currentTab === 'online') {
                    this.searchOnline();
                } else {
                    this.searchLocal(this.currentTab);
                }
            }
            switchTab(tab, btn) {
                if (tab === 'online' && this.localScopeWorks) {
                    app.interaction.showToast('当前为博主内搜索，暂不支持联网');
                    return;
                }
                this.currentTab = tab;
                document.querySelectorAll('#search-result-view .view-btn').forEach(b => b.classList.remove('active'));
                if (btn) btn.classList.add('active');
                if (!this.keyword) return;
                if (tab === 'online') {
                    this.searchOnline();
                } else {
                    this.searchLocal(tab);
                }
            }
            initBanner() {
                if (this.bannerSwiper) return;
                const container = document.getElementById('search-banner-list');
                if (!container) return;
                const banners = [
                    { img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80', title: '2025 城市夜景摄影大赛' },
                    { img: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=800&q=80', title: '追逐北极光：治愈之旅' },
                    { img: 'https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=800&q=80', title: '独立音乐人新歌首发' },
                    { img: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=800&q=80', title: 'AI绘画技术新突破' }
                ];
                let html = banners.map(b => `
            <div class="swiper-slide banner-slide-item" 
                 style="background-image: url('${b.img}'); background-size: cover; background-position: center;" 
                 onclick="app.searchManager.quickSearch(${jsStringArg(b.title.split(' ')[1])})">
                <div class="banner-text-overlay">${escapeHTML(b.title)}</div>
            </div>`).join('');
                container.innerHTML = html;
                this.bannerSwiper = new Swiper('.search-banner-swiper', {
                    loop: true, speed: 600, autoplay: { delay: 4000, disableOnInteraction: false },
                    pagination: { el: '.swiper-pagination', clickable: true }, observer: true, observeParents: true
                });
            }
            renderHotList() {
                let container = document.getElementById('hot-search-list');
                if (!container) {
                    const defaultView = document.getElementById('search-default-view');
                    if (defaultView) {
                        const section = document.createElement('div');
                        section.className = 'hot-list-section';
                        section.innerHTML = `
                    <div class="settings-group-title" style="margin-top: 25px; margin-bottom: 10px; display:flex; align-items:center; gap:6px;">
                        <i class="fa-brands fa-hotjar" style="color: #ff4d4f;"></i> 抖音热榜
                        <span style="font-size:10px; color:#666; font-weight:normal; margin-left:auto;">每10分钟更新</span>
                    </div>
                    <div class="hot-list-card" id="hot-search-list"></div>
                    <div style="height: 60px;"></div>`;
                        defaultView.appendChild(section);
                        container = document.getElementById('hot-search-list');
                    } else return;
                }
                if (container.children.length > 0) return;
                const hotData = [
                    { title: "周杰伦新歌首发", score: "982.1w", tag: "爆" },
                    { title: "熊猫花花又长胖了", score: "830.5w", tag: "热" },
                    { title: "特种兵旅游攻略", score: "766.2w", tag: "热" },
                    { title: "这谁顶得住啊", score: "650.3w", tag: "新" },
                    { title: "修狗的迷惑行为", score: "520.1w", tag: "" },
                    { title: "2025年第一场雪", score: "480.9w", tag: "新" },
                    { title: "好听的背景音乐", score: "420.5w", tag: "" },
                    { title: "科目三舞蹈教学", score: "390.0w", tag: "" },
                    { title: "极简主义生活", score: "330.2w", tag: "" },
                    { title: "AI生成的二次元", score: "290.8w", tag: "" }
                ];
                let html = hotData.map((item, index) => {
                    const rank = index + 1;
                    let rankClass = 'rank-other';
                    if (rank === 1) rankClass = 'rank-1';
                    if (rank === 2) rankClass = 'rank-2';
                    if (rank === 3) rankClass = 'rank-3';
                    let tagHtml = item.tag ? `<span class="hot-tag tag-${item.tag}">${item.tag}</span>` : '';
                    return `
            <div class="hot-item" onclick="app.searchManager.quickSearch(${jsStringArg(item.title)})" style="display:flex; align-items:center; padding:12px 15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                <div class="hot-rank ${rankClass}" style="width:24px; font-weight:bold; font-style:italic; margin-right:10px; text-align:center;">${rank}</div>
                <div class="hot-content" style="flex:1; color:#ddd; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${escapeHTML(item.title)} ${tagHtml}
                </div>
                <div class="hot-score" style="font-size:12px; color:#666;">${escapeHTML(item.score)}</div>
            </div>`;
                }).join('');
                container.innerHTML = html;
            }
            searchLocal(type) {
                const listContainer = document.getElementById('search-result-list');
                const emptyTip = document.getElementById('search-empty');
                const loading = document.getElementById('search-loading');
                listContainer.innerHTML = '';
                loading.style.display = 'none';
                emptyTip.style.display = 'none';
                let allWorks = [];
                if (this.localScopeWorks && this.localScopeWorks.length > 0) {
                    allWorks = this.localScopeWorks.map(w => ({ ...w }));
                    if (this.localScopeName) {
                        const creator = app.dataLoader.globalCreators[this.localScopeName];
                        if (creator && creator.info && creator.info.avatar) {
                            allWorks.forEach(w => { if (!w.avatar) w.avatar = creator.info.avatar; });
                        }
                    }
                } else {
                    const creators = app.dataLoader.globalCreators;
                    Object.values(creators).forEach(c => {
                        c.works.forEach(w => {
                            if (!w.avatar) w.avatar = c.info.avatar;
                            allWorks.push(w);
                        });
                    });
                    // 追加本地扫描资源（视频/音乐）
                    if (window.app && app.localMediaCache) {
                        const seenIds = new Set(allWorks.map(w => String(w.id || '')));
                        ['video', 'music'].forEach((t) => {
                            const cacheWorks = (app.localMediaCache[t] && Array.isArray(app.localMediaCache[t].works))
                                ? app.localMediaCache[t].works
                                : [];
                            cacheWorks.forEach(w => {
                                const id = String(w.id || '');
                                if (id && seenIds.has(id)) return;
                                if (id) seenIds.add(id);
                                allWorks.push(w);
                            });
                        });
                    }
                }
                const q = this.keyword.toLowerCase().trim();
                if (!q) return;
                let scoredResults = allWorks.map(w => {
                    if (type === 'local-video' && w.type !== '视频') return null;
                    if (type === 'local-image' && w.type !== '图集') return null;
                    if (type === 'local-music') {
                        if (!w.music_info || !w.music_info.url) return null;
                        const mTitle = (w.music_info.title || '').toLowerCase();
                        const mAuthor = (w.music_info.author || '').toLowerCase();
                        let mScore = 0;
                        if (mTitle.includes(q)) mScore += 20;
                        if (mAuthor.includes(q)) mScore += 10;
                        if (mScore > 0) return { work: w, score: mScore };
                        return null;
                    }
                    let score = 0;
                    const title = (w.title || '').toLowerCase();
                    const author = (w.author || '').toLowerCase();
                    const musicTitle = (w.music_info?.title || '').toLowerCase();
                    const musicAuthor = (w.music_info?.author || '').toLowerCase();
                    const hashtags = (title.match(/#(\S+)/g) || []).map(t => t.toLowerCase());
                    hashtags.forEach(tag => {
                        if (tag === '#' + q) score += 100;
                        else if (tag.includes(q)) score += 50;
                    });
                    if (title.includes(q)) { score += 20; if (title.startsWith(q)) score += 10; }
                    if (author.includes(q)) { score += 10; if (author === q) score += 15; }
                    if (musicTitle.includes(q) || musicAuthor.includes(q)) score += 5;
                    if (score > 0) return { work: w, score: score };
                    return null;
                });
                scoredResults = scoredResults.filter(i => i !== null);
                scoredResults.sort((a, b) => b.score - a.score);
                const results = scoredResults.map(item => item.work);
                this.currentLocalResults = results;
                if (results.length === 0) {
                    emptyTip.style.display = 'block';
                    emptyTip.querySelector('div').innerText = '本地未找到相关资源';
                } else {
                    this.renderList(results, type === 'local-music', false);
                }
            }
            async searchOnline() {
                const listContainer = document.getElementById('search-result-list');
                const emptyTip = document.getElementById('search-empty');
                const loading = document.getElementById('search-loading');
                listContainer.innerHTML = '';
                loading.style.display = 'block';
                emptyTip.style.display = 'none';
                try {
                    const json = await Api.External.searchDouyin(this.keyword);
                    loading.style.display = 'none';
                    // 兼容新旧API格式：新API返回 {code:200, data:[...]}，旧API返回 {aweme_list:[...]}
                    const dataList = json.data || json.aweme_list || [];
                    if (json.code === 200 && dataList.length > 0) {
                        const onlineWorks = dataList.map(item => ({
                            type: (item.type === 1 || item.video_url) ? '视频' : '图集',
                            title: item.title || item.desc || '',
                            author: item.author || item.nickname || '网络用户',
                            avatar: item.avatar || '',
                            cover: item.cover || item.img_url || '',
                            url: item.video_url || item.play_url || '',
                            images: item.images || [],
                            like: item.like || 0,
                            comment: 0,
                            music_info: { title: item.music_title || '原声', author: item.music_author || '未知', url: item.music_url || '' },
                            isOnlineResult: true,
                            share_url: item.share_url || item.url || ''
                        }));
                        this.currentOnlineResults = onlineWorks;
                        this.renderList(onlineWorks, false, true);
                    } else {
                        emptyTip.style.display = 'block';
                        emptyTip.querySelector('div').innerText = json.msg || '未搜索到相关内容';
                    }
                } catch (e) {
                    loading.style.display = 'none';
                    app.interaction.showToast('网络请求失败');
                }
            }
            renderList(works, isMusicMode = false, isOnline = false) {
                const container = document.getElementById('search-result-list');

                // 如果是在资源管理页，可能是另一个容器 ID，这里做兼容
                const targetContainer = container || document.getElementById('rm-works-grid');
                if (!targetContainer) return;

                const html = works.map((w, i) => {
                    let clickAction = '';
                    if (isOnline) clickAction = `app.searchManager.playOnlineWork(${i})`;
                    else if (isMusicMode) clickAction = `app.playFromMyMusic(${i})`;
                    else clickAction = `app.searchManager.playLocalWork(${i})`;
                    return renderUniWorkListItem(w, i, {
                        clickAction,
                        allowLiked: !isOnline,
                        fallbackAuthor: w.author || '未知用户'
                    });
                }).join('');

                targetContainer.innerHTML = html;
            }
            playLocalWork(index) {
                if (this.currentLocalResults && this.currentLocalResults.length > 0) {
                    app.enterContextPlay(this.currentLocalResults, index);
                }
            }
            async playOnlineWork(index) {
                const work = this.currentOnlineResults[index];
                if (!work) return;
                if (work.url && work.url.startsWith('http')) {
                    app.enterContextPlay([work], 0);
                    return;
                }
                app.interaction.showToast('正在解析作品...');
                try {
                    const json = await Api.External.parseVideo(work.share_url || work.cover);
                    if (json.code === 200) {
                        const fullWork = app.customManager.convertDyDataToCreator([json]).works[0];
                        app.enterContextPlay([fullWork], 0);
                    } else { throw new Error(json.msg); }
                } catch (e) { app.interaction.showToast('解析失败: ' + e.message); }
            }
        }

/* ---- app/startup/28-app-start-manager.js ---- */
/* v3 semantic split: class from js/app/08-settings-search-circle-page.js | keep script order */
        class AppStartManager {
            constructor() {
                this.splash = document.getElementById('splash-screen');
                this.privacyModal = document.getElementById('startup-privacy-modal');
                this.privacyMask = document.getElementById('startup-privacy-mask');
                this.hasAgreed = localStorage.getItem('douxiuxiu_agreed_privacy') === 'true';
                this.hasStarted = false;
                this.hasEntered = false;
                this.hasForcedEntry = false;
                this.startTimer = null;
                this.resourceGuarded = false;
                this.resourceErrorHandler = this.handleResourceLoadError.bind(this);
                this.registerResourceGuard();
            }

            // 启动入口
            start() {
                if (this.hasStarted) return;
                this.hasStarted = true;
                this.registerResourceGuard();

                // 1. 显示开屏，模拟加载资源
                // 实际上 app.init() 已经在后台运行请求了
                this.startTimer = setTimeout(() => {
                    if (this.hasAgreed) {
                        this.enterApp();
                    } else {
                        this.showPrivacyModal();
                    }
                }, 2000); // 强制显示 2秒 开屏，提升品牌感
            }

            showPrivacyModal() {
                this.privacyModal.classList.add('active');
                this.privacyMask.classList.add('active');
            }

            agreeAndEnter() {
                localStorage.setItem('douxiuxiu_agreed_privacy', 'true');
                this.privacyModal.classList.remove('active');
                this.privacyMask.classList.remove('active');
                this.enterApp();
            }

            enterApp() {
                if (this.hasEntered) return;
                this.hasEntered = true;
                this.clearStartTimer();

                // 隐藏开屏
                this.splash.classList.add('fade-out');

                // 500ms 动画结束后移除 DOM (可选)
                setTimeout(() => {
                    this.splash.style.display = 'none';
                }, 500);
            }

            registerResourceGuard() {
                if (this.resourceGuarded) return;
                window.addEventListener('error', this.resourceErrorHandler, true);
                this.resourceGuarded = true;
            }

            handleResourceLoadError(event) {
                const target = event?.target || event?.srcElement;
                if (!target || !target.tagName) return;
                const tag = target.tagName.toUpperCase();
                const criticalTags = ['SCRIPT', 'LINK', 'IMG', 'VIDEO', 'AUDIO', 'SOURCE', 'STYLE', 'IFRAME'];
                if (!criticalTags.includes(tag)) return;
                const url = target.src || target.href;
                if (!url) return;

                if (target.dataset && target.dataset.dxxErrorHandled === '1') return;
                if (target.dataset) target.dataset.dxxErrorHandled = '1';

                this.forceEnterApp(`资源加载失败 (${tag})`);
            }

            forceEnterApp(message) {
                if (this.hasForcedEntry || this.hasEntered) return;
                this.hasForcedEntry = true;
                this.clearStartTimer();
                this.notifyResourceFailure(message);

                if (this.hasAgreed) {
                    this.enterApp();
                } else {
                    this.showPrivacyModal();
                }
            }

            notifyResourceFailure(message) {
                if (window.app && window.app.interaction) {
                    window.app.interaction.showToast('部分资源加载失败，已尝试进入', 3500);
                } else {
                    console.warn('资源加载失败，已尝试进入：', message);
                }
            }

            clearStartTimer() {
                if (this.startTimer) {
                    clearTimeout(this.startTimer);
                    this.startTimer = null;
                }
            }
        }
        const GLOBAL_START_MANAGER = new AppStartManager();
        GLOBAL_START_MANAGER.start();

/* ---- app/startup/29-link-parser.js ---- */
/* v3 semantic split: class from js/app/08-settings-search-circle-page.js | keep script order */
        class LinkParser {
            static parse(content) {
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                return content.replace(urlRegex, (url) => {
                    // 如果是图片或视频直链，不处理，交由媒体渲染处理
                    if (url.match(/\.(jpeg|jpg|gif|png|mp4|webm)$/i)) return url;

                    return this.createCardHtml(url);
                });
            }

            static createCardHtml(url) {
                let icon = 'fa-link';
                let sourceClass = '';
                let sourceName = '外部链接';

                if (url.includes('pan.quark.cn')) { icon = 'fa-cloud'; sourceName = '夸克网盘'; sourceClass = 'source-quark'; }
                else if (url.includes('baidu.com')) { icon = 'fa-paw'; sourceName = '百度网盘'; sourceClass = 'source-baidu'; }
                else if (url.includes('lanzou')) { icon = 'fa-cloud-arrow-up'; sourceName = '蓝奏云'; sourceClass = 'source-lanzou'; }
                else if (url.includes('douyin.com')) { icon = 'fa-video'; sourceName = '抖音'; sourceClass = 'source-douyin'; }
                else if (url.includes('y.qq.com')) { icon = 'fa-music'; sourceName = 'QQ音乐'; sourceClass = 'source-quark'; } // 借用绿色

                // 检测是否为本站分享链接
                if (url.includes('hillmis.cn') || url.includes('?share_type=')) {
                    sourceName = '抖咻咻认证';
                    sourceClass = 'source-douyin';
                    icon = 'fa-circle-check';
                }

                return `<div class="link-card-wrapper" onclick="window.open('${url}', '_blank')">
            <div class="link-card-icon ${sourceClass}"><i class="fa-solid ${icon}"></i></div>
            <div class="link-card-info">
                <div class="link-card-title">${url}</div>
                <div class="link-card-source">${sourceName}</div>
            </div>
            <i class="fa-solid fa-angle-right" style="color:#666"></i>
        </div>`;
            }
        }
        /* --- 修复版 CircleManager (完整逻辑 + Api模块对接) --- */

/* ---- app/features/circle/30-circle-manager.js ---- */
/* v7: CircleManager completed - comments, likes, profile tabs, safer post rendering */
        class CircleManager {
            constructor() {
                this.container = document.getElementById('circle-feed-container');
                this.page = 1;
                this.isLoading = false;
                this.isPosting = false;
                this.currentCircleId = 0;
                this.currentTab = 'all';
                this.rewardTargetPostId = 0;
                this.rewardAmount = 0;
                this.activeCircleInfo = null;
                this.allCircles = [];
                this.currentProfileUserId = 0;
                this.currentCommentPostId = 0;
                this.commentsPage = 1;
                this.currentFiles = [];
            }

            init() {
                this.updateHeader();
                this.renderCategories();
                this.loadFeed(true);
            }

            getUserId() {
                return app?.accountManager?.user?.id || 0;
            }

            getUploadUrl(path) {
                if (!path) return '';
                const raw = String(path);
                if (/^https?:\/\//i.test(raw) || raw.startsWith('data:image/')) return raw;
                const base = String(window.API_BASE || Api.config.BASE_URL || '').replace(/\/+$/, '');
                const clean = raw.replace(/^\/+/, '').replace(/^uploads\//, '');
                return `${base}/uploads/${clean}`;
            }

            parseMediaList(value) {
                if (!value) return [];
                if (Array.isArray(value)) return value.filter(Boolean);
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
                } catch (e) {
                    return String(value).split(',').map(v => v.trim()).filter(Boolean);
                }
            }

            formatPostContent(text) {
                const safe = escapeHTML(text || '');
                return safe.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
                    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="post-link-styled" onclick="event.stopPropagation();"><i class="fa-solid fa-link"></i>网页链接</a>`;
                });
            }

            async renderCategories() {
                const heroContainer = document.getElementById('circle-hero-container');
                const iconContainer = document.getElementById('circles-icon-grid');
                const res = await Api.Circle.getCircles();
                const circles = (res.code === 200 && res.data) ? res.data : [];
                this.allCircles = circles;

                if (heroContainer) {
                    const heroes = circles.slice(0, 3);
                    heroContainer.innerHTML = heroes.map((c, index) => `
                        <div class="hero-card ${index === 0 ? 'large' : ''}" onclick="app.circleManager.openSpecificCircle(${Number(c.id) || 0})">
                            <img src="${escapeAttr(c.bg_image || 'https://via.placeholder.com/600')}" style="width:100%;height:100%;object-fit:cover;">
                            <div class="hero-overlay">
                                <div style="font-size:${index === 0 ? '18px' : '15px'}; font-weight:bold; color:white;">${escapeHTML(c.name)}</div>
                                <div style="font-size:11px; color:rgba(255,255,255,0.8);">${escapeHTML(c.description || '')}</div>
                            </div>
                        </div>
                    `).join('');
                }

                if (iconContainer) {
                    const icons = circles.slice(3);
                    let iconHtml = icons.map(c => `
                        <div class="icon-item" onclick="app.circleManager.openSpecificCircle(${Number(c.id) || 0})">
                            <div class="icon-circle">
                                <i class="fa-solid ${escapeAttr(c.icon || 'fa-hashtag')}" style="color:${escapeAttr(c.color || '#fff')}"></i>
                            </div>
                            <span style="font-size:12px; color:#94a3b8;">${escapeHTML(c.name)}</span>
                        </div>
                    `).join('');
                    iconHtml += `
                        <div class="icon-item" onclick="app.circleManager.openCreateCircleModal()">
                            <div class="icon-circle" style="border:1px dashed #666; background:transparent;">
                                <i class="fa-solid fa-plus" style="color:#999"></i>
                            </div>
                            <span style="font-size:12px; color:#94a3b8;">创建</span>
                        </div>`;
                    iconContainer.innerHTML = iconHtml;
                }

                this.updatePostCircleSelect(circles);
            }

            updatePostCircleSelect(circles) {
                const select = document.getElementById('post-circle-select');
                if (select) {
                    select.innerHTML = circles.map(c => `<option value="${Number(c.id) || 0}">${escapeHTML(c.name)}</option>`).join('');
                }
            }

            updateHeader() {
                if (app.accountManager) app.accountManager.updateAllUI();
            }

            switchTab(tab, btn) {
                this.currentTab = tab || 'all';
                const bar = document.getElementById('circle-tab-bar');
                if (bar) bar.querySelectorAll('.circle-tab-item').forEach(el => el.classList.remove('active'));
                if (btn) btn.classList.add('active');
                this.loadFeed(true);
            }

            async openSpecificCircle(id) {
                if (!id) return;
                this.currentCircleId = id;
                app.pageManager.pushState('circle-detail');
                const detailPage = document.getElementById('circle-detail-page');
                if (detailPage) detailPage.classList.add('active');

                const res = await Api.Circle.getCircleInfo(id, this.getUserId());
                if (res.code === 200) {
                    this.activeCircleInfo = res.data;
                    this.renderCircleHeader(res.data);
                } else {
                    app.interaction.showToast(res.msg || '圈子加载失败');
                }
                this.loadDetailFeed(id, true);
            }

            renderCircleHeader(info) {
                const bg = document.getElementById('cd-bg');
                if (!bg) return;
                const bgImage = info.bg_image && String(info.bg_image).startsWith('http')
                    ? `url(${info.bg_image})`
                    : `linear-gradient(45deg, ${info.color || '#333'}, #1a1a1a)`;
                bg.style.backgroundImage = `linear-gradient(to top, #121212 0%, rgba(18,18,18,0.6) 80%), ${bgImage}`;
                bg.innerHTML = `
                    <div class="common-header" style="background:transparent;">
                        <div class="header-back" onclick="app.pageManager.closePage('circle-detail-page')"><i class="fa-solid fa-arrow-left"></i></div>
                        <div class="header-right">
                            ${info.is_owner ? `<div style="height:28px; font-size:20px; padding:0 12px;" onclick="app.circleManager.openManagePage()"><i class="fa-solid fa-gear"></i></div>` : ''}
                        </div>
                    </div>
                    <div style="position:absolute; bottom:0; left:0; width:100%; padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                            <div style="flex:1; padding-right:15px;">
                                <div style="font-size:24px; font-weight:bold; text-shadow:0 2px 4px rgba(0,0,0,0.5); line-height:1.2;">${escapeHTML(info.name)}</div>
                                <div style="font-size:12px; color:#ddd; margin-top:5px; text-shadow:0 1px 2px rgba(0,0,0,0.5); line-height:1.4;">${escapeHTML(info.description || '')}</div>
                                <div style="font-size:11px; color:#aaa; margin-top:8px; display:flex; align-items:center; gap:10px;">
                                    <span><i class="fa-solid fa-user-tag"></i> ${escapeHTML(info.owner_name || '圈主')}</span>
                                    <span><i class="fa-solid fa-users"></i> ${Number(info.member_count) || 0}</span>
                                </div>
                            </div>
                            <div>
                                <div class="glass-pill ${info.is_member ? '' : 'active'}"
                                     style="height:32px; padding:0 20px; font-weight:bold; white-space:nowrap;"
                                     onclick="app.circleManager.toggleJoin(${Number(info.id) || 0}, ${Number(info.is_member) || 0})">
                                     ${info.is_member ? '已加入' : '+ 加入'}
                                </div>
                            </div>
                        </div>
                        <div style="margin-top:15px; position:relative;">
                            <input type="text" id="circle-search-input" placeholder="搜索帖子..."
                                   style="width:100%; background:rgba(255,255,255,0.1); border:none; border-radius:18px; padding:8px 35px 8px 15px; color:#fff; font-size:13px;"
                                   onkeydown="if(event.key==='Enter') app.circleManager.searchCirclePosts(this.value)">
                            <i class="fa-solid fa-magnifying-glass" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#aaa;"></i>
                        </div>
                    </div>`;
            }

            async toggleJoin(circleId, isMember) {
                if (!this.getUserId()) return app.interaction.showToast('请先登录');
                const type = isMember ? 'quit' : 'join';
                if (type === 'quit' && !confirm('确定退出该圈子吗？')) return;
                const res = await Api.Circle.joinToggle(circleId, this.getUserId(), type);
                app.interaction.showToast(res.msg || (res.code === 200 ? '操作成功' : '操作失败'));
                if (res.code === 200) this.openSpecificCircle(circleId);
            }

            searchCirclePosts(keyword) { this.loadDetailFeed(this.currentCircleId, true, keyword); }

            async loadDetailFeed(circleId, reset = false, keyword = '') {
                const container = document.getElementById('cd-post-list');
                if (!container) return;
                if (reset) container.innerHTML = '';
                const res = await Api.Circle.getPostList({ circle_id: circleId, page: 1, keyword, user_id: this.getUserId() });
                if (res.code === 200 && res.data?.length > 0) this.renderPosts(res.data, container);
                else container.innerHTML = '<div style="text-align:center;padding:50px;color:#666;">暂无相关内容</div>';
            }

            async loadFeed(reset = false) {
                if (this.isLoading) return;
                this.isLoading = true;
                if (reset) {
                    this.page = 1;
                    if (this.container) this.container.innerHTML = '';
                }
                const res = await Api.Circle.getPostList({ page: this.page, circle_id: 0, tab: this.currentTab, user_id: this.getUserId() });
                if (res.code === 200) {
                    if (res.data?.length > 0) {
                        this.renderPosts(res.data);
                        this.page++;
                    } else if (reset && this.container) {
                        this.container.innerHTML = '<div style="text-align:center;padding:40px 0;color:#666;">暂无动态</div>';
                    }
                }
                this.isLoading = false;
            }

            renderPosts(posts, targetContainer = null) {
                const container = targetContainer || this.container;
                if (!container) return;
                let html = '';
                posts.forEach(post => {
                    const postId = Number(post.id) || 0;
                    const authorId = Number(post.user_id) || 0;
                    const usernameRaw = post.username || '用户';
                    const username = escapeHTML(usernameRaw);
                    let pAvatar = post.avatar;
                    if (!pAvatar || pAvatar === 'null') pAvatar = getDiceBearAvatar(usernameRaw);
                    const defaultAvatar = getDiceBearAvatar(usernameRaw);

                    const mediaList = this.parseMediaList(post.media_urls);
                    let mediaHtml = '';
                    if (mediaList.length > 0) {
                        const imgs = mediaList.slice(0, 3).map(url => {
                            const fullUrl = this.getUploadUrl(url);
                            return `<div style="aspect-ratio:1; overflow:hidden; border-radius:6px; background:#222;">
                                <img src="${escapeAttr(fullUrl)}" style="width:100%; height:100%; object-fit:cover;" onclick="event.stopPropagation(); app.interaction.previewImage(${jsStringArg(fullUrl)})">
                            </div>`;
                        }).join('');
                        if (mediaList.length === 1) {
                            const fullUrl = this.getUploadUrl(mediaList[0]);
                            mediaHtml = `<div style="margin-top:10px; border-radius:8px; overflow:hidden; max-width:70%;">
                                    <img src="${escapeAttr(fullUrl)}" style="width:100%; object-fit:cover;" onclick="event.stopPropagation(); app.interaction.previewImage(${jsStringArg(fullUrl)})">
                                  </div>`;
                        } else {
                            mediaHtml = `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:5px; margin-top:10px;">${imgs}</div>`;
                        }
                    }

                    let circleName = '';
                    if (this.allCircles.length > 0) {
                        const found = this.allCircles.find(c => c.id == post.circle_id);
                        if (found) circleName = `<span class="post-circle-tag" onclick="event.stopPropagation(); app.circleManager.openSpecificCircle(${Number(post.circle_id) || 0})">${escapeHTML(found.name)}</span>`;
                    }

                    const formattedContent = this.formatPostContent(post.content);
                    const rewardBtn = `<div class="action-btn" onclick="app.circleManager.rewardPost(${postId}, ${authorId})" style="color:#fbbf24;"><i class="fa-solid fa-coins"></i> <span>打赏</span></div>`;
                    let deleteBtn = '';
                    const isOwner = this.activeCircleInfo && this.activeCircleInfo.is_owner && app.accountManager.user;
                    const isAuthor = this.getUserId() && String(this.getUserId()) === String(authorId);
                    if (isOwner || isAuthor) {
                        deleteBtn = `<i class="fa-solid fa-trash" style="color:#ff4d4f; margin-left:auto; padding:5px; cursor:pointer;" onclick="event.stopPropagation(); app.circleManager.deletePost(${postId})" title="删除"></i>`;
                    }

                    html += `
                        <div class="circle-post-card" data-post-id="${postId}" style="padding:15px; margin-bottom:10px; background:rgba(255,255,255,0.03); border-radius:12px;">
                            <div class="post-header" style="display:flex; align-items:center; margin-bottom:10px;">
                                <img src="${escapeAttr(pAvatar)}" class="post-avatar"
                                     onclick="event.stopPropagation(); app.circleManager.openUserProfile(${authorId})"
                                     onerror="this.src='${escapeAttr(defaultAvatar)}'"
                                     style="width:36px; height:36px; border-radius:50%; margin-right:10px; cursor:pointer;">
                                <div style="flex:1;">
                                    <div style="font-size:14px; font-weight:600; color:#fff;">${username}</div>
                                    <div style="font-size:11px; color:#888;">${app.chat.formatTime(new Date(post.created_at).getTime() / 1000)} · ${circleName}</div>
                                </div>
                                ${deleteBtn}
                            </div>
                            ${post.title ? `<div style="font-size:16px; font-weight:bold; color:#fff; margin-bottom:6px; line-height:1.4;">${escapeHTML(post.title)}</div>` : ''}
                            <div class="post-content" style="font-size:14px; color:rgba(255,255,255,0.85); line-height:1.6; white-space: pre-wrap;">${formattedContent}</div>
                            ${mediaHtml}
                            <div class="post-actions" style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.05);">
                                <div class="action-btn post-like-btn" onclick="app.circleManager.toggleLike(${postId}, this)" style="display:flex; align-items:center; gap:5px; color:${post.is_liked > 0 ? '#ff4d4f' : '#888'};">
                                    <i class="${post.is_liked > 0 ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                                    <span>${Number(post.like_count) || 0}</span>
                                </div>
                                <div class="action-btn post-comment-btn" onclick="app.circleManager.openComments(${postId})" style="display:flex; align-items:center; gap:5px; color:#888;">
                                    <i class="fa-regular fa-comment"></i>
                                    <span>${Number(post.comment_count) || 0}</span>
                                </div>
                                ${rewardBtn}
                            </div>
                        </div>`;
                });
                container.insertAdjacentHTML('beforeend', html);
            }

            openManagePage() {
                if (!this.activeCircleInfo) return;
                const c = this.activeCircleInfo;
                app.pageManager.pushState('circle-manage');
                document.getElementById('circle-manage-page').classList.add('active');
                document.getElementById('manage-circle-name').value = c.name || '';
                document.getElementById('manage-circle-desc').value = c.description || '';
                document.getElementById('manage-circle-bg').value = c.bg_image || '';
            }

            async updateCircleInfo() {
                const name = document.getElementById('manage-circle-name').value.trim();
                const desc = document.getElementById('manage-circle-desc').value;
                const bg = document.getElementById('manage-circle-bg').value;
                if (!name) return app.interaction.showToast('圈子名称不能为空');
                if (name.length > 5) return app.interaction.showToast('圈子名称不能超过5个字');
                const res = await Api.Circle.manageCircle({ sub_action: 'update', user_id: this.getUserId(), circle_id: this.currentCircleId, name, desc, bg_image: bg });
                if (res.code === 200) {
                    app.interaction.showToast('更新成功');
                    app.pageManager.closePage('circle-manage-page');
                    this.openSpecificCircle(this.currentCircleId);
                    this.renderCategories();
                } else app.interaction.showToast(res.msg || '更新失败');
            }

            async disbandCircle() {
                if (!confirm('【高危】确定要解散圈子吗？所有帖子将被删除且不可恢复！')) return;
                const input = prompt('请输入圈子名称以确认解散：');
                if (input !== this.activeCircleInfo.name) return app.interaction.showToast('名称不匹配');
                const res = await Api.Circle.manageCircle({ sub_action: 'delete_circle', user_id: this.getUserId(), circle_id: this.currentCircleId });
                if (res.code === 200) {
                    app.interaction.showToast('圈子已解散');
                    app.pageManager.backToHome?.();
                    this.renderCategories();
                    this.loadFeed(true);
                } else app.interaction.showToast(res.msg || '解散失败');
            }

            async deletePost(postId) {
                if (!confirm('确定删除此贴？')) return;
                const res = await Api.Circle.manageCircle({ sub_action: 'delete_post', user_id: this.getUserId(), circle_id: this.currentCircleId, post_id: postId });
                if (res.code === 200) {
                    app.interaction.showToast('已删除');
                    document.querySelectorAll(`.circle-post-card[data-post-id="${postId}"]`).forEach(el => el.remove());
                } else app.interaction.showToast(res.msg || '删除失败');
            }

            rewardPost(postId, authorId) {
                if (!this.getUserId()) return app.interaction.showToast('请先登录');
                if (this.getUserId() == authorId) return app.interaction.showToast('不能打赏给自己');
                this.rewardTargetPostId = postId;
                this.rewardAmount = 0;
                document.getElementById('reward-mask').classList.add('active');
                document.getElementById('reward-modal').style.display = 'block';
                setTimeout(() => document.getElementById('reward-modal').classList.add('active'), 10);
                this.clearRewardSelection();
            }

            selectReward(amount, el) {
                this.rewardAmount = amount;
                document.getElementById('reward-custom-input').value = '';
                document.querySelectorAll('.reward-item').forEach(opt => opt.classList.remove('active'));
                el.classList.add('active');
            }
            clearRewardSelection() { document.querySelectorAll('.reward-item').forEach(opt => opt.classList.remove('active')); this.rewardAmount = 0; }
            closeRewardModal() {
                const modal = document.getElementById('reward-modal');
                const mask = document.getElementById('reward-mask');
                modal.classList.remove('active'); mask.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
            async confirmReward() {
                const customVal = document.getElementById('reward-custom-input').value;
                if (customVal && parseInt(customVal) > 0) this.rewardAmount = parseInt(customVal);
                if (this.rewardAmount <= 0) return app.interaction.showToast('请选择金额');
                const currentCoins = parseInt(app.accountManager.user.coins) || 0;
                if (currentCoins < this.rewardAmount) return app.interaction.showToast('余额不足，请充值');
                const res = await Api.Circle.rewardPost(this.getUserId(), this.rewardTargetPostId, this.rewardAmount);
                if (res.code === 200) {
                    app.interaction.showToast(`打赏成功 -${this.rewardAmount}币`);
                    let finalBalance = currentCoins - this.rewardAmount;
                    if (res.new_balance !== undefined && res.new_balance !== null) finalBalance = parseInt(res.new_balance);
                    else if (res.data?.new_balance !== undefined) finalBalance = parseInt(res.data.new_balance);
                    app.accountManager.user.coins = Math.max(0, finalBalance);
                    app.accountManager.saveLocal();
                    this.closeRewardModal();
                } else app.interaction.showToast(res.msg || '打赏失败');
            }

            openCreateCircleModal() {
                if (!this.getUserId()) return app.interaction.showToast('请先登录');
                const modal = document.getElementById('create-circle-modal');
                const mask = document.getElementById('create-circle-mask');
                if (!modal || !mask) return;
                mask.classList.add('active'); modal.style.display = 'block';
                setTimeout(() => modal.classList.add('active'), 10);
            }
            closeCreateCircleModal() {
                const modal = document.getElementById('create-circle-modal');
                const mask = document.getElementById('create-circle-mask');
                if (!modal || !mask) return;
                modal.classList.remove('active'); mask.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
            async submitCreateCircle() {
                const name = document.getElementById('new-circle-name').value.trim();
                const desc = document.getElementById('new-circle-desc').value.trim();
                if (!name) return app.interaction.showToast('请输入圈子名称');
                if (name.length > 5) return app.interaction.showToast('圈子名称不能超过5个字');
                const res = await Api.Circle.createCircle(this.getUserId(), name, desc);
                if (res.code === 200) {
                    app.interaction.showToast('创建成功');
                    this.closeCreateCircleModal();
                    this.renderCategories();
                    this.loadFeed(true);
                } else app.interaction.showToast(res.msg || '创建失败');
            }

            openPostModal() {
                if (!this.getUserId()) return app.interaction.showToast('请先登录');
                const select = document.getElementById('post-circle-select');
                if (select) {
                    select.innerHTML = '';
                    if (this.allCircles.length > 0) select.innerHTML = this.allCircles.map(c => `<option value="${Number(c.id) || 0}">${escapeHTML(c.name)}</option>`).join('');
                    else this.renderCategories();
                    if (this.currentCircleId > 0) select.value = this.currentCircleId;
                }
                app.pageManager.pushState('post-create');
                const page = document.getElementById('post-create-page');
                if (page) page.classList.add('active');
                this.currentFiles = [];
                this.renderMediaPreview();
            }
            addMediaInput() {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
                input.onchange = (e) => { this.currentFiles = [...this.currentFiles, ...Array.from(e.target.files)]; this.renderMediaPreview(); };
                input.click();
            }
            renderMediaPreview() {
                const list = document.getElementById('post-media-list');
                if (!list) return;
                const addBtn = `<div class="glass-btn-square" style="width:60px; height:60px;" onclick="app.circleManager.addMediaInput()"><i class="fa-solid fa-plus"></i></div><span style="font-size:12px; color:#888; margin-left:10px;">点击添加图片</span>`;
                const filesHtml = this.currentFiles.map((file, i) => `
                    <div class="preview-thumb" style="width:60px; height:60px; position:relative; border-radius:8px; overflow:hidden; background:#333; margin-right:10px; margin-bottom:10px;">
                        <img src="${escapeAttr(URL.createObjectURL(file))}" style="width:100%; height:100%; object-fit:cover;">
                        <div style="position:absolute; top:0; right:0; background:rgba(0,0,0,0.5); color:#fff; width:20px; text-align:center; cursor:pointer;" onclick="app.circleManager.removeFile(${i})">×</div>
                    </div>`).join('');
                list.innerHTML = `<div style="display:flex; flex-wrap:wrap; align-items:center;">${filesHtml}</div><div style="display:flex; align-items:center; margin-top:10px;">${addBtn}</div>`;
            }
            removeFile(index) { this.currentFiles.splice(index, 1); this.renderMediaPreview(); }
            async submitPost() {
                if (this.isPosting) return;
                const titleInput = document.getElementById('post-title-input');
                const contentInput = document.getElementById('post-content-input');
                const circleSelect = document.getElementById('post-circle-select');
                const content = contentInput.value.trim();
                if (!content) return app.interaction.showToast('内容不能为空');
                this.isPosting = true;
                app.interaction.showToast('正在发布...');
                const formData = new FormData();
                formData.append('action', 'create_post');
                formData.append('user_id', this.getUserId());
                formData.append('title', titleInput.value);
                formData.append('content', content);
                formData.append('circle_id', circleSelect ? circleSelect.value : 1);
                if (this.currentFiles) this.currentFiles.forEach(file => formData.append('media[]', file));
                try {
                    const res = await Api.Circle.createPost(formData);
                    if (res.code === 200) {
                        app.interaction.showToast('发布成功');
                        app.pageManager.closePage('post-create-page');
                        titleInput.value = ''; contentInput.value = '';
                        this.currentFiles = []; this.renderMediaPreview();
                        this.loadFeed(true);
                        if (app.accountManager.user) {
                            app.accountManager.user.coins = (parseInt(app.accountManager.user.coins) || 0) + 20;
                            app.accountManager.saveLocal();
                        }
                    } else app.interaction.showToast(res.msg || '发布失败');
                } catch (e) {
                    console.error(e); app.interaction.showToast('网络错误');
                } finally { this.isPosting = false; }
            }

            async openUserProfile(targetUserId) {
                if (!targetUserId) return;
                app.pageManager.pushState('circle-user-profile');
                document.getElementById('circle-user-profile-page').classList.add('active');
                document.getElementById('cup-name').innerText = '加载中...';
                document.getElementById('cup-content-list').innerHTML = '<div style="padding:20px;text-align:center;color:#666;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
                const currentUser = app.accountManager.user;
                const isSelf = currentUser && String(currentUser.id) === String(targetUserId);
                this.currentProfileUserId = targetUserId;
                document.getElementById('cup-edit-btn').style.display = isSelf ? 'block' : 'none';
                document.getElementById('cup-tab-coins').style.display = isSelf ? 'block' : 'none';
                try {
                    const res = await Api.Auth.getUserProfile(targetUserId, currentUser ? currentUser.id : 0);
                    if (res.code === 200) {
                        this.renderUserProfileHeader(res.data);
                        const firstTab = document.querySelector('#circle-user-profile-page .view-btn');
                        this.switchUserTab('posts', firstTab);
                    } else app.interaction.showToast(res.msg || '获取用户信息失败');
                } catch (e) { console.error(e); app.interaction.showToast('网络错误'); }
            }
            renderUserProfileHeader(data) {
                const avatar = data.avatar && data.avatar !== 'null' ? data.avatar : getDiceBearAvatar(data.username);
                document.getElementById('cup-avatar').src = avatar;
                document.getElementById('cup-bg').src = avatar;
                document.getElementById('cup-name').innerText = data.username || '用户';
                document.getElementById('cup-sign').innerText = data.signature || '这个人很懒，什么都没写';
                document.getElementById('cup-stat-posts').innerText = data.post_count || 0;
                document.getElementById('cup-stat-circles').innerText = data.circle_count || 0;
                document.getElementById('cup-stat-coins').innerText = data.coins || 0;
                let tagsHtml = '';
                if (data.role == 1) tagsHtml += '<span class="cup-role-badge" style="color:#5cc9ff; border:1px solid #5cc9ff;">管理员</span>';
                if (data.role == 2) tagsHtml += '<span class="cup-role-badge" style="color:#b388eb; border:1px solid #b388eb;">超级管理员</span>';
                if (data.vip_expire > Date.now() / 1000) tagsHtml += '<span class="cup-role-badge" style="color:#ffd700; border:1px solid #ffd700;">VIP</span>';
                document.getElementById('cup-role-tags').innerHTML = tagsHtml;
            }
            async switchUserTab(tab, btn) {
                const parent = btn?.parentElement;
                if (parent) parent.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                if (btn) btn.classList.add('active');
                const container = document.getElementById('cup-content-list');
                container.innerHTML = '<div style="padding:40px;text-align:center;color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 加载中...</div>';
                const userId = this.currentProfileUserId;
                const currentId = this.getUserId();
                if (tab === 'posts') {
                    const res = await Api.Circle.getUserPosts(userId, currentId);
                    if (res.code === 200 && res.data?.length > 0) { container.innerHTML = ''; this.renderPosts(res.data, container); }
                    else container.innerHTML = this.getEmptyHtml('暂无动态');
                } else if (tab === 'circles') {
                    const res = await Api.Circle.getUserCircles(userId);
                    if (res.code === 200 && ((res.data.created || []).length > 0 || (res.data.joined || []).length > 0)) this.renderUserCircles(res.data, container);
                    else container.innerHTML = this.getEmptyHtml('暂无加入的圈子');
                } else if (tab === 'likes') {
                    const res = await Api.Circle.getUserLikes(userId, currentId);
                    if (res.code === 200 && res.data?.length > 0) { container.innerHTML = ''; this.renderPosts(res.data, container); }
                    else container.innerHTML = this.getEmptyHtml('暂无喜欢的帖子');
                } else if (tab === 'coins') {
                    const res = await Api.Circle.getCoinHistory(userId);
                    if (res.code === 200 && res.data?.length > 0) this.renderCoinHistory(res.data, container);
                    else container.innerHTML = this.getEmptyHtml('暂无硬币记录');
                }
            }
            renderUserCircles(data, container) {
                let html = '';
                if (data.created?.length > 0) {
                    html += `<div style="padding:10px 15px; font-size:12px; color:#888;">创建的圈子</div>`;
                    html += data.created.map(c => `<div class="cup-circle-item" onclick="app.circleManager.openSpecificCircle(${Number(c.id) || 0})"><div class="cup-circle-icon"><i class="fa-solid ${escapeAttr(c.icon || 'fa-hashtag')}"></i></div><div style="flex:1;"><div style="font-size:15px; font-weight:bold; color:#fff;">${escapeHTML(c.name)}</div><div style="font-size:11px; color:#aaa;">${escapeHTML(c.description || '暂无简介')}</div></div><div style="font-size:12px; color:#5cc9ff;">圈主</div></div>`).join('');
                }
                if (data.joined?.length > 0) {
                    html += `<div style="padding:15px 15px 5px; font-size:12px; color:#888;">加入的圈子</div>`;
                    html += data.joined.map(c => `<div class="cup-circle-item" onclick="app.circleManager.openSpecificCircle(${Number(c.id) || 0})"><div class="cup-circle-icon"><i class="fa-solid ${escapeAttr(c.icon || 'fa-hashtag')}"></i></div><div style="flex:1;"><div style="font-size:15px; font-weight:bold; color:#fff;">${escapeHTML(c.name)}</div><div style="font-size:11px; color:#aaa;">${Number(c.member_count) || 0} 成员</div></div><i class="fa-solid fa-angle-right" style="color:#666;"></i></div>`).join('');
                }
                container.innerHTML = html;
            }
            renderCoinHistory(list, container) {
                const html = list.map(item => {
                    const isPlus = parseInt(item.amount) > 0;
                    const sign = isPlus ? '+' : '';
                    const className = isPlus ? 'plus' : 'minus';
                    const desc = item.description || (isPlus ? '收入' : '支出');
                    return `<div class="cup-coin-item"><div class="cup-coin-info"><div>${escapeHTML(desc)}</div><div>${app.chat.formatTime(new Date(item.created_at).getTime() / 1000)}</div></div><div class="cup-coin-amount ${className}">${sign}${Number(item.amount) || 0}</div></div>`;
                }).join('');
                container.innerHTML = html;
            }
            getEmptyHtml(text) { return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:#666;"><i class="fa-regular fa-folder-open" style="font-size:40px;margin-bottom:10px;"></i><div>${escapeHTML(text)}</div></div>`; }

            async toggleLike(postId, btn) {
                if (!this.getUserId()) return app.interaction.showToast('请先登录');
                const res = await Api.Circle.toggleLike(postId, this.getUserId());
                if (res.code === 200) {
                    const icon = btn.querySelector('i');
                    const span = btn.querySelector('span');
                    let count = parseInt(span.innerText) || 0;
                    const liked = res.status === 'liked' || res.data?.status === 'liked';
                    icon.className = liked ? 'fa-solid fa-heart fa-bounce' : 'fa-regular fa-heart';
                    btn.style.color = liked ? '#ff4d4f' : '#888';
                    span.innerText = liked ? count + 1 : Math.max(0, count - 1);
                } else app.interaction.showToast(res.msg || '操作失败');
            }

            openComments(postId) {
                this.currentCommentPostId = postId;
                this.commentsPage = 1;
                app.pageManager.pushState('circle-comments');
                const page = document.getElementById('circle-comments-page');
                if (page) page.classList.add('active');
                const list = document.getElementById('circle-comment-list');
                if (list) list.innerHTML = '<div style="padding:40px;text-align:center;color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 加载中...</div>';
                const input = document.getElementById('circle-comment-input');
                if (input) input.value = '';
                this.loadComments(true);
            }
            closeComments() { app.pageManager.closePage('circle-comments-page'); }
            async loadComments(reset = false) {
                const list = document.getElementById('circle-comment-list');
                if (!list) return;
                if (reset) list.innerHTML = '';
                const res = await Api.Circle.getComments(this.currentCommentPostId, this.commentsPage);
                if (res.code === 200 && res.data?.length > 0) {
                    if (reset) list.innerHTML = '';
                    this.renderComments(res.data, list);
                    this.commentsPage++;
                } else if (reset) {
                    list.innerHTML = this.getEmptyHtml('暂无评论，来抢沙发吧');
                }
            }
            renderComments(comments, container) {
                const html = comments.map(c => {
                    const avatar = c.avatar && c.avatar !== 'null' ? c.avatar : getDiceBearAvatar(c.username || '用户');
                    const canDelete = this.getUserId() && (String(this.getUserId()) === String(c.user_id) || app.accountManager.user?.role > 0);
                    return `<div class="circle-comment-item" data-comment-id="${Number(c.id) || 0}"><img src="${escapeAttr(avatar)}" class="circle-comment-avatar" onclick="app.circleManager.openUserProfile(${Number(c.user_id) || 0})"><div class="circle-comment-main"><div class="circle-comment-head"><span>${escapeHTML(c.username || '用户')}</span><em>${app.chat.formatTime(new Date(c.created_at).getTime() / 1000)}</em>${canDelete ? `<i class="fa-solid fa-trash" onclick="app.circleManager.deleteComment(${Number(c.id) || 0})"></i>` : ''}</div><div class="circle-comment-text">${escapeHTML(c.content || '')}</div></div></div>`;
                }).join('');
                container.insertAdjacentHTML('beforeend', html);
            }
            async submitComment() {
                if (!this.getUserId()) return app.interaction.showToast('请先登录');
                const input = document.getElementById('circle-comment-input');
                const content = input.value.trim();
                if (!content) return app.interaction.showToast('评论不能为空');
                const res = await Api.Circle.addComment(this.currentCommentPostId, this.getUserId(), content);
                if (res.code === 200) {
                    input.value = '';
                    const list = document.getElementById('circle-comment-list');
                    if (list) list.innerHTML = '';
                    this.commentsPage = 1;
                    await this.loadComments(true);
                    this.updateCommentCount(this.currentCommentPostId, 1);
                } else app.interaction.showToast(res.msg || '评论失败');
            }
            async deleteComment(commentId) {
                if (!confirm('确定删除这条评论吗？')) return;
                const res = await Api.Circle.deleteComment(commentId, this.getUserId());
                if (res.code === 200) {
                    document.querySelector(`.circle-comment-item[data-comment-id="${commentId}"]`)?.remove();
                    this.updateCommentCount(this.currentCommentPostId, -1);
                } else app.interaction.showToast(res.msg || '删除失败');
            }
            updateCommentCount(postId, delta) {
                document.querySelectorAll(`.circle-post-card[data-post-id="${postId}"] .post-comment-btn span`).forEach(span => {
                    span.innerText = Math.max(0, (parseInt(span.innerText) || 0) + delta);
                });
            }
        }

        // ==========================================
        //  5. IncentiveManager (任务/积分 - 简单版)
        // ==========================================

/* ---- app/features/circle/31-incentive-manager.js ---- */
/* v3 semantic split: class from js/app/08-settings-search-circle-page.js | keep script order */
        class IncentiveManager {
            constructor() {
                this.tasks = [
                    { id: 1, title: "每日签到", reward: 10, done: false },
                    { id: 2, title: "发布一条动态", reward: 20, done: false }
                ];
            }

            openTaskModal() {
                app.pageManager.pushState('task-sheet');
                document.getElementById('task-sheet').classList.add('active');
                this.renderTasks();
            }

            renderTasks() {
                const container = document.getElementById('daily-task-list');
                const balanceEl = document.getElementById('task-coin-balance');

                // 更新余额显示
                if (app.accountManager.user) {
                    if (balanceEl) balanceEl.innerText = app.accountManager.user.coins || 0;
                }

                if (!container) return;

                container.innerHTML = this.tasks.map(t => `
                <div class="my-list-item">
                    <div class="item-info">
                        <div class="item-title">${t.title}</div>
                        <div class="item-sub" style="color:#fbbf24;">+${t.reward} 币</div>
                    </div>
                    <div class="glass-pill ${t.done ? '' : 'active'}" 
                         style="height:28px; font-size:12px;max-width:50px"
                         onclick="app.incentiveManager.doTask(${t.id})">
                         ${t.done ? '已领' : '领取'}
                    </div>
                </div>
            `).join('');
            }

            doTask(id) {
                const task = this.tasks.find(t => t.id === id);
                if (task && !task.done) {
                    if (!app.accountManager.user) return app.interaction.showToast('请先登录');

                    task.done = true;

                    // 模拟增加积分 (实际应调用后端接口)
                    // 这里直接修改本地内存中的 user 对象并保存，下一次同步会覆盖
                    // 理想做法是 apiFetch('circle_api.php', 'complete_task', {task_id: id})

                    app.accountManager.user.coins = (parseInt(app.accountManager.user.coins) || 0) + task.reward;
                    app.accountManager.saveLocal();

                    app.interaction.showToast(`领取成功 +${task.reward}币`);
                    this.renderTasks();
                    app.circleManager.updateHeader();
                }
            }

            buyQuota(type) {
                const cost = type === 'download' ? 10 : 20;
                const user = app.accountManager.user;

                if (!user) return app.interaction.showToast('请登录');
                if (user.coins < cost) return app.interaction.showToast('余额不足');

                if (confirm(`确定消耗 ${cost} 硬币兑换吗？`)) {
                    user.coins -= cost;
                    app.accountManager.saveLocal();

                    if (type === 'download') {
                        app.quotaManager.add(5);
                    } else {
                        app.interaction.showToast('功能开发中');
                    }
                    this.renderTasks();
                    app.circleManager.updateHeader();
                }
            }
        }

/* ---- app/pages/32-page-manager.js ---- */
/* v3 semantic split: class from js/app/08-settings-search-circle-page.js | keep script order */
        class PageManager {
            constructor() {
                // 1. 绑定全局遮罩点击事件
                this.mask = document.getElementById('global-mask');
                if (this.mask) {
                    // 点击遮罩等同于按下返回键
                    this.mask.onclick = () => history.back();
                }



                // 3. 初始化音乐页面的滑动手势（暂时关闭）
                //this.initMusicPageSwipe();

                // 4. 初始化 History API
                // 替换当前状态为 home，确保有“根”状态，防止直接退出
                try {
                    window.history.replaceState({ page: 'home' }, null, '');
                } catch (e) {
                    console.warn('History API restricted (Sandboxed?)');
                }

                // 5. 核心：监听系统返回事件 (浏览器后退/安卓物理返回)
                window.addEventListener('popstate', (e) => {
                    this.handleSystemBack(e);
                });

                this.bindPageClickGuard();
            }
            bindPageClickGuard() {
                const guardClick = (e) => {
                    if (!window.app) return;
                    const suppressMs = app.clickSuppressMs || 0;
                    const lastOpenAt = app.lastOpenAt || 0;
                    if (suppressMs > 0 && Date.now() - lastOpenAt < suppressMs) {
                        if (e.cancelable) e.preventDefault();
                        e.stopPropagation();
                    }
                };

                document.querySelectorAll('.page-layer, .comment-layer, .modal-sheet').forEach((layer) => {
                    layer.addEventListener('click', guardClick, true);
                });
            }
            refreshMyPageListIfActive(targetTab) {
                const myPage = document.getElementById('my-page');
                if (myPage && myPage.classList.contains('active')) {
                    const activeBtn = myPage.querySelector('.view-switch .view-btn.active');
                    if (activeBtn) {
                        const btnText = activeBtn.innerText.trim();
                        let currentTabKey = '';
                        if (btnText === '喜欢') currentTabKey = 'likes';
                        else if (btnText === '收藏') currentTabKey = 'favorites';
                        else if (btnText === '音乐') currentTabKey = 'music';

                        if (currentTabKey === targetTab) {
                            // 重新加载列表
                            this.switchMyTab(targetTab, activeBtn);
                        }
                    }
                }
            }

            openDownloadCenter() {

                // 1. 检查并打开“我的页面” (作为底层)
                const myPage = document.getElementById('my-page');
                if (!myPage.classList.contains('active')) {
                    this.pushState('my-page'); // 写入浏览器历史
                    myPage.classList.add('active');
                    // 顺便刷新一下我的页面数据，防止退回去时是空的
                    this.updateMyStats();
                    // 初始化我的页面 Tab
                    const myTabBtn = myPage.querySelector('.view-btn');
                    if (myTabBtn) this.switchMyTab('likes', myTabBtn);
                }

                // 2. 检查并打开“设置页面” (作为中间层)
                const settingsPage = document.getElementById('settings-page');
                if (!settingsPage.classList.contains('active')) {
                    this.pushState('settings'); // 写入浏览器历史
                    settingsPage.classList.add('active');
                    // 刷新设置状态
                    if (app.settingsManager) app.settingsManager.reflectToUI();
                }

                // 3. 最后打开“下载中心” (作为顶层)
                this.pushState('download-center'); // 写入浏览器历史
                const dlPage = document.getElementById('download-center-page');

                // 【关键】强制设置更高的 z-index，确保盖住设置页
                // 假设设置页 z-index 默认为 100-120 左右，这里设为 150 足够安全
                dlPage.style.zIndex = '150';
                dlPage.classList.add('active');

                // 4. 初始化下载页面的 Tab
                const firstTabBtn = dlPage.querySelector('.view-btn');
                if (firstTabBtn && app.downloadMgr) {
                    app.downloadMgr.switchTab('active', firstTabBtn);
                }
            }
            // === 新增：全屏切换功能 ===
            toggleLayerFullscreen(elementId, btn) {
                const el = document.getElementById(elementId);
                const icon = btn.querySelector('i');

                if (!el) return;

                // 切换类名
                el.classList.toggle('layer-fullscreen');
                const isFull = el.classList.contains('layer-fullscreen');

                // 切换图标
                if (isFull) {
                    icon.className = 'fa-solid fa-down-left-and-up-right-to-center'; // 收缩图标
                } else {
                    icon.className = 'fa-solid fa-up-right-and-down-left-from-center'; // 扩展图标
                }
            }
            /**
             * 辅助方法：向浏览器历史栈添加一条记录
             * 当打开新页面/弹窗时调用
             */
            pushState(id) {
                if (window.app && window.app.feedMode === 'recommend' && typeof window.app.pauseAllRecommendSingleVideos === 'function') {
                    window.app.pauseAllRecommendSingleVideos();
                }
                if (window.app && typeof app.safeOpenPage === 'function') {
                    app.safeOpenPage();
                }
                try {
                    window.history.pushState({ id: id }, null, '');
                } catch (e) { /* ignore */ }
            }

            /**
             * 核心逻辑：处理系统返回
             * 注意：此处只操作 DOM (remove active)，绝对不要调用 history.back()
             * 否则会造成死循环：popstate -> handle -> back -> popstate ...
             */
            handleSystemBack(e) {
                const tryClose = (selector) => {
                    const el = document.querySelector(selector);
                    if (el && el.classList.contains('active')) {
                        el.classList.remove('active');
                        setTimeout(() => {
                            el.classList.remove('layer-fullscreen');
                            const btnIcon = el.querySelector('.expand-toggle-btn i');
                            if (btnIcon) btnIcon.className = 'fa-solid fa-up-right-and-down-left-from-center';
                        }, 300);
                        return true;
                    }
                    return false;
                };

                if (tryClose('#work-settings-sheet')) {
                    const mask = document.getElementById('global-mask');
                    if (mask) mask.classList.remove('active');
                    return;
                }

                if (tryClose('#text-display-page')) return;
                if (tryClose('#download-sheet')) return;
                if (tryClose('#comment-layer')) return;
                if (tryClose('#fav-select-sheet')) return;
                if (tryClose('#fav-quick-panel')) {
                    const mask = document.getElementById('global-mask');
                    if (mask) mask.classList.remove('active');
                    return;
                }
                if (tryClose('#task-sheet')) return;

                const musicPage = document.getElementById('music-manage-page');
                if (musicPage && musicPage.classList.contains('active')) {
                    musicPage.classList.remove('active');

                    // 恢复视频模式
                    if (window.app.mediaManager) {
                        window.app.mediaManager.switchToVideoMode();
                        window.app.mediaManager.syncActiveProgressNow();
                    }

                    if (window.app.isMusicMode) {
                        window.app.isMusicMode = false;
                        history.back();
                    }
                    return;
                }

                const sidebar = document.getElementById('sidebar-page');
                if (sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    const mask = document.getElementById('global-mask');
                    if (mask) mask.classList.remove('active');
                    return;
                }

                const activePages = Array.from(document.querySelectorAll('.page-layer.active'));
                if (activePages.length > 0) {
                    const topPage = activePages[activePages.length - 1];
                    topPage.classList.remove('active');
                    return;
                }

                if (window.app.isContextMode) {
                    const prevPageId = window.app.returnPageId;
                    window.app.restoreHomeFeed(!prevPageId);
                    if (prevPageId) {
                        const prevPage = document.getElementById(prevPageId);
                        if (prevPage) {
                            prevPage.classList.add('active');
                            if (prevPageId === 'search-page' && window.app.searchManager) {
                                const input = document.getElementById('global-search-input');
                                if (input && input.value.trim()) {
                                    document.getElementById('search-result-view').style.display = 'flex';
                                    document.getElementById('search-default-view').style.display = 'none';
                                }
                            }
                        }
                    }
                    window.app.returnPageId = null;
                    return;
                }
            }
            // ================= Open 方法 (打开时 pushState) =================

            openMusicManage() {

                this.pushState('music');
                const currentIdx = app.mainSwiper.activeIndex;
                const data = app.fullPlaylist[currentIdx];
                const music = data.music_info || {};
                // 如果没有音乐信息，显示提示并尝试打开（显示为空状态）
                if (!music.url && !music.title) {
                    app.interaction.showToast('该作品暂无有效音乐信息');
                    // 可选择 return 不打开页面，或者继续打开显示空状态
                    // 这里选择继续打开，但在页面里按钮会失效
                }
                // 打开页面时，强制切换到“音乐模式” (视频静音，音频播放)
                if (app.mediaManager) {
                    app.mediaManager.switchToMusicMode();
                }
                // 1. 渲染基础结构
                // 这步生成 HTML，但里面的时间可能默认为 00:00
                app.renderer.renderMusicPage(music);
                if (app.mediaManager) app.mediaManager.refreshMusicPageRefs(true);

                // 2. 激活页面
                document.getElementById('music-manage-page').classList.add('active');

                // 3. 立即加载静态信息 (核心步骤)
                // 调用 refreshMusicInfo 从 data 中解析 JSON 预设时长 (如 "0分30秒")
                // 这能保证即使视频还没缓冲完，总时长也不显示 00:00
                this.refreshMusicInfo(data);
                if (app.mediaManager) {
                    app.mediaManager.refreshMusicPageRefs(true);
                    const media = app.mediaManager.currentMedia;
                    if (media && media.readyState >= 1 && media.duration) {
                        const pct = (media.currentTime / media.duration) * 100;
                        if (app.mediaManager._syncMusicPageUI) {
                            app.mediaManager._syncMusicPageUI(media.currentTime, pct);
                        }
                    }
                }

                // 4. 立即同步动态信息 (覆盖上一步的重置)
                // 如果当前已经在播放中，我们要立刻显示当前进度，而不是 0
                if (app.mediaManager && app.mediaManager.currentMedia) {
                    const media = app.mediaManager.currentMedia;

                    // 4.1 同步播放/暂停按钮
                    const isPlaying = !media.paused;
                    app.mediaManager.updatePlayBtnState(isPlaying);

                    // 4.2 同步进度条和时间
                    // 只有当媒体已加载元数据(readyState >= 1)时才读取，否则保持 JSON 预设
                    if (media.readyState >= 1) {
                        const curr = media.currentTime;
                        const dur = media.duration || 1; // 防止除以0
                        const pct = (curr / dur) * 100;

                        const musicSeekBar = document.getElementById('music-seek-bar');
                        const musicCurrTime = document.getElementById('music-curr-time');
                        const musicTotalTime = document.getElementById('music-total-time');

                        // 立即更新 DOM，消除延迟感
                        if (musicSeekBar) musicSeekBar.value = pct;
                        if (musicCurrTime) musicCurrTime.innerText = app.mediaManager.formatTime(curr);

                        // 如果获取到了真实的媒体文件时长，用它覆盖 JSON 里的预设文本
                        if (media.duration && !isNaN(media.duration) && musicTotalTime) {
                            musicTotalTime.innerText = app.mediaManager.formatTime(media.duration);
                        }
                    }
                }
                // [新增] 如果没有 URL，禁用下载和收藏按钮
                if (!music.url) {
                    const btnDl = document.getElementById('btn-music-download');
                    const btnFav = document.getElementById('btn-music-fav');
                    const btnCopy = document.getElementById('btn-music-copy-link');

                    if (btnDl) { btnDl.style.opacity = '0.5'; btnDl.onclick = () => app.interaction.showToast('无法下载：无音频源'); }
                    if (btnFav) { btnFav.style.opacity = '0.5'; btnFav.onclick = () => app.interaction.showToast('无法收藏：无音频源'); }
                    if (btnCopy) { btnCopy.style.opacity = '0.5'; btnCopy.onclick = () => app.interaction.showToast('无法复制：无音频源'); }
                }

            }
            openLogViewer() {
                this.pushState('log-viewer');
                document.getElementById('log-viewer-page').classList.add('active');
                // 打开时自动渲染
                if (app.logger) app.logger.renderLogs();
            }
            openSidebar() {
                this.pushState('sidebar');
                document.getElementById('sidebar-page').classList.add('active');
                if (this.mask) this.mask.classList.add('active');
            }

            openSidebarSafe() {
                if (window.app) {
                    const now = Date.now();
                    if (app.isSwiping || (now - (app.lastSwipeTime || 0) < 200)) return;
                }
                this.openSidebar();
            }

            openProfile() {
                this.pushState('profile');
                document.getElementById('profile-page').classList.add('active');
            }

            openAddCreator() {
                const targetCollection = (app.renderer && app.renderer.sidebarCollection && app.renderer.sidebarCollection !== 'all')
                    ? app.renderer.sidebarCollection
                    : '';
                app.pendingAddCollection = targetCollection;
                this.pushState('add-creator');
                document.getElementById('add-creator-page').classList.add('active');
            }

            openComments() {
                this.pushState('comments');
                const currentIdx = app.mainSwiper.activeIndex;
                const data = app.fullPlaylist[currentIdx];
                if (data) {
                    const descEl = document.getElementById('comment-desc');
                    const tagEl = document.getElementById('comment-tags');
                    if (descEl) descEl.innerText = data.title || '无描述';
                    if (tagEl) tagEl.innerText = data.type === '视频' ? '#视频 #分享' : '#图集 #美图';
                }
                document.getElementById('comment-layer').classList.add('active');

            }

            openDownload(idx) {
                this.pushState('download');
                // prepareDownload 内部负责渲染 DOM 并添加 .active
                if (app.prepareDownload) app.prepareDownload(idx);
            }

            openPage(title) {
                this.pushState('common');
                const titleEl = document.getElementById('common-page-title');
                if (titleEl) titleEl.textContent = title;
                document.getElementById('common-page').classList.add('active');
            }
            openSearch() {
                if (window.app && typeof app.safeOpenPage === 'function') {
                    app.safeOpenPage();
                }
                if (app.searchManager) {
                    app.searchManager.clearLocalScope();
                    app.searchManager.open();
                } else {
                    console.error("SearchManager not initialized");
                }
            }
            openSettings() {
                this.pushState('settings');
                // 同步设置数据到 UI
                if (app.settingsManager) app.settingsManager.reflectToUI();
                document.getElementById('settings-page').classList.add('active');
            }
            openApiSettings() {
                this.pushState('api-settings');
                if (app.settingsManager) app.settingsManager.reflectToUI();
                document.getElementById('api-settings-page').classList.add('active');
            }
            openApiCustom() {
                this.pushState('api-custom');
                document.getElementById('api-custom-page').classList.add('active');
            }
            // 在 PageManager 类中添加或替换
            openMyPage() {
                this.pushState('my-page');
                this.updateMyStats();

                // 【修复】精确选择 #my-page 下的第一个 view-btn，防止选中 Profile 页面的按钮
                const firstTabBtn = document.querySelector('#my-page .view-btn');
                this.switchMyTab('likes', firstTabBtn);

                document.getElementById('my-page').classList.add('active');
            }

            updateMyStats() {
                const ud = app.userDataManager;
                document.getElementById('stat-likes').innerText = ud.likes.length;
                // 收藏数改为统计所有文件夹内的总数
                document.getElementById('stat-favorites').innerText = ud.getTotalFavCount();
                document.getElementById('stat-music').innerText = ud.music.length;
            }
            // 核心修改：切换 Tab 逻辑 (修复版)
            async switchMyTab(tab, btn) {
                try {
                    // 1. 【UI 优先】立即更新按钮选中状态，让用户感觉到点击已生效
                    document.querySelectorAll('#my-page .view-btn').forEach(b => b.classList.remove('active'));
                    if (btn) btn.classList.add('active');

                    // 2. 获取容器
                    const containerLikes = document.getElementById('my-likes-grid');
                    const containerFavorites = document.getElementById('my-favorites-grid');
                    const containerMusic = document.getElementById('my-music-list');
                    const containerDl = document.getElementById('my-download-list');
                    const emptyTip = document.getElementById('my-empty-tip');

                    // 3. 先隐藏所有容器，并显示简单的加载状态（可选，防止闪烁）
                    if (containerLikes) containerLikes.style.display = 'none';
                    if (containerFavorites) containerFavorites.style.display = 'none';
                    if (containerMusic) containerMusic.style.display = 'none';
                    if (containerDl) containerDl.style.display = 'none';
                    if (emptyTip) emptyTip.style.display = 'none';

                    // 4. 【核心优化】使用 setTimeout 将繁重的渲染任务推迟到 UI 绘制之后
                    // 这允许浏览器先绘制 Tab 的切换动画，解决“点击无反应”的问题
                    await new Promise(resolve => setTimeout(resolve, 10));

                    const ud = app.userDataManager;
                    let isEmpty = false;

                    // --- 逻辑分支 (渲染逻辑) ---

                    if (tab === 'likes') {
                        // 喜欢列表
                        if (!ud.likes || ud.likes.length === 0) {
                            isEmpty = true;
                        } else {
                            if (containerLikes) {
                                containerLikes.style.display = 'grid';
                                // 使用 Fragment 或 innerHTML 渲染
                                this.renderWorksGrid(ud.likes, 'my-likes-grid', 'playFromMyLikes');
                            }
                        }
                    }
                    else if (tab === 'favorites') {
                        // 收藏夹列表
                        let folders = ud.favData;
                        if (!folders || !Array.isArray(folders)) folders = [];

                        if (containerFavorites) {
                            containerFavorites.style.display = 'block';

                            // 渲染“新建”按钮
                            const addBtnHtml = `
                                <div class="fav-folder-item" onclick="app.favManager.openCreateModal()" style="border-bottom: 10px solid rgba(255,255,255,0.02);">
                                    <div class="fav-icon-box" style="background: rgba(255,255,255,0.1); color: #fff;">
                                        <i class="fa-solid fa-plus"></i>
                                    </div>
                                    <div class="fav-info">
                                        <div class="fav-title">新建收藏夹</div>
                                    </div>
                                </div>`;

                            // 优化：避免在 map 中做过于复杂的 try-catch，提升性能
                            const folderListHtml = folders.map(f => {
                                if (!f) return '';
                                const folderName = f.name || '未命名文件夹';
                                const items = Array.isArray(f.items) ? f.items : [];
                                const count = items.length;

                                // 获取封面
                                let coverHtml = '<i class="fa-regular fa-folder-open"></i>';
                                if (count > 0 && items[0]) {
                                    const imgUrl = getWorkCover(items[0], items[0].author || 'Guest');
                                    if (imgUrl) coverHtml = `<img src="${escapeAttr(imgUrl)}" style="width:100%;height:100%;object-fit:cover;">`;
                                }

                                return `
                                    <div class="fav-folder-item" onclick="app.favManager.openFolderDetail('${f.id}')">
                                        <div class="fav-icon-box">${coverHtml}</div>
                                        <div class="fav-info">
                                            <div class="fav-title">${folderName}</div>
                                            <div class="fav-count">${count} 个作品</div>
                                        </div>
                                        <div style="color:#666;"><i class="fa-solid fa-angle-right"></i></div>
                                    </div>`;
                            }).join('');

                            containerFavorites.innerHTML = addBtnHtml + folderListHtml;
                        }
                        isEmpty = false; // 即使没有收藏夹，也会显示新建按钮，所以永远不为空
                    }
                    else if (tab === 'music') {
                        // 音乐列表
                        if (!ud.music || ud.music.length === 0) {
                            isEmpty = true;
                            if (containerMusic) containerMusic.innerHTML = '';
                        } else {
                            if (containerMusic) {
                                containerMusic.style.display = 'block';
                                this.renderMyMusic(ud.music);
                            }
                        }
                    }
                    else if (tab === 'downloads') {
                        // 下载列表
                        if (!ud.downloads || ud.downloads.length === 0) {
                            isEmpty = true;
                        } else {
                            if (containerDl) {
                                containerDl.style.display = 'block';
                                this.renderMyDownloads(ud.downloads);
                            }
                        }
                    }

                    // 5. 显示空状态提示
                    if (isEmpty && emptyTip) emptyTip.style.display = 'block';

                } catch (e) {
                    console.error("切换Tab出错:", e);
                    if (window.app && app.interaction) app.interaction.showToast("列表加载出错");
                }
            }

            // 优化版的网格渲染 (分批次，防止页面假死)
            async renderWorksGrid(list, containerId, clickFnName) {
                const container = document.getElementById(containerId);
                container.innerHTML = '';

                const BATCH_SIZE = 50;
                let index = 0;

                const renderBatch = () => {
                    const batch = list.slice(index, index + BATCH_SIZE);
                    if (batch.length === 0) return;

                    const html = batch.map((w, i) => {
                        const globalIndex = index + i;
                        return renderWorkGridItem(w, globalIndex, {
                            clickAction: `app.${clickFnName}(${globalIndex})`,
                            typeFallback: '视频'
                        });
                    }).join('');

                    container.insertAdjacentHTML('beforeend', html);
                    index += BATCH_SIZE;
                    if (index < list.length) requestAnimationFrame(renderBatch);
                };

                renderBatch();
            }



            // 2. 渲染“我的音乐”列表 (增加空状态处理)
            renderMyMusic(list) {
                const container = document.getElementById('my-music-list');
                if (!container) return;

                // 1. 基础判空
                if (!list || !Array.isArray(list) || list.length === 0) {
                    container.innerHTML = '';
                    return;
                }

                // 2. 渲染列表（增加容错判断）
                const html = list.map((m, i) => {
                    // 【核心修复】如果数据项为空，直接跳过，防止报错
                    if (!m) return '';

                    // 安全获取字段，防止 undefined 报错
                    const safeTitle = m.title || '未知标题';
                    const safeAuthor = m.author || '未知作者';

                    // 判断是否有来源视频
                    const canJump = !!(m.source_work && m.source_work.title);
                    const subText = canJump ? `来源: ${m.source_work.title}` : safeAuthor;

                    return `
        <div class="my-list-item" onclick="app.playFromMyMusic(${i})">
            <div class="music-item-icon">
                <i class="fa-solid fa-music"></i>
            </div>
            <div class="item-info">
                <div class="item-title">${safeTitle}</div>
                <div class="item-sub">${safeAuthor}</div>
            </div>
            <!-- 删除按钮 -->
            <div class="item-action-btn" onclick="app.deleteMyMusic(event, ${i})">
                <i class="fa-solid fa-trash"></i>
            </div>
        </div>`;
                }).join('');

                container.innerHTML = html;
            }

            renderMyDownloads(list) {
                const html = list.map((d) => renderDownloadHistoryItem(d, {
                    actionIcon: 'fa-folder-open',
                    actionClick: "alert('文件已下载到本地，请在手机/电脑的文件管理器中查看')"
                })).join('');
                document.getElementById('my-download-list').innerHTML = html;
            }

            openTextPage(type, isHighPriority = false) {
                this.pushState('text-page');

                const titleEl = document.getElementById('text-page-title');
                const bodyEl = document.getElementById('text-page-body');
                const page = document.getElementById('text-display-page');

                let title = '';
                let content = '';

                // 使用 helper 获取内容，保持代码整洁
                if (type === 'privacy') {
                    title = '隐私政策';
                    content = this._getTextContent('privacy');
                } else if (type === 'terms') {
                    title = '免责声明';
                    content = this._getTextContent('terms');
                } else if (type === 'about') {
                    title = '软件介绍';
                    content = this._getTextContent('about');
                }

                if (titleEl) titleEl.innerText = title;
                if (bodyEl) bodyEl.innerHTML = content;

                // 处理层级 (协议弹窗需要更高层级)
                if (isHighPriority) {
                    page.classList.add('z-top');
                } else {
                    page.classList.remove('z-top');
                }

                page.classList.add('active');
            }

            // ================= Close 方法 (触发 history.back) =================

            /**
             * 关闭当前页面的通用方法
             * 点击页面左上角“返回”箭头时调用此方法
             */
            closePage(id) {
                // 不直接操作 DOM，而是让浏览器回退，触发 popstate，进而调用 handleSystemBack
                history.back();
            }

            closeComments() {
                history.back();
            }

            /**
             * 特殊方法：重置所有状态
             * 用于：点击侧边栏加载新资源时，或者需要强行清场时
             */
            closeAll() {
                // 如果侧边栏是打开的，退一步（通常此时是由侧边栏触发的加载）
                const sidebar = document.getElementById('sidebar-page');
                if (sidebar && sidebar.classList.contains('active')) {
                    history.back();
                } else {
                    // 兜底逻辑：如果历史记录混乱，强行清理 UI
                    // 这里不调用 history.back() 防止不可控的跳转
                    document.querySelectorAll('.page-layer.active').forEach(e => e.classList.remove('active'));

                    const list = ['download-sheet', 'comment-layer', 'global-mask', 'task-sheet'];
                    list.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.classList.remove('active');
                    });
                }
            }
            backToHome() {
                // 1. 强制关闭所有页面层 (包括侧边栏、添加页、设置页等)
                document.querySelectorAll('.page-layer').forEach(el => {
                    el.classList.remove('active');
                });

                // 2. 强制关闭所有遮罩
                document.querySelectorAll('.overlay-mask').forEach(el => {
                    el.classList.remove('active');
                });

                // 3. 关闭底部 Sheet 和 评论区 (如果有打开)
                const sheet = document.getElementById('download-sheet');
                if (sheet) sheet.classList.remove('active');

                const commentLayer = document.getElementById('comment-layer');
                if (commentLayer) commentLayer.classList.remove('active');

                // 4. 为了保持浏览器历史记录的一致性（可选优化）
                // 尝试回退2次（假设路径是：主页->侧边栏->添加页）
                // 如果担心多退，可以注释掉下面这行，只做视觉关闭即可
                history.go(-2);
            }
            // ================= 辅助逻辑 =================

            // 获取长文本内容
            _getTextContent(type) {
                // --- 1. 免责声明与数据来源 ---
                if (type === 'terms') {
                    return `
                    <h3>免责声明</h3>
                    <p>更新日期：2025年12月1日</p>          
                    <h4>1. 数据来源说明</h4>
                    <p>本应用（抖咻咻）是一款基于 Web 技术的第三方客户端。应用内展示的所有视频、图片、音乐及文本内容，其数据来源方式如下：</p>
                    <ul>
                        <li><strong>用户主动输入：</strong>通过用户粘贴的公开分享链接（如抖音/TikTok分享链接）。</li>
                        <li><strong>第三方接口解析：</strong>本应用调用公开合法的第三方解析接口，将分享链接转换为可播放的媒体地址。</li>
                        <li><strong>非官方关联：</strong>本应用与抖音（Douyin）、TikTok 或字节跳动公司无任何官方关联。</li>
                    </ul>

                    <h4>2. 数据使用方式</h4>
                    <p>本应用仅作为内容的<strong>浏览器/播放器</strong>，不进行任何形式的数据爬取、破解或非法存储。所有媒体资源均存储于原平台的 CDN 服务器，本应用仅做链接引用。</p>

                    <h4>3. 责任声明</h4>
                    <p>用户在使用本应用时，应遵守相关法律法规。对于用户使用本应用下载、分享的内容所产生的任何版权纠纷或法律后果，本应用开发者不承担任何责任。若您是内容版权方且认为本应用侵犯了您的权益，请联系开发者，我们将立即停止相关链接的解析服务。</p>
                    
                    <p><strong>本应用仅供技术学习与交流使用，禁止用于任何商业用途。</strong></p>
                    `;
                }

                // --- 2. 隐私权限说明 ---
                if (type === 'privacy') {
                    return `
                    <h3>隐私权限说明</h3>
                    <p>为了向您提供完整的功能体验，我们需要申请以下权限。我们遵循“最小必要、就地处理、可随时清理”的原则。</p>

                    <h4>1. 存储权限 (Storage)</h4>
                    <p><strong>用途：</strong>保存您的个性化设置（如自动连播、静音）、历史记录（下载记录、收藏列表）、本地扫描结果以及自定义添加的资源数据。</p>
                    <p><strong>方式：</strong>使用浏览器本地存储 (LocalStorage/IndexedDB)，数据仅保存在您的设备上，不会上传至任何服务器。</p>

                    <h4>2. 本地媒体扫描</h4>
                    <p><strong>用途：</strong>扫描您选择的文件夹，筛选出视频/音乐资源并生成本地播放列表。</p>
                    <p><strong>方式：</strong>仅读取文件路径、文件名、文件大小等基础信息，不读取或上传文件内容。您可在“设置”中指定扫描目录与最小大小阈值。</p>

                    <h4>3. 麦克风权限 (Microphone)</h4>
                    <p><strong>用途：</strong>仅用于“听歌识曲”功能。</p>
                    <p><strong>方式：</strong>当您点击封面上的麦克风图标时申请。音频数据仅在本地或发送至识别接口进行特征比对，识别完成后立即丢弃，不会录音保存。</p>

                    <h4>4. 网络权限 (Network)</h4>
                    <p><strong>用途：</strong>加载视频、图片资源，检查应用更新，以及请求解析接口。</p>
                    <p><strong>方式：</strong>标准的 HTTP/HTTPS 请求。</p>

                    <h4>5. 设备信息 (Device Info)</h4>
                    <p><strong>用途：</strong>适配屏幕布局（响应式设计），判断是否为移动设备以优化触摸体验。</p>
                    <p><strong>方式：</strong>读取 UserAgent 和 Screen Resolution，不收集IMEI等敏感识别码。</p>

                    <h4>6. 数据保留与清理</h4>
                    <p>您可以在“存储管理”中清除缓存、重置本地数据或关闭本地混合播放。清理后不会保留任何历史记录与本地扫描结果。</p>
                    `;
                }

                // --- 3. 软件介绍 (美化版) ---
                if (type === 'about') {
                    return `
                    <div class="about-page-wrapper">
                        <!-- 头部 Logo -->
                        <div class="about-header-section">
                            <div class="about-logo-box">
                                <i class="fa fa-circle-nodes"></i>
                            </div>
                            <div class="about-app-name">抖咻咻</div>
                        </div>

                         <div class="z-desc">Developed by Hillmis</div>
                         <div class="z-desc" style="margin-top:6px;">一站式短视频/图集/音乐浏览器，支持本地扫描、收藏管理与多视图体验。</div>
    

                        <!-- 功能亮点 (对称网格) -->
                        <div class="about-section-header">功能亮点</div>
                        <div class="feature-grid-box">
                            <div class="feature-card-item">
                                <div class="f-icon blue"><i class="fa-solid fa-mobile-screen"></i></div>
                                <div class="f-title">沉浸体验</div>
                                <div class="f-desc">全屏滑动 纯净浏览</div>
                            </div>
                            <div class="feature-card-item">
                                <div class="f-icon purple"><i class="fa-solid fa-users-viewfinder"></i></div>
                                <div class="f-title">资源订阅</div>
                                <div class="f-desc">一键导入 实时更新</div>
                            </div>
                            <div class="feature-card-item">
                                <div class="f-icon orange"><i class="fa-solid fa-music"></i></div>
                                <div class="f-title">听歌识曲</div>
                                <div class="f-desc">快速识别 收藏下载</div>
                            </div>
                            <div class="feature-card-item">
                                <div class="f-icon green"><i class="fa-solid fa-chart-pie"></i></div>
                                <div class="f-title">数据分析</div>
                                <div class="f-desc">色调提取 尺寸检测</div>
                            </div>
                            <div class="feature-card-item">
                                <div class="f-icon teal"><i class="fa-solid fa-folder-open"></i></div>
                                <div class="f-title">本地资源</div>
                                <div class="f-desc">本地扫描 离线播放</div>
                            </div>
                            <div class="feature-card-item">
                                <div class="f-icon pink"><i class="fa-solid fa-layer-group"></i></div>
                                <div class="f-title">多视图模式</div>
                                <div class="f-desc">单列/双列/推荐</div>
                            </div>
                        </div>

                        <!-- 致谢列表 -->
                        <div class="about-section-header">致谢 & 依赖</div>
                        <div class="credits-card-box">
                            <div class="credits-item"><span>核心框架：</span><span>HTML5 + Vanilla JS</span></div>
                            <div class="credits-item"><span>滑动组件：</span><span>Swiper.js v11</span></div>
                            <div class="credits-item"><span>第三方库：</span><span>Fas + Jszip + Filesave</span></div>
                            <div class="credits-item"><span>解析支持：</span><span>北城</span></div>
                            <div class="credits-item"><span>设计灵感：</span><span>Douyin + Tuxiuxiu</span></div>
                            <div class="credits-item"><span>开发工具：</span><span>Vscode + Gemini3.0+WebIDE</span></div>           
                        </div>
                        <div class="about-section-header">一言</div>
                        <div class="credits-card-box">  
                            <div class="credits-item"><span>“天若有情天亦老，人间正道是沧桑”</span></div>
                        </div>
                    </div>
                    `;
                }
                return '';
            }

            refreshMusicInfo(data) {
                if (!document.getElementById('music-manage-page').classList.contains('active')) return;
                const music = data.music_info || {};
                const safeTitle = music.title || '原声';
                const safeAuthor = music.author || '未知';
                const safeUrl = music.url || '';
                const titleEl = document.getElementById('music-page-title');
                const authorEl = document.getElementById('music-page-author');
                if (titleEl) titleEl.innerText = safeTitle;
                if (authorEl) authorEl.innerText = safeAuthor;

                const btnDownload = document.getElementById('btn-music-download');
                const btnFav = document.getElementById('btn-music-fav');
                const btnCopyLink = document.getElementById('btn-music-copy-link');

                if (btnDownload) { btnDownload.onclick = () => window.app.downloadMusic(safeUrl, safeTitle, safeAuthor); }
                if (btnFav) {
                    const icon = btnFav.querySelector('i');
                    const text = btnFav.querySelector('.btn-text');
                    const updateBtnStyle = (isSaved) => {
                        if (isSaved) {
                            icon.className = 'fa-solid fa-check';
                            text.innerText = '已收藏';
                            btnFav.style.background = 'rgba(255,255,255,0.2)';
                            btnFav.style.border = '1px solid rgba(255,255,255,0.3)';
                        } else {
                            icon.className = 'fa-solid fa-heart';
                            text.innerText = '收藏音乐';
                            btnFav.style.background = ''; // 恢复 CSS 定义的渐变色
                            btnFav.style.border = '';
                        }
                    };

                    // 初始化状态
                    const isInitSaved = window.app.userDataManager.isMusicSaved(music);
                    updateBtnStyle(isInitSaved);

                    btnFav.onclick = null;
                    btnFav.onclick = async () => { // 加上 async
                        if (!safeUrl) { window.app.interaction.showToast('无效音频，无法收藏'); return; }

                        // 执行切换
                        const newState = await window.app.userDataManager.toggleMusic(music, data);

                        // 立即更新样式
                        updateBtnStyle(newState);

                        window.app.interaction.showToast(newState ? '已添加到我的音乐' : '已取消收藏');

                        // 刷新我的页面状态
                        window.app.pageManager.updateMyStats();
                        const musicListEl = document.getElementById('my-music-list');
                        if (musicListEl) window.app.pageManager.renderMyMusic(window.app.userDataManager.music);
                    };
                }

                if (btnCopyLink) {
                    btnCopyLink.onclick = () => {
                        if (!safeUrl) { window.app.interaction.showToast('暂无音乐链接'); return; }
                        navigator.clipboard.writeText(safeUrl).then(() => { window.app.interaction.showToast('音乐链接已复制'); }).catch(() => { window.app.interaction.showToast('复制失败，请长按文本复制'); });
                    };
                }

                this.updateMusicMiniPlayer(data);

                const currTimeEl = document.getElementById('music-curr-time');
                const totalTimeEl = document.getElementById('music-total-time');
                const seekBar = document.getElementById('music-seek-bar');
                const media = window.app.mediaManager ? window.app.mediaManager.currentMedia : null;
                if (media && media.readyState >= 1 && media.duration && media.duration !== Infinity) {
                    const pct = (media.currentTime / media.duration) * 100;
                    if (currTimeEl) currTimeEl.innerText = window.app.mediaManager.formatTime(media.currentTime);
                    if (seekBar) seekBar.value = pct;
                } else {
                    if (currTimeEl) currTimeEl.innerText = "00:00";
                    if (seekBar) seekBar.value = 0;
                }
                if (totalTimeEl) {
                    let durationStr = "00:00";
                    let realDuration = 0;
                    if (window.app.mediaManager && window.app.mediaManager.currentMedia) {
                        const media = window.app.mediaManager.currentMedia;
                        if (media.readyState >= 1 && media.duration && media.duration !== Infinity) realDuration = media.duration;
                    }
                    if (realDuration > 0) durationStr = window.app.mediaManager.formatTime(realDuration);
                    else if (data.duration) {
                        if (window.app.renderer && window.app.renderer.parseDurationStr) {
                            const secs = window.app.renderer.parseDurationStr(data.duration);
                            durationStr = window.app.mediaManager.formatTime(secs);
                        } else { durationStr = data.duration; }
                    }
                    totalTimeEl.innerText = durationStr;
                }
                const toggleBtn = document.getElementById('music-toggle-btn');
                if (toggleBtn) {
                    const isPlaying = media ? !media.paused : true;
                    toggleBtn.innerHTML = isPlaying
                        ? '<i class="fa-solid fa-pause"></i>'
                        : '<i class="fa-solid fa-play" style="padding-left:4px;"></i>';
                }
                const card = document.getElementById('music-card-anim');
                if (card) {
                    card.classList.remove('pulse-music');
                    const shouldAnimate = !(media && media.currentTime > 0.1);
                    if (shouldAnimate) {
                        card.style.transition = 'transform 0.2s';
                        card.style.transform = 'scale(0.9)';
                        setTimeout(() => { card.style.transform = 'scale(1)'; }, 200);
                    } else {
                        card.style.transition = 'none';
                        card.style.transform = 'scale(1)';
                    }
                }
            }

            updateMusicMiniPlayer(data, options = {}) {
                const mediaBox = document.getElementById('music-mini-media');
                const titleEl = document.getElementById('music-mini-title-text');
                const miniPlayer = document.getElementById('music-mini-player');
                const shouldUpdateDom = !!mediaBox;
                const preferDom = options.preferDom !== false;
                const activeSlide = preferDom ? document.querySelector('.swiper-slide-active') : null;
                const isVideo = data && data.type === '视频';
                const hasImages = data && data.images && data.images.length > 0;
                const idText = data ? String(data.id || '') : '';
                const isLocal = data && (data.is_local || idText.includes('local-') || (data.info && data.info.origin_type === 'local'));
                const isMusic = data && (data.type === '音乐' || data.type === 'music' || (data.music_info && !isVideo && !hasImages));
                let titleText = '暂无标题';
                let html = '';
                const setMiniSize = (ratioW, ratioH) => {
                    if (!ratioW || !ratioH) return;
                    const maxWidth = Math.min(320, window.innerWidth * 0.9);
                    const maxHeight = Math.min(320, window.innerHeight * 0.45);
                    let width = maxWidth;
                    let height = width * (ratioH / ratioW);
                    if (height > maxHeight) {
                        height = maxHeight;
                        width = height * (ratioW / ratioH);
                    }
                    const nextSize = { width: Math.round(width), height: Math.round(height) };
                    if (miniPlayer) {
                        miniPlayer.style.width = `${nextSize.width}px`;
                        miniPlayer.style.height = `${nextSize.height}px`;
                    }
                    this.lastMiniSize = nextSize;
                };

                const captureVideoPoster = (videoEl) => {
                    if (!videoEl || videoEl.readyState < 2) return '';
                    try {
                        const w = videoEl.videoWidth;
                        const h = videoEl.videoHeight;
                        if (!w || !h) return '';
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(videoEl, 0, 0, w, h);
                        return canvas.toDataURL('image/jpeg', 0.7);
                    } catch (e) {
                        return '';
                    }
                };

                const extractBgUrl = (el) => {
                    if (!el) return '';
                    const bg = el.style.backgroundImage || window.getComputedStyle(el).backgroundImage || '';
                    const match = /url\(["']?(.*?)["']?\)/.exec(bg);
                    return match ? match[1] : '';
                };

                if (isMusic && isLocal) {
                    const filmSvg = "data:image/svg+xml;utf8," +
                        "<svg xmlns='http://www.w3.org/2000/svg' width='520' height='360' viewBox='0 0 520 360'>" +
                        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
                        "<stop offset='0' stop-color='%23111111'/><stop offset='1' stop-color='%23272727'/>" +
                        "</linearGradient></defs>" +
                        "<rect width='520' height='360' rx='26' fill='url(%23g)'/>" +
                        "<rect x='30' y='40' width='460' height='280' rx='18' fill='%230b0b0d' stroke='%232b2b2b' stroke-width='4'/>" +
                        "<rect x='70' y='80' width='380' height='200' rx='12' fill='%2318181c'/>" +
                        "<g fill='%233a3a3a'>" +
                        "<rect x='40' y='70' width='20' height='36' rx='6'/><rect x='40' y='125' width='20' height='36' rx='6'/>" +
                        "<rect x='40' y='180' width='20' height='36' rx='6'/><rect x='40' y='235' width='20' height='36' rx='6'/>" +
                        "<rect x='460' y='70' width='20' height='36' rx='6'/><rect x='460' y='125' width='20' height='36' rx='6'/>" +
                        "<rect x='460' y='180' width='20' height='36' rx='6'/><rect x='460' y='235' width='20' height='36' rx='6'/>" +
                        "</g>" +
                        "<circle cx='260' cy='180' r='58' fill='%23222222' stroke='%233a3a3a' stroke-width='6'/>" +
                        "<circle cx='260' cy='180' r='18' fill='%233a3a3a'/>" +
                        "</svg>";
                    setMiniSize(4, 3);
                    html = `<img src="${filmSvg}" alt="胶片占位图" loading="eager" decoding="async">`;
                } else if (isVideo) {
                    let videoSrc = data.url || '';
                    let poster = data.cover || '';
                    let ratioW = data.width || 9;
                    let ratioH = data.height || 16;
                    if (activeSlide) {
                        const videoEl = activeSlide.querySelector('video');
                        if (videoEl) {
                            videoSrc = videoEl.currentSrc || videoEl.src || videoSrc;
                            const snapshot = captureVideoPoster(videoEl);
                            poster = snapshot || videoEl.getAttribute('poster') || poster;
                            if (videoEl.videoWidth && videoEl.videoHeight) {
                                ratioW = videoEl.videoWidth;
                                ratioH = videoEl.videoHeight;
                            }
                        }
                    }
                    setMiniSize(ratioW, ratioH);
                    if (videoSrc) {
                        const posterAttr = poster ? ` poster="${poster}"` : '';
                        html = `<video class="music-mini-video" data-mini-sync="true" src="${videoSrc}"${posterAttr} muted autoplay playsinline preload="metadata"></video>`;
                    } else if (poster) {
                        html = `<img src="${poster}" alt="当前播放封面" loading="eager" decoding="async">`;
                    }
                } else if (hasImages) {
                    let imgSrc = '';
                    let ratioW = data.width || 4;
                    let ratioH = data.height || 3;
                    if (activeSlide) {
                        const gallerySwiper = activeSlide.querySelector('.gallery-swiper');
                        if (gallerySwiper && gallerySwiper.swiper) {
                            const active = gallerySwiper.swiper.slides[gallerySwiper.swiper.activeIndex];
                            const imgEl = active ? active.querySelector('img') : null;
                            if (imgEl) {
                                imgSrc = imgEl.currentSrc || imgEl.src || imgEl.getAttribute('data-src') || '';
                                if (imgEl.naturalWidth && imgEl.naturalHeight) {
                                    ratioW = imgEl.naturalWidth;
                                    ratioH = imgEl.naturalHeight;
                                }
                            }
                        }
                    }
                    if (!imgSrc) {
                        const first = data.images[0];
                        imgSrc = Array.isArray(first) ? first[0] : first;
                    }
                    setMiniSize(ratioW, ratioH);
                    if (imgSrc) {
                        html = `<img src="${imgSrc}" alt="当前播放图集" loading="eager" decoding="async">`;
                    }
                }

                if (!html) {
                    if (miniPlayer) {
                        miniPlayer.style.width = '260px';
                        miniPlayer.style.height = '195px';
                        this.lastMiniSize = { width: 260, height: 195 };
                    }
                    html = `<div class="music-mini-placeholder"><i class="fa-solid fa-photo-film"></i><span>暂无播放画面</span></div>`;
                }

                if (shouldUpdateDom) {
                    mediaBox.innerHTML = html;
                    if (app.mediaManager) app.mediaManager.refreshMusicPageRefs(true);
                }
                this.lastMiniMarkup = html;
                if (data) {
                    titleText = data.title || data.desc || '暂无标题';
                }
                if (titleEl && shouldUpdateDom) {
                    titleEl.dataset.fullText = titleText;
                    titleEl.innerText = titleText;
                }
                this.lastMiniTitle = titleText;
                if (window.app && app.renderer) {
                    app.renderer.lastMiniMarkup = html;
                    app.renderer.lastMiniTitle = titleText;
                    app.renderer.lastMiniSize = this.lastMiniSize;
                }
            }


            // 初始化音乐页面滑动手势（上下切换歌曲）
            initMusicPageSwipe() {
                const page = document.getElementById('music-manage-page');
                if (!page) return;

                let startY = 0;
                let startX = 0;

                page.addEventListener('touchstart', (e) => {
                    startY = e.touches[0].clientY;
                    startX = e.touches[0].clientX;
                }, { passive: true });

                page.addEventListener('touchend', (e) => {
                    // 防止误触：如果点击的是进度条或按钮，不触发滑动
                    if (e.target.closest('.custom-range, .ctrl-btn, .gradient-btn')) return;

                    const endY = e.changedTouches[0].clientY;
                    const endX = e.changedTouches[0].clientX;
                    const diffY = startY - endY;
                    const diffX = Math.abs(startX - endX);

                    // 垂直滑动距离 > 50 且 大于水平滑动距离
                    if (Math.abs(diffY) > 50 && Math.abs(diffY) > diffX) {
                        if (diffY > 0) {
                            // 上滑 -> 下一个
                            app.mainSwiper.slideNext();
                        } else {
                            // 下滑 -> 上一个
                            app.mainSwiper.slidePrev();
                        }
                    }
                });
            }

            // 渲染“我的”页面 Mock 数据
            renderMyWorksMock() {
                const container = document.getElementById('my-works-grid');
                if (!container || container.children.length > 0) return; // 避免重复渲染

                let html = '';
                for (let i = 0; i < 12; i++) {
                    const isVideo = i % 2 === 0;
                    const likeCount = Math.floor(Math.random() * 5000) + 100;
                    // 使用占位图
                    const cover = `getDiceBearAvatar('Work ${i + 1}')`;

                    html += `
            <div class="work-item" onclick="alert('这是预览，实际可跳转播放')">
                <div class="work-type-badge">${isVideo ? '视频' : '图集'}</div>
                <img src="${cover}" loading="lazy">
                <div style="position:absolute; bottom:5px; left:5px; font-size:12px; font-weight:bold;">
                    <i class="fa-regular fa-heart"></i> ${likeCount}
                </div>
            </div>`;
                }
                container.innerHTML = html;
            }

            // --- 【新增】打开圈子主页的方法 ---
            openCircleHub() {
                // 1. 写入历史记录，支持返回键关闭
                this.pushState('circle-hub');

                // 2. 获取圈子页面 DOM
                const page = document.getElementById('circle-page');
                if (page) {
                    page.classList.add('active');

                    // 3. 确保数据初始化 (如果还没加载过)
                    // 这里调用 CircleManager 的 init 方法加载 Hero 区域和帖子
                    if (app.circleManager) {
                        // 仅当页面为空或需要刷新时初始化，避免重复刷新
                        const container = document.getElementById('circle-feed-container');
                        if (!container || container.children.length === 0) {
                            app.circleManager.init();
                        }
                    }
                }
            }

        }

/* ---- app/data/33-random-video-loader.js ---- */
/* v3 semantic split: class from js/app/09-random-video-loader.js | keep script order */
        class RandomVideoLoader {
            // Random API preloader to resolve final URL and warm cache.
            static RandomApiVideoPreloader = class {
                constructor() {
                    this.preloadQueue = new Map();
                    this.maxPreload = 2;
                    this.currentPreloads = 0;
                    this.preloadVideoElements = [];
                    this.activePreloads = new Set();
                    this.preloadAbortControllers = new Map();
                    for (let i = 0; i < this.maxPreload; i++) {
                        const video = document.createElement('video');
                        video.style.display = 'none';
                        video.preload = 'auto';
                        video.muted = true;
                        video.playsInline = true;
                        video.setAttribute('webkit-playsinline', '');
                        video.setAttribute('x-webkit-airplay', 'allow');
                        document.body.appendChild(video);
                        this.preloadVideoElements.push(video);
                    }
                }

                _getQueue(apiUrl) {
                    if (!this.preloadQueue.has(apiUrl)) this.preloadQueue.set(apiUrl, []);
                    return this.preloadQueue.get(apiUrl);
                }

                _shouldUseDirect(apiUrl) {
                    if (!apiUrl || typeof apiUrl !== 'string') return false;
                    const lower = apiUrl.toLowerCase();
                    if (lower.match(/\.(mp4|mov|webm|m3u8)(\?|$)/)) return true;
                    if (lower.includes('type=video') || lower.includes('type=mp4')) return true;
                    if (lower.includes('format=video') || lower.includes('format=mp4')) return true;
                    return false;
                }

                _getProxyPrefix() {
                    if (!window.Api || typeof Api.getProxyPrefix !== 'function') return '';
                    return Api.getProxyPrefix() || '';
                }

                _readProxyFinalUrl(res, proxyPrefix) {
                    if (!res) return '';
                    const headerKeys = ['x-final-url', 'x-real-url', 'x-target-url', 'x-forwarded-url', 'x-proxy-final-url'];
                    if (res.headers) {
                        for (const key of headerKeys) {
                            const value = res.headers.get(key);
                            if (value && value.startsWith('http')) return value;
                        }
                    }
                    if (res.url && proxyPrefix && !res.url.startsWith(proxyPrefix)) return res.url;
                    return '';
                }

                async _fetchWithCorsFallback(url, options = {}) {
                    return RandomVideoLoader.fetchWithCorsFallbackShared(url, options, {
                        proxyPrefix: this._getProxyPrefix(),
                        returnMeta: true,
                        allowOpaqueResponse: true
                    });
                }

                async getNextVideoUrl(apiUrl) {
                    if (this._shouldUseDirect(apiUrl)) return apiUrl;

                    // 优化：增加重试机制
                    const maxRetries = 3;
                    let lastError = null;

                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            const timeout = Math.min(15000, 5000 * attempt); // 渐进式超时
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), timeout);

                            let response = null;
                            let usedProxy = false;
                            let proxyPrefix = '';

                            try {
                                const result = await this._fetchWithCorsFallback(apiUrl, {
                                    method: 'HEAD',
                                    redirect: 'follow',
                                    cache: 'no-store',
                                    signal: controller.signal
                                });
                                response = result.res;
                                usedProxy = result.usedProxy;
                                proxyPrefix = result.proxyPrefix || '';
                            } catch (err) {
                                const result = await this._fetchWithCorsFallback(apiUrl, {
                                    method: 'GET',
                                    redirect: 'follow',
                                    cache: 'no-store',
                                    signal: controller.signal
                                });
                                response = result.res;
                                usedProxy = result.usedProxy;
                                proxyPrefix = result.proxyPrefix || '';
                            }
                            clearTimeout(timeoutId);
                            if (!response || !response.ok) {
                                const status = response ? response.status : 'unknown';
                                throw new Error(`HTTP error! status: ${status}`);
                            }
                            let finalUrl = response.url;
                            if (usedProxy) {
                                const headerUrl = this._readProxyFinalUrl(response, proxyPrefix);
                                if (headerUrl) finalUrl = headerUrl;
                            }
                            if (!finalUrl) {
                                throw new Error('Invalid video URL format');
                            }
                            if (!usedProxy && !finalUrl.match(/\.(mp4|mov|webm|m3u8)($|\?)/i)) {
                                throw new Error('Invalid video URL format');
                            }
                            return finalUrl;
                        } catch (error) {
                            clearTimeout(timeoutId);
                            lastError = error;
                            console.warn(`RandomApiVideoPreloader.getNextVideoUrl attempt ${attempt} failed:`, error);

                            // 不是最后一次尝试，等待后重试
                            if (attempt < maxRetries) {
                                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                            }
                        }
                    }

                    // 所有重试都失败，使用降级方案
                    console.warn('RandomApiVideoPreloader.getNextVideoUrl all attempts failed, using fallback');
                    return this._shouldUseDirect(apiUrl) ? apiUrl : null;
                }

                async fillQueue(apiUrl) {
                    const queue = this._getQueue(apiUrl);
                    if (queue.length >= this.maxPreload || this.currentPreloads >= this.maxPreload) {
                        return;
                    }
                    this.currentPreloads++;
                    let url = null;
                    try {
                        url = await this.getNextVideoUrl(apiUrl);
                        if (!url) {
                            throw new Error('获取视频URL失败');
                        }
                        if (queue.includes(url)) {
                            return;
                        }
                        if (this.activePreloads.has(url)) {
                            return;
                        }
                        const freeVideo = this.preloadVideoElements.find(v => !v.src || v.readyState === 0);
                        if (!freeVideo) {
                            throw new Error('没有可用的预加载视频元素');
                        }
                        const abortController = new AbortController();
                        this.preloadAbortControllers.set(url, abortController);
                        this.activePreloads.add(url);
                        freeVideo.src = '';
                        freeVideo.load();
                        freeVideo.src = url;
                        freeVideo.load();
                        await new Promise((resolve, reject) => {
                            const timer = setTimeout(() => {
                                cleanup();
                                reject(new Error('预加载超时'));
                            }, 15000);
                            const onLoaded = () => {
                                cleanup();
                                queue.push(url);
                                resolve();
                            };
                            const onError = () => {
                                cleanup();
                                reject(new Error('预加载失败'));
                            };
                            const cleanup = () => {
                                clearTimeout(timer);
                                freeVideo.removeEventListener('loadedmetadata', onLoaded);
                                freeVideo.removeEventListener('error', onError);
                                this.preloadAbortControllers.delete(url);
                            };
                            freeVideo.addEventListener('loadedmetadata', onLoaded, { once: true });
                            freeVideo.addEventListener('error', onError, { once: true });
                        });
                    } catch (error) {
                        console.error('预加载失败:', error);
                        if (url) {
                            const nextQueue = this._getQueue(apiUrl);
                            this.preloadQueue.set(apiUrl, nextQueue.filter(u => u !== url));
                            this.activePreloads.delete(url);
                        }
                    } finally {
                        this.currentPreloads--;
                        if (queue.length < this.maxPreload) {
                            setTimeout(() => this.fillQueue(apiUrl), 500);
                        }
                    }
                }

                getNextVideo(apiUrl) {
                    const queue = this._getQueue(apiUrl);
                    if (queue.length > 0) {
                        const nextUrl = queue.shift();
                        const abortController = this.preloadAbortControllers.get(nextUrl);
                        if (abortController) {
                            abortController.abort();
                            this.preloadAbortControllers.delete(nextUrl);
                        }
                        const preloadedVideo = this.preloadVideoElements.find(v =>
                            v.src && v.src.includes(nextUrl.split('?')[0])
                        );
                        if (preloadedVideo) {
                            preloadedVideo.src = '';
                            preloadedVideo.load();
                        }
                        this.fillQueue(apiUrl);
                        return nextUrl;
                    }
                    return null;
                }

                clear(apiUrl) {
                    if (apiUrl) {
                        this.preloadQueue.delete(apiUrl);
                    } else {
                        this.preloadQueue.clear();
                    }
                    this.preloadAbortControllers.forEach(controller => controller.abort());
                    this.preloadAbortControllers.clear();
                    this.activePreloads.clear();
                    this.preloadVideoElements.forEach(video => {
                        video.src = '';
                        video.load();
                    });
                }
            };

            constructor(app) {
                this.app = app;
                this.cachedApis = [];
                this.apiIndex = 0;
                this.apiMixIndex = 0;
                this.isFetching = false;
                this.prefetchQueue = [];
                this.prefetching = false;
                this.finalUrlCache = new Map();
                this.randomApiPreloader = new RandomVideoLoader.RandomApiVideoPreloader();
            }

            async refreshApis() {
                if (!this.app || !this.app.customManager) return false;
                try {
                    const creators = await this.app.customManager.getAll();
                    this.cachedApis = Object.values(creators || {}).filter(c => c && c.info && c.info.origin_type === 'random_api' && c.info.source_url);
                    return this.cachedApis.length > 0;
                } catch (e) {
                    console.error('RandomVideoLoader.refreshApis error', e);
                    this.cachedApis = [];
                    return false;
                }
            }

            async hasApis() {
                if (this.cachedApis.length > 0) return true;
                return await this.refreshApis();
            }

            static async fetchWithCorsFallbackShared(url, options = {}, config = {}) {
                const proxyPrefix = config.proxyPrefix !== undefined
                    ? config.proxyPrefix
                    : ((window.Api && typeof Api.getProxyPrefix === 'function') ? Api.getProxyPrefix() : '');
                const isProxyUrl = proxyPrefix && url.startsWith(proxyPrefix);
                let lastError = null;
                const tryFetch = async (target) => {
                    const res = await fetch(target, options);
                    const ok = res && res.ok && res.type !== 'opaque';
                    return { res, ok };
                };

                try {
                    const { res, ok } = await tryFetch(url);
                    if (ok || (config.allowOpaqueResponse && res)) {
                        return config.returnMeta ? { res, usedProxy: false, proxyPrefix } : res;
                    }
                } catch (err) {
                    lastError = err;
                }

                if (!isProxyUrl && proxyPrefix && url.startsWith('http')) {
                    try {
                        const proxyUrl = proxyPrefix + encodeURIComponent(url);
                        const { res, ok } = await tryFetch(proxyUrl);
                        if (ok || res) {
                            return config.returnMeta ? { res, usedProxy: true, proxyPrefix } : res;
                        }
                    } catch (proxyErr) {
                        lastError = proxyErr;
                    }
                }

                if (lastError) throw lastError;
                throw new Error('Fetch failed');
            }

            async fetchWithCorsFallback(url, options = {}) {
                return RandomVideoLoader.fetchWithCorsFallbackShared(url, options);
            }

            async loadBatch(count = CONFIG.BATCH_SIZE) {
                if (this.isFetching) return [];
                this.isFetching = true;
                try {
                    const has = await this.refreshApis();
                    if (!has) return [];

                    const target = Math.max(1, Math.round(count));
                    const works = [];

                    while (works.length < target) {
                        if (this.prefetchQueue.length > 0) {
                            works.push(this.prefetchQueue.shift());
                            continue;
                        }
                        const batch = await this.fetchFromNextApi();
                        if (!batch.length) break;
                        this.prefetchQueue.push(...batch);
                    }

                    this.fillPrefetchQueue(target * 2);
                    return works.slice(0, target);
                } finally {
                    this.isFetching = false;
                }
            }

            async loadBatchFromApis(apiList, count = CONFIG.BATCH_SIZE) {
                if (!Array.isArray(apiList) || apiList.length === 0) return [];
                const target = Math.max(1, Math.round(count));
                const works = [];
                const queues = new Map();
                let emptyRounds = 0;
                const maxEmptyRounds = 3;
                const totalApis = apiList.length;

                while (works.length < target && emptyRounds < maxEmptyRounds) {
                    let emptyCount = 0;
                    for (let i = 0; i < totalApis; i++) {
                        const api = apiList[(this.apiMixIndex + i) % totalApis];
                        const key = api.info ? api.info.name : api.info?.source_url;
                        const queue = queues.get(key) || [];
                        if (queue.length === 0) {
                            const batch = await this.fetchApiWorks(api);
                            if (batch && batch.length) queue.push(...batch);
                            queues.set(key, queue);
                        }
                        if (queue.length > 0) {
                            works.push(queue.shift());
                            if (works.length >= target) break;
                        } else {
                            emptyCount += 1;
                        }
                    }
                    if (emptyCount >= apiList.length) {
                        emptyRounds += 1;
                    } else {
                        emptyRounds = 0;
                    }
                    this.apiMixIndex = (this.apiMixIndex + 1) % totalApis;
                }

                return works.slice(0, target);
            }

            async fetchFromNextApi() {
                if (this.cachedApis.length === 0) return [];
                const api = this.cachedApis[this.apiIndex % this.cachedApis.length];
                this.apiIndex = (this.apiIndex + 1) % this.cachedApis.length;
                try {
                    return await this.fetchApiWorks(api);
                } catch (err) {
                    console.warn('RandomVideoLoader.fetchApiWorks failed', err);
                    return [];
                }
            }

            async fetchApiWorks(api) {
                if (!api || !api.info || !api.info.source_url) return [];
                let items = [];
                const apiUrl = api.info.source_url;

                // 优化：增加重试机制
                const maxRetries = 3;
                let lastError = null;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        if (api.info.origin_type === 'random_api') {
                            // 先消费已解析好的队列；如果没有队列，直连型随机视频 API 立即生成占位作品，
                            // 让 video 标签自己跟随 302/媒体流加载，避免侧边栏点击后等待 HEAD/GET 解析导致卡顿。
                            let preloaded = this.randomApiPreloader.getNextVideo(apiUrl);
                            if (preloaded) {
                                items = [{ url: preloaded, __from_api: true, __preloaded: true }];
                                break; // 预加载成功，跳出重试循环
                            }
                            if (this.shouldUseFastDirectRandomApi(apiUrl)) {
                                items = [{ url: apiUrl, __from_api: true, __direct_random_api: true }];
                                // 后台继续解析下一条，后续滑动优先使用真实最终地址。
                                setTimeout(() => this.randomApiPreloader.fillQueue(apiUrl), 0);
                                break;
                            }
                            await this.randomApiPreloader.fillQueue(apiUrl);
                            preloaded = this.randomApiPreloader.getNextVideo(apiUrl);
                            if (preloaded) {
                                items = [{ url: preloaded, __from_api: true, __preloaded: true }];
                                break;
                            }
                        }

                        if (items.length === 0) {
                            // 优化：增加超时控制和重试延迟
                            const timeout = Math.min(10000, 2000 * attempt); // 渐进式超时
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), timeout);

                            try {
                                const res = await this.fetchWithCorsFallback(apiUrl, {
                                    cache: 'no-cache',
                                    mode: 'cors',
                                    signal: controller.signal
                                });
                                clearTimeout(timeoutId);

                                if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'unknown'}`);

                                const text = await res.text();
                                try {
                                    const json = JSON.parse(text || '{}');
                                    if (Array.isArray(json)) items = json;
                                    else if (typeof json === 'string') items = [json];
                                    else if (json && Array.isArray(json.data)) items = json.data;
                                    else if (json && json.data && Array.isArray(json.data.list)) items = json.data.list;
                                    else if (json) items = [json];
                                } catch (err) {
                                    if (res.url && res.url.match(/\.(mp4|mov|webm|m3u8)$/i)) {
                                        items = [{ url: res.url }];
                                    } else if (text && text.trim().match(/^https?:\/\/[^\s]+$/)) {
                                        items = [{ url: text.trim() }];
                                    } else {
                                        console.warn('RandomVideoLoader.parse fallback used', text.substring(0, 100));
                                    }
                                }

                                if (items.length > 0) break; // 解析成功，跳出重试循环
                            } catch (fetchErr) {
                                clearTimeout(timeoutId);
                                throw fetchErr;
                            }
                        }
                    } catch (err) {
                        lastError = err;
                        console.warn(`RandomVideoLoader.fetchApiWorks attempt ${attempt} failed:`, err);

                        // 不是最后一次尝试，等待一段时间后重试
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                        }
                    }
                }

                // 所有重试都失败，使用降级方案
                if (items.length === 0 && lastError) {
                    console.warn('RandomVideoLoader.fetchApiWorks all attempts failed, using fallback');
                    items = [{ url: apiUrl, __from_api: true }];
                }

                const normalized = [];
                for (const item of items) {
                    const work = await this.normalizeItem(item, api.info.name || '随机API');
                    if (work) normalized.push(work);
                }
                return normalized;
            }

            async loadBatchFromApi(api, count = CONFIG.BATCH_SIZE) {
                if (this.isFetching) return [];
                this.isFetching = true;
                try {
                    if (!api || !api.info || !api.info.source_url) return [];

                    const target = Math.max(1, Math.round(count));
                    const works = [];
                    let failedAttempts = 0;
                    const maxFailedAttempts = 3;

                    // 优化：智能预加载策略
                    while (works.length < target && failedAttempts < maxFailedAttempts) {
                        if (this.prefetchQueue.length > 0) {
                            works.push(this.prefetchQueue.shift());
                            continue;
                        }

                        try {
                            const batch = await this.fetchApiWorks(api);
                            if (batch.length > 0) {
                                this.prefetchQueue.push(...batch);
                                failedAttempts = 0; // 重置失败计数
                            } else {
                                failedAttempts++;
                                console.warn(`RandomVideoLoader.loadBatchFromApi empty batch, attempt ${failedAttempts}`);

                                // 短暂等待后重试
                                if (failedAttempts < maxFailedAttempts) {
                                    await new Promise(resolve => setTimeout(resolve, 1000 * failedAttempts));
                                }
                            }
                        } catch (err) {
                            failedAttempts++;
                            console.warn(`RandomVideoLoader.loadBatchFromApi error, attempt ${failedAttempts}:`, err);

                            if (failedAttempts < maxFailedAttempts) {
                                await new Promise(resolve => setTimeout(resolve, 1000 * failedAttempts));
                            }
                        }
                    }

                    // 异步填充预加载队列，不阻塞当前请求
                    if (works.length > 0) {
                        setTimeout(() => {
                            this.fillPrefetchQueueFromApi(api, target * 3); // 增加预加载数量
                        }, 100);
                    }

                    return works.slice(0, target);
                } finally {
                    this.isFetching = false;
                }
            }

            async fillPrefetchQueueFromApi(api, target = CONFIG.BATCH_SIZE * 3) {
                if (this.prefetching) return;
                this.prefetching = true;
                try {
                    const needs = Math.max(0, target - this.prefetchQueue.length);
                    let successCount = 0;
                    let failedCount = 0;
                    const maxFailedCount = 5;

                    for (let i = 0; i < needs && failedCount < maxFailedCount; i++) {
                        try {
                            const batch = await this.fetchApiWorks(api);
                            if (batch.length > 0) {
                                this.prefetchQueue.push(...batch);
                                successCount++;
                                failedCount = 0; // 重置失败计数

                                // 优化：批量添加后检查队列长度，避免过度预加载
                                if (this.prefetchQueue.length >= target * 2) {
                                    console.log('RandomVideoLoader: Prefetch queue reached limit, stopping early');
                                    break;
                                }
                            } else {
                                failedCount++;
                                console.warn(`RandomVideoLoader.fillPrefetchQueueFromApi empty batch, failed ${failedCount}`);

                                // 短暂等待后继续尝试
                                if (failedCount < maxFailedCount) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            }
                        } catch (err) {
                            failedCount++;
                            console.warn(`RandomVideoLoader.fillPrefetchQueueFromApi error, failed ${failedCount}:`, err);

                            if (failedCount < maxFailedCount) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                    }

                    console.log(`RandomVideoLoader: Prefetch completed, added ${successCount} batches to queue`);
                } catch (err) {
                    console.warn('RandomVideoLoader.fillPrefetchQueueFromApi failed', err);
                } finally {
                    this.prefetching = false;
                }
            }

            setActiveApi(api) {
                this.activeApi = api || null;
                this.prefetchQueue = [];
                this.prefetching = false;
            }

            async fillPrefetchQueue(target = CONFIG.BATCH_SIZE * 2) {
                if (this.prefetching) return;
                this.prefetching = true;
                try {
                    const needs = Math.max(0, target - this.prefetchQueue.length);
                    for (let i = 0; i < needs; i++) {
                        const batch = await this.fetchFromNextApi();
                        if (!batch.length) break;
                        this.prefetchQueue.push(...batch);
                    }
                } catch (err) {
                    console.warn('RandomVideoLoader.fillPrefetchQueue failed', err);
                } finally {
                    this.prefetching = false;
                }
            }

            async normalizeItem(item, apiName) {
                if (!item) return null;
                if (typeof item === 'string') {
                    const urlOnly = item.trim();
                    if (!urlOnly || !urlOnly.startsWith('http')) return null;
                    return this.buildWorkFromUrl(urlOnly, apiName);
                }
                if (typeof item !== 'object') return null;

                const main = item.data || item;
                const url = this.extractVideoUrl(main) || this.extractVideoUrl(item);
                if (!url) return null;

                const isDirectApi = !!(main.__from_api || item.__from_api);
                return this.buildWorkFromUrl(url, apiName, main, item, { directApi: isDirectApi });
            }

            async buildWorkFromUrl(url, apiName, main = {}, item = {}, options = {}) {
                const directApi = !!options.directApi;
                const cacheBust = `t=${Date.now()}${Math.random().toString(16).slice(2)}`;
                const urlWithBust = url.includes('?') ? `${url}&${cacheBust}` : `${url}?${cacheBust}`;
                const finalUrl = directApi ? urlWithBust : await this.resolveFinalUrl(url);
                const timestampSource = Number(main.timestamp || main.create_time || main.time || Date.now());
                const timestamp = isNaN(timestampSource) ? Date.now() : timestampSource;
                const rawTitle = main.title || main.name || main.desc || item.title || '';
                const title = rawTitle ? rawTitle : (apiName ? `随机视频 · ${apiName}` : '随机视频');
                const author = main.author || main.uploader || apiName || '随机API';
                const cover = this.extractCover(main) || this.extractCover(item) || getDiceBearAvatar(author);
                const width = parseInt(main.width) || 720;
                const height = parseInt(main.height) || 1280;
                const like = Number(main.like || main.digg_count || 0) || Math.floor(Math.random() * 500);
                const comment = Number(main.comment || main.comment_count || 0) || Math.floor(Math.random() * 120);
                const dateText = new Date(timestamp).toISOString().slice(0, 10);

                return {
                    id: `${apiName || 'random'}_${timestamp}_${Math.random().toString(36).slice(2)}`,
                    title,
                    author,
                    type: '视频',
                    like,
                    comment,
                    width,
                    height,
                    url: finalUrl || url,
                    cover,
                    create_time: dateText,
                    timestamp,
                    is_random_api: true,
                    source_api: apiName || 'random',
                    music_info: {
                        title: '原声',
                        author
                    }
                };
            }

            shouldBypassFetch(url) {
                if (!url || typeof url !== 'string') return false;
                const lower = url.toLowerCase();
                if (lower.match(/\.(mp4|mov|webm|m3u8)(\?|$)/)) return true;
                if (lower.includes('type=video') || lower.includes('type=mp4')) return true;
                if (lower.includes('format=video') || lower.includes('format=mp4')) return true;
                return false;
            }

            isLikelyJsonApi(url) {
                if (!url || typeof url !== 'string') return false;
                const lower = url.toLowerCase();
                if (lower.match(/\.(json)(\?|$)/)) return true;
                if (lower.includes('format=json') || lower.includes('type=json') || lower.includes('datatype=json')) return true;
                if (lower.includes('json=1') || lower.includes('return=json')) return true;
                return false;
            }

            shouldUseFastDirectRandomApi(url) {
                if (this.shouldBypassFetch(url)) return true;
                if (this.isLikelyJsonApi(url)) return false;
                // “随机视频”资源多数是 302/直出媒体流。对这类接口先让 video 标签直连，
                // 同时后台解析最终地址，能显著提升侧边栏点击进入后的首屏速度。
                return !!(url && typeof url === 'string' && url.startsWith('http'));
            }

            extractVideoUrl(obj) {
                if (!obj || typeof obj !== 'object') return '';
                const candidates = ['video_url', 'url', 'play_url', 'play_addr', 'download_addr', 'video', 'videoUrl', 'src', 'link'];
                for (const key of candidates) {
                    const value = obj[key];
                    const resolved = this.resolveUrlValue(value);
                    if (resolved) return resolved;
                }
                if (obj.video_info) {
                    const nested = this.extractVideoUrl(obj.video_info);
                    if (nested) return nested;
                }
                if (obj.url_list && Array.isArray(obj.url_list) && obj.url_list.length) {
                    for (const entry of obj.url_list) {
                        const candidate = this.resolveUrlValue(entry);
                        if (candidate) return candidate;
                    }
                }
                return '';
            }

            resolveUrlValue(value) {
                if (!value) return '';
                if (typeof value === 'string') {
                    return value.startsWith('http') ? value : '';
                }
                if (Array.isArray(value)) {
                    for (const item of value) {
                        const candidate = this.resolveUrlValue(item);
                        if (candidate) return candidate;
                    }
                }
                if (typeof value === 'object') {
                    if (value.url) return this.resolveUrlValue(value.url);
                    if (value.play_addr) return this.resolveUrlValue(value.play_addr);
                    if (value.download_addr) return this.resolveUrlValue(value.download_addr);
                }
                return '';
            }

            extractCover(obj) {
                if (!obj || typeof obj !== 'object') return '';

                // 第一优先级：直接封面字段
                const directCovers = [obj.first_frame, obj.cover, obj.pic, obj.thumbnail, obj.thumb, obj.poster, obj.image];
                for (const cover of directCovers) {
                    const resolved = this.resolveUrlValue(cover);
                    if (resolved) return resolved;
                }

                // 第二优先级：视频第一帧（从视频对象中提取）
                const nestedVideoCover =
                    this.extractVideoFrameCover(obj.video) ||
                    this.extractVideoFrameCover(obj.video_info) ||
                    this.extractVideoFrameCover(obj.media) ||
                    this.extractVideoFrameCover(obj.media_info);
                if (nestedVideoCover) return nestedVideoCover;

                // 第三优先级：从视频URL生成第一帧（如果对象包含视频URL）
                const videoUrl = obj.video_url || obj.url || obj.download_url || obj.play_url;
                if (videoUrl && typeof videoUrl === 'string' && videoUrl.match(/\.(mp4|mov|webm|m3u8)/i)) {
                    // 尝试从视频URL生成缩略图URL（如果支持的话）
                    const thumbnailUrl = this.generateVideoThumbnailUrl(videoUrl);
                    if (thumbnailUrl) return thumbnailUrl;
                }

                // 第四优先级：作者头像
                const author = obj.author || obj.uploader || obj.creator || '';
                if (author) {
                    return getDiceBearAvatar(author);
                }

                return '';
            }

            extractVideoFrameCover(videoObj) {
                if (!videoObj || typeof videoObj !== 'object') return '';
                const candidates = [
                    videoObj.first_frame,
                    videoObj.origin_cover,
                    videoObj.cover,
                    videoObj.thumbnail,
                    videoObj.poster
                ];
                for (const candidate of candidates) {
                    const resolved = this.resolveUrlValue(candidate);
                    if (resolved) return resolved;
                }
                return '';
            }

            generateVideoThumbnailUrl(videoUrl) {
                if (!videoUrl || typeof videoUrl !== 'string') return '';

                // 尝试从视频URL生成缩略图URL
                // 1. 抖音视频：尝试生成缩略图URL
                if (videoUrl.includes('douyin.com') || videoUrl.includes('douyinpic.com')) {
                    // 抖音视频通常有对应的缩略图URL
                    const thumbnailUrl = videoUrl.replace(/\.(mp4|mov|webm|m3u8).*$/i, '.jpeg');
                    if (thumbnailUrl !== videoUrl) return thumbnailUrl;
                }

                // 2. 通用视频：尝试使用视频截图服务（如果有的话）
                // 这里可以集成第三方视频截图服务，比如：
                // - 使用视频URL的hash作为参数
                // - 调用截图API（如果有的话）

                // 3. 返回空字符串，让上层逻辑继续处理
                return '';
            }
            async resolveFinalUrl(url) {
                if (!url) return '';
                if (this.finalUrlCache.has(url)) return this.finalUrlCache.get(url);

                // Front-end-only flow: manual redirect fetch, HEAD follow, then hidden video probe.
                const manual = await this.resolveRedirectManually(url);
                if (manual) {
                    this.finalUrlCache.set(url, manual);
                    return manual;
                }

                try {
                    const res = await this.fetchWithCorsFallback(url, {
                        method: 'HEAD',
                        redirect: 'follow',
                        cache: 'no-cache',
                        mode: 'cors'
                    });
                    if (res.ok) {
                        const final = res.url || url;
                        this.finalUrlCache.set(url, final);
                        return final;
                    }
                } catch (error) {
                    console.warn('RandomVideoLoader.resolveFinalUrl failed', error);
                }

                const proxyFinal = await this.resolveFinalUrlViaProxy(url);
                if (proxyFinal) {
                    this.finalUrlCache.set(url, proxyFinal);
                    return proxyFinal;
                }

                const probed = await this.resolveByVideoProbe(url);
                if (probed) {
                    this.finalUrlCache.set(url, probed);
                    return probed;
                }

                this.finalUrlCache.set(url, url);
                return url;
            }

            async resolveRedirectManually(url) {
                if (!url || !url.startsWith('http')) return '';
                const options = {
                    method: 'GET',
                    redirect: 'manual',
                    cache: 'no-cache',
                    mode: 'cors'
                };
                const getRedirectTarget = (res) => {
                    if (!res) return '';
                    if (res.status >= 300 && res.status < 400) {
                        const location = res.headers ? res.headers.get('Location') : '';
                        if (location) return new URL(location, url).href;
                    }
                    if (res.ok && res.url) return res.url;
                    return '';
                };

                try {
                    const res = await fetch(url, options);
                    const target = getRedirectTarget(res);
                    if (target) return target;
                } catch (error) {
                    console.warn('RandomVideoLoader.resolveRedirectManually failed', error);
                }

                if (window.Api && typeof Api.getProxyPrefix === 'function') {
                    try {
                        const proxyUrl = Api.getProxyPrefix() + encodeURIComponent(url);
                        const res = await fetch(proxyUrl, options);
                        const target = getRedirectTarget(res);
                        if (target) return target;
                    } catch (error) {
                        console.warn('RandomVideoLoader.resolveRedirectManually proxy failed', error);
                    }
                }

                return '';
            }

            async resolveFinalUrlViaProxy(url) {
                if (!url || !url.startsWith('http')) return '';
                if (!window.Api || typeof Api.getProxyPrefix !== 'function') return '';
                const proxyPrefix = Api.getProxyPrefix();
                if (!proxyPrefix) return '';
                const proxyUrl = proxyPrefix + encodeURIComponent(url);
                const readHeaderUrl = (res) => {
                    if (!res || !res.headers) return '';
                    const keys = ['x-final-url', 'x-real-url', 'x-target-url', 'x-forwarded-url', 'x-proxy-final-url'];
                    for (const key of keys) {
                        const value = res.headers.get(key);
                        if (value && value.startsWith('http')) return value;
                    }
                    return '';
                };

                try {
                    const res = await fetch(proxyUrl, {
                        method: 'HEAD',
                        redirect: 'follow',
                        cache: 'no-cache',
                        mode: 'cors'
                    });
                    if (res && res.ok) {
                        const headerUrl = readHeaderUrl(res);
                        if (headerUrl) return headerUrl;
                        if (res.url && !res.url.startsWith(proxyPrefix)) return res.url;
                    }
                } catch (error) {
                    console.warn('RandomVideoLoader.resolveFinalUrlViaProxy failed', error);
                }

                try {
                    const res = await fetch(proxyUrl, {
                        method: 'GET',
                        redirect: 'manual',
                        cache: 'no-cache',
                        mode: 'cors'
                    });
                    if (res && res.status >= 300 && res.status < 400) {
                        const location = res.headers ? res.headers.get('Location') : '';
                        if (location) return new URL(location, url).href;
                    }
                } catch (error) {
                    console.warn('RandomVideoLoader.resolveFinalUrlViaProxy manual failed', error);
                }

                return '';
            }

            async resolveByVideoProbe(url) {
                if (!url || !url.startsWith('http')) return '';
                return new Promise((resolve) => {
                    const video = document.createElement('video');
                    const cleanup = () => {
                        video.pause();
                        video.removeAttribute('src');
                        video.load();
                        if (video.parentNode) video.parentNode.removeChild(video);
                    };
                    const finish = (result) => {
                        cleanup();
                        resolve(result || '');
                    };
                    const timeoutId = setTimeout(() => finish(''), 5000);

                    video.preload = 'metadata';
                    video.muted = true;
                    video.playsInline = true;
                    video.style.position = 'fixed';
                    video.style.left = '-9999px';
                    video.style.width = '1px';
                    video.style.height = '1px';

                    const onReady = () => {
                        clearTimeout(timeoutId);
                        finish(video.currentSrc || '');
                    };
                    const onError = () => {
                        clearTimeout(timeoutId);
                        finish('');
                    };

                    video.addEventListener('loadedmetadata', onReady, { once: true });
                    video.addEventListener('loadeddata', onReady, { once: true });
                    video.addEventListener('error', onError, { once: true });

                    document.body.appendChild(video);
                    video.src = url;
                    video.load();
                });
            }

        }
        // --- 5. App 主控制器 ---

/* ---- app/app/34-app.js ---- */
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

/* ---- app/app/35-bootstrap.js ---- */
/* v3 semantic split: script from js/app/11-bootstrap.js | keep script order */
        // --- 启动 ---
        const app = new App();
        app.init();
        //获取版本号
        document.addEventListener('DOMContentLoaded', () => {
            const versionEl = document.getElementById('sys-version-text');
            if (versionEl && window.DxxSystem) {
                // 获取版本号并显示，例如 "v5.2"
                versionEl.innerText = 'v' + DxxSystem.getVersion();
            }
        });
