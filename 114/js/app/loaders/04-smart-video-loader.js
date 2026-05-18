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
