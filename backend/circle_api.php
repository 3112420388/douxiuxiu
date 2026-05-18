<?php
/**
 * circle_api.php
 * 圈子系统API
 * 包含: 圈子管理、帖子管理、评论、打赏、用户主页
 */

require_once 'config.php';

$action = $_POST['action'] ?? '';
$userId = intval($_POST['user_id'] ?? 0);

// ============================================================
// 路由分发
// ============================================================
switch ($action) {
    // ==================== 圈子管理 ====================
    case 'get_circles':
        handleGetCircles();
        break;
    case 'get_circle_info':
        handleGetCircleInfo($userId);
        break;
    case 'create_circle':
        handleCreateCircle($userId);
        break;
    case 'join_toggle':
        handleJoinToggle($userId);
        break;
    case 'manage_circle':
        handleManageCircle($userId);
        break;
        
    // ==================== 帖子管理 ====================
    case 'get_post_list':
        handleGetPostList($userId);
        break;
    case 'create_post':
        handleCreatePost($userId);
        break;
    case 'toggle_like':
        handleToggleLike($userId);
        break;
    case 'reward_post':
        handleRewardPost($userId);
        break;
        
// ==================== 评论管理 ====================
case 'get_comments':
    handleGetComments();
    break;
case 'create_comment':
case 'add_comment':   // 兼容前端调用的 add_comment
    handleCreateComment($userId);
    break;
case 'delete_comment':
    handleDeleteComment($userId);
    break;
        
    // ==================== 用户主页 ====================
    case 'get_user_posts':
        handleGetUserPosts();
        break;
    case 'get_user_circles':
        handleGetUserCircles();
        break;
    case 'get_user_likes':
        handleGetUserLikes();
        break;
    case 'get_coin_history':
        handleGetCoinHistory($userId);
        break;
        
    default:
        jsonOut(400, '未知操作');
}

// ============================================================
// 圈子管理函数
// ============================================================

function handleGetCircles() {
    global $pdo;
    $stmt = $pdo->query("SELECT * FROM circles ORDER BY id ASC");
    jsonOut(200, 'success', $stmt->fetchAll());
}

function handleGetCircleInfo($userId) {
    global $pdo;
    $circleId = intval($_POST['circle_id'] ?? 0);
    if (!$circleId) jsonOut(400, '缺少圈子ID');
    
    $stmt = $pdo->prepare(
        "SELECT c.*, u.username as owner_name, u.avatar as owner_avatar,
                (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
         FROM circles c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.id = ?"
    );
    $stmt->execute([$circleId]);
    $circle = $stmt->fetch();
    
    if (!$circle) jsonOut(404, '圈子不存在');
    
    if ($userId > 0) {
        $checkStmt = $pdo->prepare("SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ?");
        $checkStmt->execute([$circleId, $userId]);
        $circle['is_member'] = $checkStmt->fetch() ? true : false;
        $circle['is_owner'] = ($circle['created_by'] == $userId);
    } else {
        $circle['is_member'] = false;
        $circle['is_owner'] = false;
    }
    
    jsonOut(200, 'success', $circle);
}

function handleCreateCircle($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $name = trim($_POST['name'] ?? '');
    $desc = trim($_POST['desc'] ?? '');
    
    if (empty($name)) jsonOut(400, '圈子名称不能为空');
    if (mb_strlen($name) > 5) jsonOut(400, '名称不能超过5个字');
    
    // 每人只能创建一个圈子
    $checkStmt = $pdo->prepare("SELECT id FROM circles WHERE created_by = ?");
    $checkStmt->execute([$userId]);
    if ($checkStmt->fetch()) jsonOut(403, '每人只能创建一个圈子');
    
    $colors = ['#3b82f6', '#10b981', '#f43f5e', '#ec4899', '#f59e0b', '#8b5cf6'];
    $icons = ['fa-code', 'fa-gamepad', 'fa-tv', 'fa-music', 'fa-camera', 'fa-book'];
    $color = $colors[array_rand($colors)];
    $icon = $icons[array_rand($icons)];
    $now = time();
    
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO circles (name, description, icon, color, created_by, member_count, post_count, created_at) 
             VALUES (?, ?, ?, ?, ?, 1, 0, ?)"
        );
        $stmt->execute([$name, $desc, $icon, $color, $userId, $now]);
        $circleId = $pdo->lastInsertId();
        
        // 自动加入
        $pdo->prepare("INSERT INTO circle_members (circle_id, user_id, joined_at) VALUES (?, ?, ?)")
            ->execute([$circleId, $userId, $now]);
        
        $pdo->commit();
        jsonOut(200, '创建成功', ['circle_id' => $circleId]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonOut(500, '创建失败');
    }
}

