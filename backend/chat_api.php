<?php
/**
 * chat_api.php
 * 聊天室系统API
 * 包含: 登录注册、消息收发、用户管理
 */

require_once 'config.php';

$action = $_POST['action'] ?? '';

// ============================================================
// 路由分发
// ============================================================
switch ($action) {
    // ==================== 账号系统 ====================
    case 'login_or_register':
        handleLoginOrRegister();
        break;
    case 'get_user_info':
        handleGetUserInfo();
        break;
    case 'get_user_profile':
        handleGetUserProfile();
        break;
    case 'update_profile':
        handleUpdateProfile();
        break;
    case 'user_op':
        handleUserOp();
        break;
        
    // ==================== 消息系统 ====================
    case 'get_msgs':
        handleGetMessages();
        break;
    case 'send_msg':
        handleSendMessage();
        break;
    case 'delete_msg':
        handleDeleteMessage();
        break;
        
    default:
        jsonOut(400, '未知操作');
}

// ============================================================
// 账号系统函数
// ============================================================

function handleLoginOrRegister() {
    global $pdo;
    
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $deviceId = trim($_POST['device_id'] ?? '');
    $email = trim($_POST['email'] ?? '');
    
    $now = time();
    
    // 场景1: 设备ID自动登录
    if (!$username && !$password && $deviceId) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE device_id = ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$deviceId]);
        $user = $stmt->fetch();
        
        if ($user) {
            jsonOut(200, '设备登录成功', formatUserOutput($user));
        } else {
            // 自动创建
            $autoUsername = '用户_' . substr(md5($deviceId), 0, 8);
            $defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' . urlencode($autoUsername);
            
            $stmt = $pdo->prepare(
                "INSERT INTO users (username, password, avatar, device_id, role, coins, created_at) 
                 VALUES (?, '', ?, ?, 0, 100, ?)"
            );
            $stmt->execute([$autoUsername, $defaultAvatar, $deviceId, $now]);
            
            $newId = $pdo->lastInsertId();
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$newId]);
            
            jsonOut(200, '注册并登录成功', formatUserOutput($stmt->fetch()));
        }
        return;
    }
    
    // 场景2: 用户名+密码登录
    if (empty($username)) jsonOut(400, '用户名不能为空');
    if (empty($password)) jsonOut(400, '密码不能为空');
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if ($user) {
        // 已有用户 → 验证密码
        if (password_verify($password, $user['password'])) {
            if ($deviceId) {
                $pdo->prepare("UPDATE users SET device_id = ? WHERE id = ?")->execute([$deviceId, $user['id']]);
            }
            jsonOut(200, '登录成功', formatUserOutput($user));
        } else {
            jsonOut(401, '密码错误');
        }
    } else {
        // 注册新用户
        // 检查用户名
        $checkStmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $checkStmt->execute([$username]);
        if ($checkStmt->fetch()) jsonOut(400, '用户名已存在');
        
        // 如果提供了邮箱，检查邮箱
        if ($email) {
            $emailStmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $emailStmt->execute([$email]);
            if ($emailStmt->fetch()) jsonOut(400, '该邮箱已注册');
        }
        
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' . urlencode($username);
        
        try {
            $stmt = $pdo->prepare(
                "INSERT INTO users (username, password, avatar, email, device_id, role, coins, created_at) 
                 VALUES (?, ?, ?, ?, ?, 0, 100, ?)"
            );
            $stmt->execute([$username, $hash, $defaultAvatar, $email, $deviceId, $now]);
            
            $newId = $pdo->lastInsertId();
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$newId]);
            
            jsonOut(200, '注册并登录成功', formatUserOutput($stmt->fetch()));
        } catch (Exception $e) {
            jsonOut(500, '注册失败');
        }
    }
}

function handleGetUserInfo() {
    global $pdo;
    
    $uid = intval($_POST['user_id'] ?? 0);
    if (!$uid) jsonOut(400, '缺少用户ID');
    
    $stmt = $pdo->prepare("SELECT id, username, avatar, role, coins, vip_expire, signature FROM users WHERE id = ?");
    $stmt->execute([$uid]);
    $user = $stmt->fetch();
    
    if ($user) {
        jsonOut(200, '获取成功', formatUserOutput($user));
    } else {
        jsonOut(404, '用户不存在');
    }
}

