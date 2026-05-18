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