function handleJoinToggle($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $circleId = intval($_POST['circle_id'] ?? 0);
    $type = $_POST['type'] ?? '';
    
    if (!$circleId) jsonOut(400, '缺少圈子ID');
    
    if ($type === 'join') {
        $stmt = $pdo->prepare("INSERT IGNORE INTO circle_members (circle_id, user_id, joined_at) VALUES (?, ?, ?)");
        $stmt->execute([$circleId, $userId, time()]);
        jsonOut(200, '已加入圈子');
    } elseif ($type === 'quit') {
        // 圈主不能退出
        $checkStmt = $pdo->prepare("SELECT id FROM circles WHERE id = ? AND created_by = ?");
        $checkStmt->execute([$circleId, $userId]);
        if ($checkStmt->fetch()) jsonOut(403, '圈主不能退出圈子');
        
        $stmt = $pdo->prepare("DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?");
        $stmt->execute([$circleId, $userId]);
        jsonOut(200, '已退出圈子');
    } else {
        jsonOut(400, '无效操作类型');
    }
}

function handleManageCircle($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $subAction = $_POST['sub_action'] ?? '';
    $circleId = intval($_POST['circle_id'] ?? 0);
    
    // 验证圈子所有权
    $checkStmt = $pdo->prepare("SELECT id FROM circles WHERE id = ? AND created_by = ?");
    $checkStmt->execute([$circleId, $userId]);
    if (!$checkStmt->fetch()) jsonOut(403, '无权操作');
    
    switch ($subAction) {
        case 'update':
            $name = $_POST['name'] ?? '';
            $desc = $_POST['desc'] ?? '';
            $bg = $_POST['bg_image'] ?? '';
            
            if ($name && mb_strlen($name) > 5) jsonOut(400, '名称不能超过5个字');
            
            $pdo->prepare("UPDATE circles SET name = ?, description = ?, bg_image = ? WHERE id = ?")
                ->execute([$name, $desc, $bg, $circleId]);
            jsonOut(200, '更新成功');
            break;
            
        case 'delete_circle':
            $pdo->beginTransaction();
            try {
                // 先删除关联的评论和点赞
                $pdo->prepare("DELETE FROM circle_comments WHERE post_id IN (SELECT id FROM circle_posts WHERE circle_id = ?)")->execute([$circleId]);
                $pdo->prepare("DELETE FROM circle_likes WHERE post_id IN (SELECT id FROM circle_posts WHERE circle_id = ?)")->execute([$circleId]);
                $pdo->prepare("DELETE FROM circle_posts WHERE circle_id = ?")->execute([$circleId]);
                $pdo->prepare("DELETE FROM circle_members WHERE circle_id = ?")->execute([$circleId]);
                $pdo->prepare("DELETE FROM circles WHERE id = ?")->execute([$circleId]);
                $pdo->commit();
                jsonOut(200, '圈子已解散');
            } catch (Exception $e) {
                $pdo->rollBack();
                jsonOut(500, '解散失败');
            }
            break;
            
        case 'delete_post':
            $postId = intval($_POST['post_id'] ?? 0);
            $pdo->prepare("DELETE FROM circle_comments WHERE post_id = ?")->execute([$postId]);
            $pdo->prepare("DELETE FROM circle_likes WHERE post_id = ?")->execute([$postId]);
            $pdo->prepare("DELETE FROM circle_posts WHERE id = ? AND circle_id = ?")->execute([$postId, $circleId]);
            jsonOut(200, '帖子已删除');
            break;
            
        default:
            jsonOut(400, '未知操作');
    }
}

