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
