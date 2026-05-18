<?php
/**
 * config.php
 * 数据库连接与公共函数
 */

// CORS跨域设置
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================================
// 数据库配置
// ============================================================
$dbConfig = [
    'host' => 'localhost',
    'dbname' => 'csdxx',
    'username' => 'csdxx',       // 修改为你的数据库用户名
    'password' => 'csdxx',           // 修改为你的数据库密码
    'charset' => 'utf8mb4'
];

// ============================================================
// 数据库连接
// ============================================================
try {
    $dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    
    $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $options);
} catch (PDOException $e) {
    // 数据库不存在时，自动创建
    if ($e->getCode() == 1049) {
        try {
            $dsn = "mysql:host={$dbConfig['host']};charset={$dbConfig['charset']}";
            $tempPdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $options);
            
            // 创建数据库
            $tempPdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbConfig['dbname']}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $tempPdo->exec("USE `{$dbConfig['dbname']}`");
            
            // 自动创建表结构
            createAllTables($tempPdo);
            
            $pdo = $tempPdo;
        } catch (PDOException $e2) {
            echo json_encode(['code' => 500, 'msg' => '数据库初始化失败: ' . $e2->getMessage()], JSON_UNESCAPED_UNICODE);
            exit();
        }
    } else {
        echo json_encode(['code' => 500, 'msg' => '数据库连接失败: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

/**
 * 自动创建所有必需的表结构
 */
function createAllTables($pdo) {
    // 用户表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `username` varchar(50) NOT NULL COMMENT '用户名',
        `password` varchar(255) NOT NULL DEFAULT '' COMMENT '密码哈希',
        `avatar` varchar(500) DEFAULT '' COMMENT '头像URL',
        `email` varchar(100) DEFAULT '' COMMENT '邮箱',
        `device_id` varchar(255) DEFAULT '' COMMENT '设备ID',
        `signature` varchar(200) DEFAULT '' COMMENT '个性签名',
        `role` tinyint(1) DEFAULT 0 COMMENT '0-普通用户 1-管理员 2-超级管理员',
        `coins` int(11) DEFAULT 100 COMMENT '金币余额',
        `vip_expire` int(11) DEFAULT 0 COMMENT 'VIP到期时间戳',
        `is_banned` tinyint(1) DEFAULT 0 COMMENT '是否被封禁',
        `ban_reason` varchar(255) DEFAULT '' COMMENT '封禁原因',
        `created_at` int(11) DEFAULT 0 COMMENT '注册时间',
        UNIQUE KEY `username` (`username`),
        KEY `device_id` (`device_id`),
        KEY `email` (`email`)
    ) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8mb4 COMMENT='用户表'");

    // 圈子表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `circles` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `name` varchar(100) NOT NULL COMMENT '圈子名称',
        `description` varchar(500) DEFAULT '' COMMENT '圈子描述',
        `icon` varchar(50) DEFAULT 'fa-hashtag' COMMENT 'FontAwesome图标',
        `color` varchar(20) DEFAULT '#3b82f6' COMMENT '主题色',
        `bg_image` varchar(500) DEFAULT '' COMMENT '背景图URL',
        `created_by` int(11) NOT NULL COMMENT '创建者用户ID',
        `member_count` int(11) DEFAULT 1 COMMENT '成员数',
        `post_count` int(11) DEFAULT 0 COMMENT '帖子数',
        `created_at` int(11) DEFAULT 0 COMMENT '创建时间',
        KEY `created_by` (`created_by`),
        KEY `name` (`name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='圈子表'");

    // 圈子成员表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `circle_members` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `circle_id` int(11) NOT NULL COMMENT '圈子ID',
        `user_id` int(11) NOT NULL COMMENT '用户ID',
        `joined_at` int(11) DEFAULT 0 COMMENT '加入时间',
        UNIQUE KEY `circle_user_unique` (`circle_id`,`user_id`),
        KEY `user_id` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='圈子成员表'");

    // 帖子表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `circle_posts` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `user_id` int(11) NOT NULL COMMENT '发帖用户ID',
        `circle_id` int(11) NOT NULL COMMENT '所属圈子ID',
        `title` varchar(200) DEFAULT '' COMMENT '帖子标题',
        `content` text COMMENT '帖子内容',
        `media_urls` text COMMENT '媒体文件URL(JSON格式)',
        `like_count` int(11) DEFAULT 0 COMMENT '点赞数',
        `comment_count` int(11) DEFAULT 0 COMMENT '评论数',
        `total_coins` int(11) DEFAULT 0 COMMENT '打赏总金币',
        `is_essence` tinyint(1) DEFAULT 0 COMMENT '是否精华',
        `is_top` tinyint(1) DEFAULT 0 COMMENT '是否置顶',
        `created_at` int(11) DEFAULT 0 COMMENT '发布时间',
        KEY `user_id` (`user_id`),
        KEY `circle_id` (`circle_id`),
        KEY `created_at` (`created_at`),
        KEY `circle_essence` (`circle_id`,`is_essence`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子表'");

    // 点赞表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `circle_likes` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `user_id` int(11) NOT NULL COMMENT '点赞用户ID',
        `post_id` int(11) NOT NULL COMMENT '帖子ID',
        `created_at` int(11) DEFAULT 0 COMMENT '点赞时间',
        UNIQUE KEY `user_post_unique` (`user_id`,`post_id`),
        KEY `post_id` (`post_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点赞表'");

    // 评论表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `circle_comments` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `post_id` int(11) NOT NULL COMMENT '所属帖子ID',
        `user_id` int(11) NOT NULL COMMENT '评论用户ID',
        `content` text NOT NULL COMMENT '评论内容',
        `reply_to` int(11) DEFAULT 0 COMMENT '回复的评论ID',
        `like_count` int(11) DEFAULT 0 COMMENT '点赞数',
        `created_at` int(11) DEFAULT 0 COMMENT '评论时间',
        KEY `post_id` (`post_id`),
        KEY `user_id` (`user_id`),
        KEY `reply_to` (`reply_to`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论表'");

    // 交易记录表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `circle_transactions` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `user_id` int(11) NOT NULL COMMENT '用户ID',
        `target_id` int(11) NOT NULL COMMENT '目标ID',
        `target_type` varchar(50) NOT NULL COMMENT '目标类型: post_reward',
        `amount` int(11) NOT NULL COMMENT '金额(正收入负支出)',
        `description` varchar(255) DEFAULT '' COMMENT '描述',
        `created_at` int(11) DEFAULT 0 COMMENT '交易时间',
        KEY `user_id` (`user_id`),
        KEY `target` (`target_type`,`target_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易记录表'");

    // 聊天消息表
    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_messages` (
        `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `user_id` int(11) NOT NULL COMMENT '发送者ID',
        `type` varchar(20) DEFAULT 'text' COMMENT '消息类型: text/image',
        `content` text COMMENT '消息内容',
        `quote_id` int(11) DEFAULT 0 COMMENT '引用消息ID',
        `quote_content` text COMMENT '引用消息内容',
        `quote_user` varchar(50) DEFAULT NULL COMMENT '引用消息用户',
        `is_deleted` tinyint(1) DEFAULT 0 COMMENT '是否已撤回',
        `created_at` int(11) DEFAULT 0 COMMENT '发送时间',
        KEY `user_id` (`user_id`),
        KEY `created_at` (`created_at`),
        KEY `quote_id` (`quote_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天消息表'");

    // 插入默认管理员账号
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'admin'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $hash = password_hash('admin123', PASSWORD_DEFAULT);
        $avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin';
        $pdo->prepare(
            "INSERT INTO users (username, password, avatar, role, coins, vip_expire, created_at) 
             VALUES ('admin', ?, ?, 2, 99999, 1893456000, UNIX_TIMESTAMP())"
        )->execute([$hash, $avatar]);
    }
    
    // 插入示例圈子数据
    insertSampleData($pdo);
}

/**
 * 插入示例数据
 */
function insertSampleData($pdo) {
    // 检查是否已有数据
    $stmt = $pdo->query("SELECT COUNT(*) FROM circles");
    if ($stmt->fetchColumn() > 0) return;
    
    $adminId = 1001;
    
    // 获取或创建管理员用户
    $stmt = $pdo->query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
    $admin = $stmt->fetch();
    if ($admin) $adminId = $admin['id'];
    
    $now = time();
    
    // 示例圈子
    $circles = [
        ['技术交流', '程序员技术分享与学习交流', 'fa-code', '#3b82f6'],
        ['游戏部落', '游戏攻略、开黑组队、赛事讨论', 'fa-gamepad', '#10b981'],
        ['动漫天地', '动漫讨论、资源分享、二次元文化', 'fa-tv', '#f43f5e'],
    ];
    
    foreach ($circles as $circle) {
        $pdo->prepare(
            "INSERT INTO circles (name, description, icon, color, created_by, created_at) 
             VALUES (?, ?, ?, ?, ?, ?)"
        )->execute([$circle[0], $circle[1], $circle[2], $circle[3], $adminId, $now]);
    }
}

/**
 * 统一JSON输出函数
 */
function jsonOut($code, $msg, $data = null) {
    echo json_encode([
        'code' => $code,
        'msg' => $msg,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * 保存Base64图片到文件
 */
function saveBase64Image($base64_string, $output_file) {
    $dir = dirname($output_file);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    
    // 提取纯Base64数据
    if (preg_match('/^data:image\/(\w+);base64,/', $base64_string, $type)) {
        $base64_string = substr($base64_string, strpos($base64_string, ',') + 1);
    }
    
    $data = base64_decode($base64_string);
    if ($data === false) return false;
    
    return file_put_contents($output_file, $data) !== false;
}

/**
 * 格式化用户输出(移除敏感字段)
 */
function formatUserOutput($user) {
    if (!$user) return null;
    
    unset($user['password']);
    
    // 确保整数类型
    $intFields = ['id', 'role', 'coins', 'vip_expire', 'is_banned', 'created_at'];
    foreach ($intFields as $field) {
        if (isset($user[$field])) {
            $user[$field] = intval($user[$field]);
        }
    }
    
    return $user;
}