// ============================================================
// 帖子管理函数
// ============================================================

function handleGetPostList($userId) {
    global $pdo;
    
    $page = max(1, intval($_POST['page'] ?? 1));
    $circleId = intval($_POST['circle_id'] ?? 0);
    $keyword = trim($_POST['keyword'] ?? '');
    $tab = $_POST['tab'] ?? 'all';
    $limit = 10;
    $offset = ($page - 1) * $limit;
    
    $where = [];
    $params = [];
    
    if ($circleId > 0) {
        $where[] = "p.circle_id = ?";
        $params[] = $circleId;
    }
    
    if ($keyword) {
        $where[] = "(p.title LIKE ? OR p.content LIKE ?)";
        $params[] = "%$keyword%";
        $params[] = "%$keyword%";
    }
    
    if ($tab === 'essence') {
        $where[] = "p.is_essence = 1";
    }
    
    $whereSql = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";
    
    // 使用参数绑定方式
    $sql = "SELECT p.*, u.username, u.avatar,
                   (SELECT COUNT(*) FROM circle_likes WHERE post_id = p.id AND user_id = ?) as is_liked
            FROM circle_posts p
            LEFT JOIN users u ON p.user_id = u.id
            $whereSql
            ORDER BY p.is_top DESC, p.created_at DESC
            LIMIT $limit OFFSET $offset";
    
    // 将userId放在参数数组最前面
    array_unshift($params, $userId);
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    jsonOut(200, 'success', $stmt->fetchAll());
}

function handleCreatePost($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $title = trim($_POST['title'] ?? '');
    $content = trim($_POST['content'] ?? '');
    $circleId = intval($_POST['circle_id'] ?? 1);
    
    if (empty($content)) jsonOut(400, '内容不能为空');
    
    // 处理上传文件
    $mediaUrls = [];
    if (!empty($_FILES['media'])) {
        $files = $_FILES['media'];
        $count = is_array($files['name']) ? count($files['name']) : 1;
        
        for ($i = 0; $i < $count; $i++) {
            $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            
            if ($tmpName && $name) {
                $ext = pathinfo($name, PATHINFO_EXTENSION);
                $newName = 'post_' . time() . '_' . $i . '_' . rand(100, 999) . '.' . $ext;
                $uploadDir = 'uploads/posts/';
                
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
                
                if (move_uploaded_file($tmpName, $uploadDir . $newName)) {
                    $mediaUrls[] = $uploadDir . $newName;
                }
            }
        }
    }
    
    $now = time();
    
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO circle_posts (user_id, circle_id, title, content, media_urls, like_count, comment_count, total_coins, created_at) 
             VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)"
        );
        $stmt->execute([$userId, $circleId, $title, $content, json_encode($mediaUrls), $now]);
        $postId = $pdo->lastInsertId();
        
        // 更新圈子帖子数
        $pdo->prepare("UPDATE circles SET post_count = (SELECT COUNT(*) FROM circle_posts WHERE circle_id = ?) WHERE id = ?")
            ->execute([$circleId, $circleId]);
        
        // 发帖奖励20金币
        $pdo->prepare("UPDATE users SET coins = coins + 20 WHERE id = ?")->execute([$userId]);
        
        $pdo->commit();
        jsonOut(200, '发布成功', ['post_id' => $postId]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonOut(500, '发布失败');
    }
}

function handleToggleLike($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $postId = intval($_POST['post_id'] ?? 0);
    if (!$postId) jsonOut(400, '缺少帖子ID');
    
    $checkStmt = $pdo->prepare("SELECT id FROM circle_likes WHERE user_id = ? AND post_id = ?");
    $checkStmt->execute([$userId, $postId]);
    
    if ($checkStmt->fetch()) {
        // 取消点赞
        $pdo->prepare("DELETE FROM circle_likes WHERE user_id = ? AND post_id = ?")->execute([$userId, $postId]);
        $pdo->prepare("UPDATE circle_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?")->execute([$postId]);
        jsonOut(200, '已取消', ['status' => 'unliked']);
    } else {
        // 点赞
        $pdo->prepare("INSERT INTO circle_likes (user_id, post_id, created_at) VALUES (?, ?, ?)")
            ->execute([$userId, $postId, time()]);
        $pdo->prepare("UPDATE circle_posts SET like_count = like_count + 1 WHERE id = ?")->execute([$postId]);
        jsonOut(200, '已点赞', ['status' => 'liked']);
    }
}