function handleGetUserProfile() {
    global $pdo;
    
    $targetId = intval($_POST['target_id'] ?? 0);
    
    if (!$targetId) jsonOut(400, '缺少用户ID');
    
    $userStmt = $pdo->prepare("SELECT id, username, avatar, role, coins, vip_expire, signature FROM users WHERE id = ?");
    $userStmt->execute([$targetId]);
    $user = $userStmt->fetch();
    
    if (!$user) jsonOut(404, '用户不存在');
    
    // 统计数据
    $statStmt = $pdo->prepare(
        "SELECT 
            (SELECT COUNT(*) FROM circle_posts WHERE user_id = ?) as post_count,
            (SELECT COUNT(*) FROM circles WHERE created_by = ?) as circle_count
         FROM dual"
    );
    $statStmt->execute([$targetId, $targetId]);
    $stats = $statStmt->fetch();
    
    $result = array_merge(formatUserOutput($user), $stats);
    jsonOut(200, 'success', $result);
}

function handleUpdateProfile() {
    global $pdo;
    
    $uid = intval($_POST['user_id'] ?? 0);
    $username = trim($_POST['username'] ?? '');
    $avatar = trim($_POST['avatar'] ?? '');
    
    if (!$uid) jsonOut(401, '请先登录');
    if (empty($username)) jsonOut(400, '昵称不能为空');
    
    // 检查用户名是否被占用
    $checkStmt = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
    $checkStmt->execute([$username, $uid]);
    if ($checkStmt->fetch()) jsonOut(400, '该昵称已被占用');
    
    $stmt = $pdo->prepare("UPDATE users SET username = ?, avatar = ? WHERE id = ?");
    
    if ($stmt->execute([$username, $avatar, $uid])) {
        jsonOut(200, '更新成功');
    } else {
        jsonOut(500, '更新失败');
    }
}

function handleUserOp() {
    global $pdo;
    
    $adminId = intval($_POST['admin_id'] ?? 0);
    $targetId = intval($_POST['target_id'] ?? 0);
    $opType = $_POST['op_type'] ?? '';
    $val = $_POST['val'] ?? '';
    
    if (!$adminId || !$targetId) jsonOut(400, '参数不足');
    
    // 验证管理员权限
    $adminStmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $adminStmt->execute([$adminId]);
    $admin = $adminStmt->fetch();
    if (!$admin || $admin['role'] < 1) jsonOut(403, '无权操作');
    
    switch ($opType) {
        case 'ban':
            $pdo->prepare("UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?")->execute([$val, $targetId]);
            jsonOut(200, '已封禁');
            break;
            
        case 'unban':
            $pdo->prepare("UPDATE users SET is_banned = 0, ban_reason = '' WHERE id = ?")->execute([$targetId]);
            jsonOut(200, '已解封');
            break;
            
        case 'set_vip':
            $duration = intval($val);
            if ($duration < 0) {
                $vipExpire = 1893456000; // 永久VIP
            } elseif ($duration > 0) {
                $vipExpire = time() + $duration * 86400;
            } else {
                $vipExpire = 0;
            }
            $pdo->prepare("UPDATE users SET vip_expire = ? WHERE id = ?")->execute([$vipExpire, $targetId]);
            jsonOut(200, 'VIP状态已更新');
            break;
            
        default:
            jsonOut(400, '未知操作类型');
    }
}

// ============================================================
// 消息系统函数
// ============================================================

