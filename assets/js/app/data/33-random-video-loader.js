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