function handleRewardPost($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $postId = intval($_POST['post_id'] ?? 0);
    $amount = intval($_POST['amount'] ?? 0);
    
    if ($amount <= 0) jsonOut(400, '金额不正确');
    
    // 检查余额
    $userStmt = $pdo->prepare("SELECT coins FROM users WHERE id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();
    
    if (!$user || $user['coins'] < $amount) jsonOut(400, '余额不足');
    
    // 获取帖子作者
    $postStmt = $pdo->prepare("SELECT user_id FROM circle_posts WHERE id = ?");
    $postStmt->execute([$postId]);
    $post = $postStmt->fetch();
    
    if (!$post) jsonOut(404, '帖子不存在');
    if ($post['user_id'] == $userId) jsonOut(400, '不能给自己打赏');
    
    $pdo->beginTransaction();
    try {
        // 扣除
        $pdo->prepare("UPDATE users SET coins = coins - ? WHERE id = ?")->execute([$amount, $userId]);
        // 增加
        $pdo->prepare("UPDATE users SET coins = coins + ? WHERE id = ?")->execute([$amount, $post['user_id']]);
        // 更新帖子总打赏
        $pdo->prepare("UPDATE circle_posts SET total_coins = total_coins + ? WHERE id = ?")->execute([$amount, $postId]);
        // 记录交易
        $pdo->prepare("INSERT INTO circle_transactions (user_id, target_id, target_type, amount, description, created_at) VALUES (?, ?, 'post_reward', ?, ?, ?)")
            ->execute([$userId, $postId, -$amount, '打赏帖子', time()]);
        $pdo->prepare("INSERT INTO circle_transactions (user_id, target_id, target_type, amount, description, created_at) VALUES (?, ?, 'post_reward', ?, ?, ?)")
            ->execute([$post['user_id'], $postId, $amount, '收到打赏', time()]);
        
        $pdo->commit();
        
        // 返回最新余额
        $newBalanceStmt = $pdo->prepare("SELECT coins FROM users WHERE id = ?");
        $newBalanceStmt->execute([$userId]);
        
        jsonOut(200, '打赏成功', ['new_balance' => intval($newBalanceStmt->fetchColumn())]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonOut(500, '交易失败');
    }
}

// ============================================================
// 评论管理函数
// ============================================================

function handleGetComments() {
    global $pdo;
    
    $postId = intval($_POST['post_id'] ?? 0);
    $page = max(1, intval($_POST['page'] ?? 1));
    $limit = 20;
    $offset = ($page - 1) * $limit;
    
    if (!$postId) jsonOut(400, '缺少帖子ID');
    
    $sql = "SELECT c.*, u.username, u.avatar, u.role
            FROM circle_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
            LIMIT $limit OFFSET $offset";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$postId]);
    
    jsonOut(200, 'success', $stmt->fetchAll());
}

function handleCreateComment($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $postId = intval($_POST['post_id'] ?? 0);
    $content = trim($_POST['content'] ?? '');
    $replyTo = intval($_POST['reply_to'] ?? 0);
    
    if (!$postId) jsonOut(400, '缺少帖子ID');
    if (empty($content)) jsonOut(400, '内容不能为空');
    
    $now = time();
    
    $stmt = $pdo->prepare(
        "INSERT INTO circle_comments (post_id, user_id, content, reply_to, created_at) 
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([$postId, $userId, $content, $replyTo, $now]);
    $commentId = $pdo->lastInsertId();
    
    // 更新帖子评论数
    $pdo->prepare("UPDATE circle_posts SET comment_count = (SELECT COUNT(*) FROM circle_comments WHERE post_id = ?) WHERE id = ?")
        ->execute([$postId, $postId]);
    
    // 返回新评论
    $stmt = $pdo->prepare(
        "SELECT c.*, u.username, u.avatar 
         FROM circle_comments c 
         LEFT JOIN users u ON c.user_id = u.id 
         WHERE c.id = ?"
    );
    $stmt->execute([$commentId]);
    
    jsonOut(200, '评论成功', $stmt->fetch());
}

function handleDeleteComment($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $commentId = intval($_POST['comment_id'] ?? 0);
    if (!$commentId) jsonOut(400, '缺少评论ID');
    
    // 获取评论信息
    $stmt = $pdo->prepare("SELECT user_id, post_id FROM circle_comments WHERE id = ?");
    $stmt->execute([$commentId]);
    $comment = $stmt->fetch();
    
    if (!$comment) jsonOut(404, '评论不存在');
    
    // 检查权限(本人或管理员)
    $userStmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();
    $isAdmin = $user && $user['role'] > 0;
    
    if ($comment['user_id'] != $userId && !$isAdmin) {
        jsonOut(403, '无权删除');
    }
    
    $pdo->prepare("DELETE FROM circle_comments WHERE id = ?")->execute([$commentId]);
    
    // 更新评论数
    $pdo->prepare("UPDATE circle_posts SET comment_count = (SELECT COUNT(*) FROM circle_comments WHERE post_id = ?) WHERE id = ?")
        ->execute([$comment['post_id'], $comment['post_id']]);
    
    jsonOut(200, '已删除');
}

// ============================================================
// 用户主页函数
// ============================================================

function handleGetUserPosts() {
    global $pdo;
    
    $targetUserId = intval($_POST['user_id'] ?? 0);
    if (!$targetUserId) jsonOut(400, '缺少用户ID');
    
    $sql = "SELECT p.*, u.username, u.avatar, c.name as circle_name
            FROM circle_posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN circles c ON p.circle_id = c.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
            LIMIT 50";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$targetUserId]);
    
    jsonOut(200, 'success', $stmt->fetchAll());
}

function handleGetUserCircles() {
    global $pdo;
    
    $targetUserId = intval($_POST['user_id'] ?? 0);
    if (!$targetUserId) jsonOut(400, '缺少用户ID');
    
    // 创建的圈子
    $createdStmt = $pdo->prepare(
        "SELECT c.*, (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
         FROM circles c WHERE c.created_by = ?"
    );
    $createdStmt->execute([$targetUserId]);
    $created = $createdStmt->fetchAll();
    
    // 加入的圈子
    $joinedStmt = $pdo->prepare(
        "SELECT c.*, (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
         FROM circles c 
         INNER JOIN circle_members cm ON c.id = cm.circle_id 
         WHERE cm.user_id = ? AND c.created_by != ?"
    );
    $joinedStmt->execute([$targetUserId, $targetUserId]);
    $joined = $joinedStmt->fetchAll();
    
    jsonOut(200, 'success', ['created' => $created, 'joined' => $joined]);
}

function handleGetUserLikes() {
    global $pdo;
    
    $targetUserId = intval($_POST['user_id'] ?? 0);
    if (!$targetUserId) jsonOut(400, '缺少用户ID');
    
    $sql = "SELECT p.*, u.username, u.avatar,
                   (SELECT COUNT(*) FROM circle_likes WHERE post_id = p.id AND user_id = ?) as is_liked
            FROM circle_likes l
            INNER JOIN circle_posts p ON l.post_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            WHERE l.user_id = ?
            ORDER BY l.created_at DESC
            LIMIT 50";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$targetUserId, $targetUserId]);
    
    jsonOut(200, 'success', $stmt->fetchAll());
}

function handleGetCoinHistory($userId) {
    global $pdo;
    
    if (!$userId) jsonOut(401, '请先登录');
    
    $stmt = $pdo->prepare(
        "SELECT * FROM circle_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    );
    $stmt->execute([$userId]);
    
    jsonOut(200, 'success', $stmt->fetchAll());
}