function handleGetMessages() {
    global $pdo;
    
    $lastId = intval($_POST['last_id'] ?? 0);
    
    if ($lastId > 0) {
        // 增量加载
        $sql = "SELECT m.*, u.username, u.avatar, u.role, u.vip_expire 
                FROM chat_messages m
                LEFT JOIN users u ON m.user_id = u.id
                WHERE m.id > ? AND m.is_deleted = 0
                ORDER BY m.id ASC 
                LIMIT 50";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$lastId]);
    } else {
        // 首次加载: 获取最后50条
        $sql = "SELECT * FROM (
                    SELECT m.*, u.username, u.avatar, u.role, u.vip_expire 
                    FROM chat_messages m
                    LEFT JOIN users u ON m.user_id = u.id
                    WHERE m.is_deleted = 0
                    ORDER BY m.id DESC 
                    LIMIT 50
                ) sub 
                ORDER BY id ASC";
        
        $stmt = $pdo->query($sql);
    }
    
    jsonOut(200, 'success', $stmt->fetchAll());
}

function handleSendMessage() {
    global $pdo;
    
    $uid = intval($_POST['uid'] ?? 0);
    $content = $_POST['content'] ?? '';
    $type = $_POST['type'] ?? 'text';
    $quoteId = intval($_POST['quote_id'] ?? 0);
    $quoteContent = $_POST['quote_content'] ?? null;
    $quoteUser = $_POST['quote_user'] ?? null;
    
    if (!$uid) jsonOut(401, '请先登录');
    if (empty($content)) jsonOut(400, '内容不能为空');
    
    // 检查封禁
    $userStmt = $pdo->prepare("SELECT is_banned, ban_reason FROM users WHERE id = ?");
    $userStmt->execute([$uid]);
    $user = $userStmt->fetch();
    if ($user && $user['is_banned'] == 1) {
        jsonOut(403, '您已被禁言: ' . ($user['ban_reason'] ?: '违反社区规定'));
    }
    
    // 处理图片
    if ($type === 'image') {
        $fileName = 'msg_' . time() . '_' . rand(1000, 9999) . '.png';
        $uploadDir = 'uploads/chat/';
        
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
        
        $filePath = $uploadDir . $fileName;
        saveBase64Image($content, $filePath);
        $content = $filePath;
    }
    
    // 处理引用
    if ($quoteId > 0 && !$quoteContent) {
        $quoteStmt = $pdo->prepare("SELECT m.content, u.username FROM chat_messages m LEFT JOIN users u ON m.user_id = u.id WHERE m.id = ?");
        $quoteStmt->execute([$quoteId]);
        $quote = $quoteStmt->fetch();
        if ($quote) {
            $quoteContent = $quote['content'];
            $quoteUser = $quote['username'];
        }
    }
    
    $now = time();
    
    $stmt = $pdo->prepare(
        "INSERT INTO chat_messages (user_id, type, content, quote_id, quote_content, quote_user, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    
    if ($stmt->execute([$uid, $type, $content, $quoteId, $quoteContent, $quoteUser, $now])) {
        jsonOut(200, '发送成功', ['msg_id' => $pdo->lastInsertId()]);
    } else {
        jsonOut(500, '发送失败');
    }
}

function handleDeleteMessage() {
    global $pdo;
    
    $msgId = intval($_POST['msg_id'] ?? 0);
    $userId = intval($_POST['user_id'] ?? 0);
    $isAdmin = intval($_POST['is_admin'] ?? 0);
    
    if (!$msgId || !$userId) jsonOut(400, '参数不足');
    
    // 获取消息信息
    $msgStmt = $pdo->prepare("SELECT user_id, created_at FROM chat_messages WHERE id = ?");
    $msgStmt->execute([$msgId]);
    $msg = $msgStmt->fetch();
    
    if (!$msg) jsonOut(404, '消息不存在');
    
    $canDelete = false;
    
    if ($isAdmin) {
        $canDelete = true;
    } elseif ($msg['user_id'] == $userId) {
        $timeDiff = time() - $msg['created_at'];
        if ($timeDiff <= 120) {
            $canDelete = true;
        } else {
            jsonOut(403, '超过2分钟无法撤回');
        }
    }
    
    if (!$canDelete) jsonOut(403, '无权操作');
    
    $pdo->prepare("UPDATE chat_messages SET is_deleted = 1 WHERE id = ?")->execute([$msgId]);
    
    jsonOut(200, '消息已撤回');
}