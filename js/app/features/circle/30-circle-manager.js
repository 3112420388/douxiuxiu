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
