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
