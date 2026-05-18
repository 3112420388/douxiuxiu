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
