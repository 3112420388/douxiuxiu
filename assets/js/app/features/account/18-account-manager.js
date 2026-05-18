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
